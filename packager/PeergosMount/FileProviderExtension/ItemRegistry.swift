import Foundation
import SQLite3

struct RegistryItem {
    let identifier: String
    let path: String
    let parentIdentifier: String
    let filename: String
    let isDirectory: Bool
    let contentHash: Data
    let writerKey: String?
    let size: Int64
    let modificationDate: Date?
    let chunkHashes: Data?  // raw level1 ChunkHashList bytes (32 bytes per 5 MiB chunk)
}

// Thread-safe SQLite-backed store.
// Stores item metadata keyed by stable identifier (= WebDAV path for Peergos),
// writer entry paths for targeted change enumeration, and the current sync anchor.
class ItemRegistry {
    private var db: OpaquePointer?
    private let queue = DispatchQueue(label: "org.peergos.ItemRegistry")

    static func open() -> ItemRegistry {
        let r = ItemRegistry()
        r.openDB()
        return r
    }

    private func openDB() {
        guard let url = MountConfig.containerURL()?.appendingPathComponent("item_registry.sqlite") else { return }
        guard sqlite3_open(url.path, &db) == SQLITE_OK else { return }
        sqlite3_exec(db, "PRAGMA journal_mode=WAL", nil, nil, nil)
        createSchema()
    }

    private func createSchema() {
        let ddl = [
            """
            CREATE TABLE IF NOT EXISTS items (
                identifier      TEXT PRIMARY KEY,
                path            TEXT NOT NULL,
                parent_id       TEXT NOT NULL,
                filename        TEXT NOT NULL,
                is_directory    INTEGER NOT NULL,
                content_hash    BLOB,
                writer_key      TEXT,
                size            INTEGER NOT NULL DEFAULT 0,
                mod_date        REAL,
                chunk_hashes    BLOB
            )
            """,
            "ALTER TABLE items ADD COLUMN chunk_hashes BLOB",
            "CREATE INDEX IF NOT EXISTS idx_items_path ON items(path)",
            "CREATE INDEX IF NOT EXISTS idx_items_parent ON items(parent_id)",
            """
            CREATE TABLE IF NOT EXISTS writer_entry_paths (
                writer_key  TEXT PRIMARY KEY,
                entry_path  TEXT NOT NULL
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS sync_anchor (
                id              INTEGER PRIMARY KEY CHECK (id = 1),
                snapshot_json   TEXT NOT NULL
            )
            """,
        ]
        for sql in ddl { sqlite3_exec(db, sql, nil, nil, nil) }
    }

    func upsert(_ item: RegistryItem) {
        queue.sync {
            let sql = """
                INSERT OR REPLACE INTO items
                  (identifier, path, parent_id, filename, is_directory, content_hash, writer_key, size, mod_date, chunk_hashes)
                VALUES (?,?,?,?,?,?,?,?,?,?)
            """
            withStatement(sql) { stmt in
                sqlite3_bind_text(stmt, 1, item.identifier, -1, SQLITE_TRANSIENT)
                sqlite3_bind_text(stmt, 2, item.path,       -1, SQLITE_TRANSIENT)
                sqlite3_bind_text(stmt, 3, item.parentIdentifier, -1, SQLITE_TRANSIENT)
                sqlite3_bind_text(stmt, 4, item.filename,   -1, SQLITE_TRANSIENT)
                sqlite3_bind_int(stmt,  5, item.isDirectory ? 1 : 0)
                item.contentHash.withUnsafeBytes { ptr in
                    sqlite3_bind_blob(stmt, 6, ptr.baseAddress, Int32(item.contentHash.count), SQLITE_TRANSIENT)
                }
                if let wk = item.writerKey { sqlite3_bind_text(stmt, 7, wk, -1, SQLITE_TRANSIENT) }
                else { sqlite3_bind_null(stmt, 7) }
                sqlite3_bind_int64(stmt, 8, item.size)
                if let d = item.modificationDate { sqlite3_bind_double(stmt, 9, d.timeIntervalSince1970) }
                else { sqlite3_bind_null(stmt, 9) }
                if let ch = item.chunkHashes { ch.withUnsafeBytes { ptr in
                    sqlite3_bind_blob(stmt, 10, ptr.baseAddress, Int32(ch.count), SQLITE_TRANSIENT)
                }} else { sqlite3_bind_null(stmt, 10) }
                sqlite3_step(stmt)
            }
        }
    }

    func item(forIdentifier id: String) -> RegistryItem? {
        queue.sync { fetchOne("SELECT * FROM items WHERE identifier = ?", bind: id) }
    }

    func item(forPath path: String) -> RegistryItem? {
        queue.sync { fetchOne("SELECT * FROM items WHERE path = ?", bind: path) }
    }

