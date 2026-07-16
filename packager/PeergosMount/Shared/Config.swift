import Foundation

struct MountConfig: Codable {
    let port: Int
    let webdavUsername: String
    let webdavPassword: String
    let peergosUsername: String

    static let configFilename   = "webdav-config.json"
    static let snapshotFilename = "writer-snapshot.json"

    static func containerURL() -> URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: kAppGroupID)
    }

    static func load() -> MountConfig? {
        guard let url = containerURL()?.appendingPathComponent(configFilename),
              let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(MountConfig.self, from: data)
    }
}

// Opaque sync anchor: the { writerKey -> mutablePointerHash } snapshot serialised as JSON.
struct WriterSnapshot {
    let entries: [String: String]

    func serialised() -> Data {
        (try? JSONSerialization.data(withJSONObject: entries)) ?? Data()
    }

    static func deserialise(_ data: Data) -> WriterSnapshot? {
        guard let dict = try? JSONSerialization.jsonObject(with: data) as? [String: String] else { return nil }
        return WriterSnapshot(entries: dict)
    }
}
