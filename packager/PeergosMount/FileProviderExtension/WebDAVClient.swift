import Foundation

struct WebDAVItem {
    let path: String
    let filename: String
    let isDirectory: Bool
    let size: Int64
    let modificationDate: Date?
    let contentHash: Data   // decoded treehash bytes, or etag bytes as fallback
    let writerKey: String?
}

enum WebDAVError: Error {
    case unexpectedStatus(Int)
    case invalidResponse
    case notFound
}

class WebDAVClient: NSObject {
    private let baseURL: String
    private let username: String
    private let password: String

    private lazy var session: URLSession =
        URLSession(configuration: .default, delegate: self, delegateQueue: nil)

    init(port: Int, username: String, password: String) {
        self.baseURL = "http://localhost:\(port)"
        self.username = username
        self.password = password
    }

    // Returns immediate children of path (Depth: 1, first entry — the container itself — is skipped).
    func propfind(path: String) async throws -> [WebDAVItem] {
        var req = request(path: path, method: "PROPFIND")
        req.setValue("1", forHTTPHeaderField: "Depth")
        req.setValue("application/xml", forHTTPHeaderField: "Content-Type")
        req.httpBody = propfindBody
        let (data, response) = try await session.data(for: req)
        try check(response, expected: 207)
        return try PropfindParser.parse(data: data, skipFirst: true)
    }

    func get(path: String, toFile destination: URL) async throws {
        let req = request(path: path, method: "GET")
        let (tmpURL, response) = try await session.download(for: req)
        try check(response, expected: 200, also: 206)
        try? FileManager.default.removeItem(at: destination)
        try FileManager.default.moveItem(at: tmpURL, to: destination)
    }

    func put(path: String, fileURL: URL) async throws {
        var req = request(path: path, method: "PUT")
        req.httpBody = try Data(contentsOf: fileURL)
        let (_, response) = try await session.data(for: req)
        try check(response, expected: 201, also: 204)
    }

    func mkcol(path: String) async throws {
        let req = request(path: path, method: "MKCOL")
        let (_, response) = try await session.data(for: req)
        try check(response, expected: 201)
    }

    func delete(path: String) async throws {
        let req = request(path: path, method: "DELETE")
        let (_, response) = try await session.data(for: req)
        try check(response, expected: 204, also: 200)
    }

    func move(from: String, to: String) async throws {
        var req = request(path: from, method: "MOVE")
        req.setValue(baseURL + to, forHTTPHeaderField: "Destination")
        req.setValue("T", forHTTPHeaderField: "Overwrite")
        let (_, response) = try await session.data(for: req)
        try check(response, expected: 201, also: 204)
    }

    func snapshot() async throws -> WriterSnapshot {
        let req = request(path: "/peergos/v0/mount/snapshot", method: "GET")
        let (data, response) = try await session.data(for: req)
        try check(response, expected: 200)
        guard let snap = WriterSnapshot.deserialise(data) else { throw WebDAVError.invalidResponse }
        return snap
    }

    // MARK: - Helpers

    private func request(path: String, method: String) -> URLRequest {
        var req = URLRequest(url: URL(string: baseURL + path)!)
        req.httpMethod = method
        return req
    }

    private func check(_ response: URLResponse, expected: Int, also: Int? = nil) throws {
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        if code != expected && code != (also ?? -1) {
            throw WebDAVError.unexpectedStatus(code)
        }
    }

    private var propfindBody: Data {
        """
        <?xml version="1.0" encoding="utf-8"?>
        <D:propfind xmlns:D="DAV:" xmlns:P="https://peergos.org/ns/dav">
          <D:prop>
            <D:displayname/>
            <D:resourcetype/>
            <D:getcontentlength/>
            <D:getlastmodified/>
            <D:getetag/>
            <P:treehash/>
            <P:writerKey/>
          </D:prop>
        </D:propfind>
        """.data(using: .utf8)!
    }
}

