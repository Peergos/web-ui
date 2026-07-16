import FileProvider
import Foundation

class PeergosEnumerator: NSObject, NSFileProviderEnumerator {
    private let containerIdentifier: NSFileProviderItemIdentifier
    private let client: WebDAVClient
    private let registry: ItemRegistry
    private let rootPath: String   // e.g. "/alice"

    init(containerIdentifier: NSFileProviderItemIdentifier,
         client: WebDAVClient,
         registry: ItemRegistry,
         peergosUsername: String) {
        self.containerIdentifier = containerIdentifier
        self.client = client
        self.registry = registry
        self.rootPath = "/\(peergosUsername)"
    }

    func invalidate() {}

    // MARK: - Flat enumeration (called for initial listing and re-sync)

    func enumerateItems(for observer: NSFileProviderEnumerationObserver,
                        startingAt page: NSFileProviderPage) {
        Task {
            do {
                let path = try resolvePath(for: containerIdentifier)
                let davItems = try await client.propfind(path: path)
                let items = davItems.map { registerAndMake($0, parentIdentifier: containerIdentifier) }
                observer.didEnumerate(items)
                observer.finishEnumerating(upTo: nil)
            } catch {
                observer.finishEnumeratingWithError(error)
            }
        }
    }

    // MARK: - Change enumeration (incremental, anchor-based)

    func enumerateChanges(for observer: NSFileProviderChangeObserver,
                          from anchor: NSFileProviderSyncAnchor) {
        Task {
            do {
                let currentSnapshot = try await client.snapshot()

                guard let storedAnchor = registry.storedAnchor() else {
                    // No anchor yet — signal a full re-enumeration rather than enumerating changes.
                    let newAnchor = NSFileProviderSyncAnchor(currentSnapshot.serialised())
                    observer.finishEnumeratingChanges(upTo: newAnchor, moreComing: false)
                    return
                }

                let changedWriters = currentSnapshot.entries.filter { storedAnchor.entries[$0.key] != $0.value }
                let newWriters     = currentSnapshot.entries.filter { storedAnchor.entries[$0.key] == nil }

                if changedWriters.isEmpty && newWriters.isEmpty {
                    registry.setAnchor(currentSnapshot)
                    let newAnchor = NSFileProviderSyncAnchor(currentSnapshot.serialised())
                    observer.finishEnumeratingChanges(upTo: newAnchor, moreComing: false)
                    return
                }

                var updatedItems: [NSFileProviderItem] = []
                var deletedIds:   [NSFileProviderItemIdentifier] = []
                var seenPaths = Set<String>()

                for (writerKey, _) in changedWriters {
                    guard let entryPath = registry.entryPath(forWriterKey: writerKey) else { continue }
                    try await collectChanges(from: entryPath, seenPaths: &seenPaths,
                                            updated: &updatedItems, deleted: &deletedIds)
                }

                // New writers — their entry paths aren't in the registry yet; walk from root.
                if !newWriters.isEmpty {
                    try await collectChanges(from: rootPath, seenPaths: &seenPaths,
                                            updated: &updatedItems, deleted: &deletedIds)
                }

                if !updatedItems.isEmpty { observer.didUpdate(updatedItems) }
                if !deletedIds.isEmpty   { observer.didDeleteItems(withIdentifiers: deletedIds) }

                registry.setAnchor(currentSnapshot)
                let newAnchor = NSFileProviderSyncAnchor(currentSnapshot.serialised())
                observer.finishEnumeratingChanges(upTo: newAnchor, moreComing: false)
            } catch {
                observer.finishEnumeratingWithError(error)
            }
        }
    }

    func currentSyncAnchor(completionHandler: @escaping (NSFileProviderSyncAnchor?) -> Void) {
        if let stored = registry.storedAnchor() {
            completionHandler(NSFileProviderSyncAnchor(stored.serialised()))
        } else {
            completionHandler(nil)
        }
    }

    // MARK: - Helpers

    private func collectChanges(from path: String,
                                seenPaths: inout Set<String>,
                                updated: inout [NSFileProviderItem],
                                deleted: inout [NSFileProviderItemIdentifier]) async throws {
        let parentIdentifier = identifierFor(path: path)
        let davItems = try await client.propfind(path: path)

        for dav in davItems {
            seenPaths.insert(dav.path)
            let stored = registry.item(forPath: dav.path)
            let item = registerAndMake(dav, parentIdentifier: parentIdentifier)
            if stored == nil || stored!.contentHash != dav.contentHash {
                updated.append(item)
            }
            if dav.isDirectory {
                try await collectChanges(from: dav.path, seenPaths: &seenPaths,
                                         updated: &updated, deleted: &deleted)
            }
        }

        // Report deletions: registry children no longer returned by server.
        for child in registry.children(ofIdentifier: parentIdentifier.rawValue)
            where !seenPaths.contains(child.path) {
            deleted.append(NSFileProviderItemIdentifier(child.identifier))
            registry.delete(identifier: child.identifier)
        }
    }

    private func registerAndMake(_ dav: WebDAVItem,
                                 parentIdentifier: NSFileProviderItemIdentifier) -> PeergosItem {
        let identifier = identifierFor(path: dav.path)

        if let wk = dav.writerKey, registry.entryPath(forWriterKey: wk) == nil {
            registry.setEntryPath(dav.path, forWriterKey: wk)
        }

        registry.upsert(RegistryItem(
            identifier:       identifier.rawValue,
            path:             dav.path,
            parentIdentifier: parentIdentifier.rawValue,
            filename:         dav.filename,
            isDirectory:      dav.isDirectory,
            contentHash:      dav.contentHash,
            writerKey:        dav.writerKey,
            size:             dav.size,
            modificationDate: dav.modificationDate,
            chunkHashes:      dav.chunkHashes
        ))

        return PeergosItem(identifier: identifier, parentIdentifier: parentIdentifier,
                           filename: dav.filename, isDirectory: dav.isDirectory,
                           size: dav.size, modificationDate: dav.modificationDate,
                           contentHash: dav.contentHash)
    }

    private func resolvePath(for identifier: NSFileProviderItemIdentifier) throws -> String {
        if identifier == .rootContainer { return rootPath }
        guard let item = registry.item(forIdentifier: identifier.rawValue) else {
            throw NSFileProviderError(.noSuchItem)
        }
        return item.path
    }

    private func identifierFor(path: String) -> NSFileProviderItemIdentifier {
        if path == rootPath { return .rootContainer }
        // Use the WebDAV path as the stable identifier — Peergos paths don't change under the hood.
        return NSFileProviderItemIdentifier(path)
    }
}