    func children(ofIdentifier parentId: String) -> [RegistryItem] {
        queue.sync {
            var results: [RegistryItem] = []
            withStatement("SELECT * FROM items WHERE parent_id = ? AND identifier != ?") { stmt in
                sqlite3_bind_text(stmt, 1, parentId, -1, SQLITE_TRANSIENT)
                sqlite3_bind_text(stmt, 2, parentId, -1, SQLITE_TRANSIENT)
                while sqlite3_step(stmt) == SQLITE_ROW { results.append(rowToItem(stmt)) }
            }
            return results
        }
    }

    func delete(identifier: String) {
        queue.sync {
            withStatement("DELETE FROM items WHERE identifier = ?") { stmt in
                sqlite3_bind_text(stmt, 1, identifier, -1, SQLITE_TRANSIENT)
                sqlite3_step(stmt)
            }
        }
    }

    func allIdentifiers() -> Set<String> {
        queue.sync {
            var result: Set<String> = []
            withStatement("SELECT identifier FROM items") { stmt in
                while sqlite3_step(stmt) == SQLITE_ROW {
                    if let ptr = sqlite3_column_text(stmt, 0) { result.insert(String(cString: ptr)) }
                }
            }
            return result
        }
    }

    // MARK: Writer entry paths

    func setEntryPath(_ path: String, forWriterKey key: String) {
        queue.sync {
            withStatement("INSERT OR REPLACE INTO writer_entry_paths (writer_key, entry_path) VALUES (?,?)") { stmt in
                sqlite3_bind_text(stmt, 1, key, -1, SQLITE_TRANSIENT)
                sqlite3_bind_text(stmt, 2, path, -1, SQLITE_TRANSIENT)
                sqlite3_step(stmt)
            }
        }
    }

    func entryPath(forWriterKey key: String) -> String? {
        queue.sync {
            var result: String? = nil
            withStatement("SELECT entry_path FROM writer_entry_paths WHERE writer_key = ?") { stmt in
                sqlite3_bind_text(stmt, 1, key, -1, SQLITE_TRANSIENT)
                if sqlite3_step(stmt) == SQLITE_ROW, let ptr = sqlite3_column_text(stmt, 0) {
                    result = String(cString: ptr)
                }
            }
            return result
        }
    }

    // MARK: Sync anchor

    func storedAnchor() -> WriterSnapshot? {
        queue.sync {
            var result: WriterSnapshot? = nil
            withStatement("SELECT snapshot_json FROM sync_anchor WHERE id = 1") { stmt in
                if sqlite3_step(stmt) == SQLITE_ROW, let ptr = sqlite3_column_text(stmt, 0) {
                    result = WriterSnapshot.deserialise(Data(String(cString: ptr).utf8))
                }
            }
            return result
        }
    }

    func setAnchor(_ snapshot: WriterSnapshot) {
        queue.sync {
            let json = String(data: snapshot.serialised(), encoding: .utf8) ?? "{}"
            withStatement("INSERT OR REPLACE INTO sync_anchor (id, snapshot_json) VALUES (1,?)") { stmt in
                sqlite3_bind_text(stmt, 1, json, -1, SQLITE_TRANSIENT)
                sqlite3_step(stmt)
            }
        }
    }

    // MARK: Helpers

    private func fetchOne(_ sql: String, bind: String) -> RegistryItem? {
        var result: RegistryItem? = nil
        withStatement(sql) { stmt in
            sqlite3_bind_text(stmt, 1, bind, -1, SQLITE_TRANSIENT)
            if sqlite3_step(stmt) == SQLITE_ROW { result = rowToItem(stmt) }
        }
        return result
    }

    private func withStatement(_ sql: String, body: (OpaquePointer?) -> Void) {
        var stmt: OpaquePointer?
        guard sqlite3_prepare_v2(db, sql, -1, &stmt, nil) == SQLITE_OK else { return }
        defer { sqlite3_finalize(stmt) }
        body(stmt)
    }

    private func rowToItem(_ stmt: OpaquePointer?) -> RegistryItem {
        func str(_ col: Int32) -> String { String(cString: sqlite3_column_text(stmt, col)) }
        func blob(_ col: Int32) -> Data? {
            let len = Int(sqlite3_column_bytes(stmt, col))
            return sqlite3_column_blob(stmt, col).map { Data(bytes: $0, count: len) }
        }
        let wk = sqlite3_column_type(stmt, 6) != SQLITE_NULL
            ? String(cString: sqlite3_column_text(stmt, 6)) : nil
        let modTs = sqlite3_column_double(stmt, 8)
        return RegistryItem(
            identifier:       str(0),
            path:             str(1),
            parentIdentifier: str(2),
            filename:         str(3),
            isDirectory:      sqlite3_column_int(stmt, 4) != 0,
            contentHash:      blob(5) ?? Data(),
            writerKey:        wk,
            size:             sqlite3_column_int64(stmt, 7),
            modificationDate: modTs > 0 ? Date(timeIntervalSince1970: modTs) : nil,
            chunkHashes:      blob(9)
        )
    }

    deinit { sqlite3_close(db) }
}