extension WebDAVClient: URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    didReceive challenge: URLAuthenticationChallenge,
                    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        let method = challenge.protectionSpace.authenticationMethod
        if method == NSURLAuthenticationMethodHTTPDigest || method == NSURLAuthenticationMethodHTTPBasic {
            let cred = URLCredential(user: username, password: password, persistence: .forSession)
            completionHandler(.useCredential, cred)
        } else {
            completionHandler(.performDefaultHandling, nil)
        }
    }
}

// MARK: - PROPFIND XML parser

private class PropfindParser: NSObject, XMLParserDelegate {
    private var items: [WebDAVItem] = []
    private let skipFirst: Bool
    private var skippedFirst = false

    // Per-response state
    private var inResponse = false
    private var inPropstat = false
    private var currentPath = ""
    private var currentElement = ""
    private var currentText = ""
    private var isDirectory = false
    private var contentLength: Int64 = 0
    private var lastModified: Date? = nil
    private var etag = ""
    private var treehash = ""
    private var writerKey = ""
    private var statusOK = false

    private static let rfc1123: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "EEE, dd MMM yyyy HH:mm:ss zzz"
        return f
    }()

    private init(skipFirst: Bool) { self.skipFirst = skipFirst }

    static func parse(data: Data, skipFirst: Bool) throws -> [WebDAVItem] {
        let parser = PropfindParser(skipFirst: skipFirst)
        let xml = XMLParser(data: data)
        xml.delegate = parser
        xml.parse()
        return parser.items
    }

    func parser(_ parser: XMLParser, didStartElement elementName: String, namespaceURI: String?,
                qualifiedName: String?, attributes: [String: String]) {
        currentElement = elementName
        currentText = ""
        if elementName == "response" {
            inResponse = true
            isDirectory = false; contentLength = 0; lastModified = nil
            etag = ""; treehash = ""; writerKey = ""; statusOK = false
        } else if elementName == "propstat" {
            inPropstat = true
        }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) { currentText += string }

    func parser(_ parser: XMLParser, didEndElement elementName: String, namespaceURI: String?,
                qualifiedName: String?) {
        let text = currentText.trimmingCharacters(in: .whitespaces)
        switch elementName {
        case "href":
            if inResponse && !inPropstat {
                currentPath = text.removingPercentEncoding ?? text
            }
        case "collection":
            isDirectory = true
        case "getcontentlength":
            contentLength = Int64(text) ?? 0
        case "getlastmodified":
            lastModified = PropfindParser.rfc1123.date(from: text)
        case "getetag":
            etag = text
        case "treehash":
            treehash = text
        case "writerKey":
            writerKey = text
        case "status":
            if inPropstat { statusOK = text.contains("200 OK") }
        case "propstat":
            inPropstat = false
        case "response":
            if inResponse && statusOK {
                if skipFirst && !skippedFirst {
                    skippedFirst = true
                } else {
                    let hash = Data(hexString: treehash) ?? Data((etag).utf8)
                    let name = currentPath.split(separator: "/").last.map(String.init) ?? currentPath
                    items.append(WebDAVItem(path: currentPath, filename: name,
                                           isDirectory: isDirectory, size: contentLength,
                                           modificationDate: lastModified, contentHash: hash,
                                           writerKey: writerKey.isEmpty ? nil : writerKey))
                }
            }
            inResponse = false
        default: break
        }
        currentElement = ""
    }
}

private extension Data {
    init?(hexString: String) {
        let hex = hexString
        guard hex.count % 2 == 0 else { return nil }
        var data = Data(capacity: hex.count / 2)
        var idx = hex.startIndex
        while idx < hex.endIndex {
            let next = hex.index(idx, offsetBy: 2)
            guard let byte = UInt8(hex[idx..<next], radix: 16) else { return nil }
            data.append(byte)
            idx = next
        }
        self = data
    }
}
