import CryptoKit
import FileProvider
import Foundation
import UniformTypeIdentifiers

class PeergosFileProviderExtension: NSObject, NSFileProviderReplicatedExtension {
    let domain: NSFileProviderDomain
    private let client: WebDAVClient
    private let registry: ItemRegistry
    private let peergosUsername: String

    required init(domain: NSFileProviderDomain) {
        self.domain = domain
        // MountConfig is written by the Java process into the shared App Group container.
        let config = MountConfig.load()!
        self.client = WebDAVClient(port: config.port,
                                   username: config.webdavUsername,
                                   password: config.webdavPassword)
        self.registry = ItemRegistry.open()
        self.peergosUsername = config.peergosUsername
        super.init()
    }

    func invalidate() {}

    // MARK: - Item lookup

    func item(for identifier: NSFileProviderItemIdentifier,
              request: NSFileProviderRequest,
              completionHandler: @escaping (NSFileProviderItem?, Error?) -> Void) -> Progress {
        if identifier == .rootContainer {
            completionHandler(rootItem(), nil)
            return .discreteProgress(totalUnitCount: 1)
        }
        if let stored = registry.item(forIdentifier: identifier.rawValue) {
            completionHandler(makeItem(from: stored), nil)
        } else {
            completionHandler(nil, NSFileProviderError(.noSuchItem))
        }
        return .discreteProgress(totalUnitCount: 1)
    }

    // MARK: - Enumeration

    func enumerator(for containerItemIdentifier: NSFileProviderItemIdentifier,
                    request: NSFileProviderRequest) throws -> NSFileProviderEnumerator {
        PeergosEnumerator(containerIdentifier: containerItemIdentifier,
                          client: client,
                          registry: registry,
                          peergosUsername: peergosUsername)
    }

    // MARK: - Content fetch (lazy loading)

    func fetchContents(for itemIdentifier: NSFileProviderItemIdentifier,
                       version requestedVersion: NSFileProviderItemVersion?,
                       request: NSFileProviderRequest,
                       completionHandler: @escaping (URL?, NSFileProviderItem?, Error?) -> Void) -> Progress {
        let progress = Progress(totalUnitCount: 100)
        Task {
            do {
                guard let stored = registry.item(forIdentifier: itemIdentifier.rawValue) else {
                    completionHandler(nil, nil, NSFileProviderError(.noSuchItem)); return
                }
                let tmp = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
                try await client.get(path: stored.path, toFile: tmp)
                progress.completedUnitCount = 100
                completionHandler(tmp, makeItem(from: stored), nil)
            } catch {
                completionHandler(nil, nil, error)
            }
        }
        return progress
    }

    // MARK: - Mutations

    func createItem(basedOn itemTemplate: NSFileProviderItem,
                    fields: NSFileProviderItemFields,
                    contents url: URL?,
                    options: NSFileProviderCreateItemOptions,
                    request: NSFileProviderRequest,
                    completionHandler: @escaping (NSFileProviderItem?, NSFileProviderItemFields, Bool, Error?) -> Void) -> Progress {
        let progress = Progress(totalUnitCount: 100)
        Task {
            do {
                let parentPath = try resolvedPath(for: itemTemplate.parentItemIdentifier)
                let path = parentPath + "/" + itemTemplate.filename
                let isDir = itemTemplate.contentType?.conforms(to: .folder) == true

                if isDir {
                    try await client.mkcol(path: path)
                } else if let contentsURL = url {
                    try await client.put(path: path, fileURL: contentsURL)
                }
                progress.completedUnitCount = 100

                let identifier = NSFileProviderItemIdentifier(path)
                let reg = RegistryItem(identifier: identifier.rawValue, path: path,
                                       parentIdentifier: itemTemplate.parentItemIdentifier.rawValue,
                                       filename: itemTemplate.filename, isDirectory: isDir,
                                       contentHash: Data(), writerKey: nil,
                                       size: 0, modificationDate: Date())
                registry.upsert(reg)

                let item = PeergosItem(identifier: identifier,
                                       parentIdentifier: itemTemplate.parentItemIdentifier,
                                       filename: itemTemplate.filename, isDirectory: isDir,
                                       size: nil, modificationDate: Date(), contentHash: Data())
                completionHandler(item, [], false, nil)
            } catch {
                completionHandler(nil, [], false, error)
            }
        }
        return progress
    }

