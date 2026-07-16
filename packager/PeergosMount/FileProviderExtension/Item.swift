import FileProvider
import Foundation
import UniformTypeIdentifiers

class PeergosItem: NSObject, NSFileProviderItem {
    let itemIdentifier: NSFileProviderItemIdentifier
    let parentItemIdentifier: NSFileProviderItemIdentifier
    let filename: String
    let isDirectory: Bool
    let documentSize: NSNumber?
    let contentModificationDate: Date?
    let itemVersion: NSFileProviderItemVersion

    init(identifier: NSFileProviderItemIdentifier,
         parentIdentifier: NSFileProviderItemIdentifier,
         filename: String,
         isDirectory: Bool,
         size: Int64?,
         modificationDate: Date?,
         contentHash: Data) {
        self.itemIdentifier = identifier
        self.parentItemIdentifier = parentIdentifier
        self.filename = filename
        self.isDirectory = isDirectory
        self.documentSize = size.map { NSNumber(value: $0) }
        self.contentModificationDate = modificationDate
        // Directories carry no treehash; use empty data so the system always enumerates them.
        self.itemVersion = NSFileProviderItemVersion(contentVersion: contentHash,
                                                     metadataVersion: contentHash)
        super.init()
    }

    var typeIdentifier: String {
        if isDirectory { return UTType.folder.identifier }
        let ext = (filename as NSString).pathExtension
        return UTType(filenameExtension: ext)?.identifier ?? UTType.data.identifier
    }

    var capabilities: NSFileProviderItemCapabilities {
        var caps: NSFileProviderItemCapabilities = [
            .allowsReading, .allowsDeleting, .allowsTrashing,
            .allowsRenaming, .allowsReparenting,
        ]
        if isDirectory {
            caps.formUnion([.allowsAddingSubItems, .allowsContentEnumerating])
        } else {
            caps.insert(.allowsWriting)
        }
        return caps
    }

    // Tell the system not to eagerly download file content.
    var contentPolicy: NSFileProviderContentPolicy { .downloadLazily }
}