    func modifyItem(_ item: NSFileProviderItem,
                    baseVersion version: NSFileProviderItemVersion,
                    changedFields: NSFileProviderItemFields,
                    contents newContents: URL?,
                    options: NSFileProviderModifyItemOptions,
                    request: NSFileProviderRequest,
                    completionHandler: @escaping (NSFileProviderItem?, NSFileProviderItemFields, Bool, Error?) -> Void) -> Progress {
        let progress = Progress(totalUnitCount: 100)
        Task {
            do {
                guard var stored = registry.item(forIdentifier: item.itemIdentifier.rawValue) else {
                    completionHandler(nil, [], false, NSFileProviderError(.noSuchItem)); return
                }

                var path = stored.path

                if changedFields.contains(.filename) || changedFields.contains(.parentItemIdentifier) {
                    let newParent = try resolvedPath(for: item.parentItemIdentifier)
                    let newPath = newParent + "/" + item.filename
                    try await client.move(from: path, to: newPath)
                    path = newPath
                }

                if changedFields.contains(.contents), let contentsURL = newContents {
                    try await uploadChangedChunks(path: path, fileURL: contentsURL,
                                                  storedChunks: stored.chunkHashes)
                }
                progress.completedUnitCount = 100

                stored = RegistryItem(identifier: item.itemIdentifier.rawValue, path: path,
                                      parentIdentifier: item.parentItemIdentifier.rawValue,
                                      filename: item.filename, isDirectory: stored.isDirectory,
                                      contentHash: stored.contentHash, writerKey: stored.writerKey,
                                      size: stored.size, modificationDate: Date())
                registry.upsert(stored)

                completionHandler(makeItem(from: stored), [], false, nil)
            } catch {
                completionHandler(nil, [], false, error)
            }
        }
        return progress
    }

    func deleteItem(identifier: NSFileProviderItemIdentifier,
                    baseVersion version: NSFileProviderItemVersion,
                    options: NSFileProviderDeleteItemOptions,
                    request: NSFileProviderRequest,
                    completionHandler: @escaping (Error?) -> Void) -> Progress {
        let progress = Progress(totalUnitCount: 1)
        Task {
            do {
                guard let stored = registry.item(forIdentifier: identifier.rawValue) else {
                    completionHandler(NSFileProviderError(.noSuchItem)); return
                }
                try await client.delete(path: stored.path)
                registry.delete(identifier: identifier.rawValue)
                progress.completedUnitCount = 1
                completionHandler(nil)
            } catch {
                completionHandler(error)
            }
        }
        return progress
    }

    // MARK: - Helpers

    private static let chunkSize = 5 * 1024 * 1024  // 5 MiB — must match Peergos server chunk size

    private func uploadChangedChunks(path: String, fileURL: URL, storedChunks: Data?) async throws {
        let attrs = try FileManager.default.attributesOfItem(atPath: fileURL.path)
        let totalSize = (attrs[.size] as? Int) ?? 0

        guard let stored = storedChunks, stored.count % 32 == 0, !stored.isEmpty, totalSize > 0 else {
            try await client.put(path: path, fileURL: fileURL)
            return
        }

        let chunkSize = Self.chunkSize
        let nChunks = (totalSize + chunkSize - 1) / chunkSize
        let existingNChunks = stored.count / 32
        let fh = try FileHandle(forReadingFrom: fileURL)
        defer { try? fh.close() }

        var changedRanges: [(start: Int64, end: Int64)] = []  // [start, end) exclusive
        var rangeStart: Int? = nil

        for i in 0..<nChunks {
            let offset = i * chunkSize
            let len = min(chunkSize, totalSize - offset)
            try fh.seek(toOffset: UInt64(offset))
            let chunkData = try fh.read(upToCount: len)
            let newHash = Data(SHA256.hash(data: chunkData))

            let existingHash = i < existingNChunks
                ? stored.subdata(in: i * 32 ..< (i + 1) * 32)
                : Data()
            let changed = newHash != existingHash

            if changed && rangeStart == nil {
                rangeStart = i
            } else if !changed, let rs = rangeStart {
                changedRanges.append((Int64(rs * chunkSize), Int64(i * chunkSize)))
                rangeStart = nil
            }
        }
        if let rs = rangeStart {
            changedRanges.append((Int64(rs * chunkSize), Int64(totalSize)))
        }

        guard !changedRanges.isEmpty else { return }

        for range in changedRanges {
            let start = range.start
            let end = range.end   // exclusive byte offset
            try fh.seek(toOffset: UInt64(start))
            let data = try fh.read(upToCount: Int(end - start))
            // Content-Range end is inclusive
            try await client.putRange(path: path, data: data, start: start,
                                      end: end - 1, totalSize: Int64(totalSize))
        }
    }

    private func resolvedPath(for identifier: NSFileProviderItemIdentifier) throws -> String {
        if identifier == .rootContainer { return "/\(peergosUsername)" }
        guard let stored = registry.item(forIdentifier: identifier.rawValue) else {
            throw NSFileProviderError(.noSuchItem)
        }
        return stored.path
    }

    private func makeItem(from reg: RegistryItem) -> PeergosItem {
        PeergosItem(identifier: NSFileProviderItemIdentifier(reg.identifier),
                    parentIdentifier: NSFileProviderItemIdentifier(reg.parentIdentifier),
                    filename: reg.filename, isDirectory: reg.isDirectory,
                    size: reg.size, modificationDate: reg.modificationDate,
                    contentHash: reg.contentHash)
    }

    private func rootItem() -> PeergosItem {
        PeergosItem(identifier: .rootContainer, parentIdentifier: .rootContainer,
                    filename: peergosUsername, isDirectory: true,
                    size: nil, modificationDate: nil, contentHash: Data())
    }
}
