// Browsing into a zip archive from the drive view.
//
// An archive is not a real directory, so this is a mode of the drive rather than a new kind of
// file: the drive path is allowed to descend into a file whose mime type is application/zip, and
// its entries are rendered through the same table by presenting the same duck typed shape that
// buildCapWrapper produces. Because the archive is identified by its path, the breadcrumb, the
// url and the back button keep working exactly as they do for directories.
//
// Listing an archive of any size costs a read of its tail; opening one entry costs a seek and a
// read of only that entry. See peergos.shared.user.fs.archive.ZipReader.

const ZIP_MIMETYPE = "application/zip";

// An archive records no mime type for its entries, and reading the first bytes of each one to
// sniff it would cost a request per row, so the icon and the download type come from the name.
const MIMETYPE_BY_EXTENSION = {
    png: "image/png", jpg: "image/jpg", jpeg: "image/jpg", gif: "image/gif", bmp: "image/bmp",
    webp: "image/webp", svg: "image/svg+xml", ico: "image/x-icon", tif: "image/tiff",
    tiff: "image/tiff", heic: "image/heic", avif: "image/avif",
    mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", avi: "video/x-msvideo",
    mkv: "video/x-matroska", mpg: "video/mpeg", mpeg: "video/mpeg",
    mp3: "audio/mpeg", ogg: "audio/ogg", oga: "audio/ogg", wav: "audio/wav", flac: "audio/flac",
    m4a: "audio/mp4", opus: "audio/opus",
    pdf: "application/pdf", zip: "application/zip", gz: "application/x-gzip",
    tar: "application/x-tar", rar: "application/x-rar-compressed", "7z": "application/x-7z-compressed",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    odt: "application/vnd.oasis.opendocument.text",
    ods: "application/vnd.oasis.opendocument.spreadsheet",
    odp: "application/vnd.oasis.opendocument.presentation",
    txt: "text/plain", md: "text/x-markdown", log: "text/plain", csv: "text/csv",
    html: "text/html", htm: "text/html", css: "text/css", js: "text/javascript",
    json: "application/json", xml: "text/xml", yaml: "text/yaml", yml: "text/yaml",
    java: "text/x-java", py: "text/x-python", c: "text/x-c", h: "text/x-c", sh: "text/x-sh"
};

module.exports = {
    data() {
        return {
            // {reader, path: the archive's drive path, entry: the path within it, stamp, file}
            archive: null
        };
    },

    methods: {
        isArchiveFile(props) {
            return ! props.isDirectory && props.mimeType == ZIP_MIMETYPE;
        },

        archiveMimeType(name) {
            const dot = name.lastIndexOf(".");
            if (dot < 0)
                return "application/octet-stream";
            const mimeType = MIMETYPE_BY_EXTENSION[name.substring(dot + 1).toLowerCase()];
            return mimeType == null ? "application/octet-stream" : mimeType;
        },

        leaveArchive() {
            this.archive = null;
        },

        /** Enter, or move within, an archive, and list what is at entryPath.
         */
        openArchiveAt(file, filePath, entryPath, selectedFilename, callback) {
            const that = this;
            const props = file.getFileProperties();
            // the index is only valid for this version of the file
            const stamp = this.getFileSize(props) + "@" + props.modified.toString();
            const current = this.archive;
            if (current != null && current.path == filePath && current.stamp == stamp) {
                this.archive = {reader: current.reader, path: filePath, entry: entryPath, stamp: stamp, file: file};
                this.showArchiveEntries(selectedFilename, callback);
                return;
            }
            this.showSpinner = true;
            peergos.shared.user.fs.archive.ZipReader.openJS(file, this.context.network, this.context.crypto)
                .thenApply(function(reader) {
                    that.archive = {reader: reader, path: filePath, entry: entryPath, stamp: stamp, file: file};
                    that.showArchiveEntries(selectedFilename, callback);
                }).exceptionally(function(throwable) {
                    that.archive = null;
                    that.showSpinner = false;
                    that.$toast.error(that.translate("DRIVE.ARCHIVE.UNREADABLE") + " " + throwable.getMessage());
                    that.changePath(that.archiveParentPath(filePath));
                    return null;
                });
        },

        showArchiveEntries(selectedFilename, callback) {
            const that = this;
            const archive = this.archive;
            let entries;
            try {
                entries = archive.reader.listDirectoryJS(archive.entry);
            } catch (err) {
                this.showSpinner = false;
                this.$toast.error(this.translate("DRIVE.MISSING.FOLDER"));
                this.changePath(this.archiveParentPath(this.getPath));
                return;
            }
            this.files = entries.map(function(entry) {
                return that.buildArchiveEntry(archive, entry);
            });
            this.showSpinner = false;
            this.selectedFiles = selectedFilename == null ?
                [] :
                this.files.filter(function(f) { return f.getName() == selectedFilename; });
            if (callback != null)
                callback();
        },

        /** A drive path that resolves to nothing may still point inside an archive, so try
         *  successively shorter prefixes until one exists: if it is a zip file, the rest of the
         *  path is a path within it.
         */
        findArchive(candidate, remainder, onFound, onMissing) {
            const that = this;
            const index = candidate.lastIndexOf("/");
            if (index <= 0) { // no component left that could be a file
                onMissing();
                return;
            }
            this.context.getByPath(candidate).thenApply(function(fileOpt) {
                if (fileOpt.isPresent()) {
                    if (that.isArchiveFile(fileOpt.get().getFileProperties()))
                        onFound(fileOpt.get(), candidate, remainder);
                    else // a directory, or a file that isn't an archive: the path is simply wrong
                        onMissing();
                    return null;
                }
                const name = candidate.substring(index + 1);
                that.findArchive(candidate.substring(0, index),
                                 remainder.length == 0 ? name : name + "/" + remainder,
                                 onFound, onMissing);
                return null;
            }).exceptionally(function(throwable) {
                onMissing();
                return null;
            });
        },

        archiveParentPath(path) {
            if (path.endsWith("/"))
                path = path.substring(0, path.length - 1);
            const index = path.lastIndexOf("/");
            return index < 0 ? "/" : path.substring(0, index);
        },

        /** The same shape the drive table expects of a file, over a zip entry.
         */
        buildArchiveEntry(archive, entry) {
            const that = this;
            const name = entry.getName();
            const isDir = entry.isDirectory;
            const size = entry.getSize();
            const mimeType = isDir ? "" : this.archiveMimeType(name);
            const type = peergos.shared.user.fs.FileProperties.getType(mimeType, isDir);
            const childCount = isDir ? archive.reader.listDirectoryJS(entry.path).length : 0;
            return {
                isWrapper: false,
                isArchiveEntry: true,
                entry: entry,
                thumbnail: null,
                directChildrenCount: childCount,
                props: {
                    name: name,
                    isDirectory: isDir,
                    isHidden: false,
                    modified: entry.modified,
                    created: entry.modified,
                    thumbnail: {ref: null},
                    mimeType: mimeType,
                    getType: function() {
                        return type;
                    },
                    sizeLow: function() {
                        return size % 4294967296;
                    },
                    sizeHigh: function() {
                        return Math.floor(size / 4294967296);
                    }
                },
                getFileProperties: function() {
                    return this.props;
                },
                isDirectory: function() {
                    return isDir;
                },
                isWritable: function() {
                    return false;
                },
                getName: function() {
                    return name;
                },
                getBase64Thumbnail: function() {
                    return "";
                },
                getInputStream: function(net, crypto, sizeHigh, sizeLow, progress) {
                    return that.readArchiveEntry(archive, entry, progress);
                },
                getBufferedInputStream: function(net, crypto, sizeHigh, sizeLow, nChunks, progress) {
                    return that.readArchiveEntry(archive, entry, progress);
                },
                samePointer: function(other) {
                    return other.isArchiveEntry === true && other.entry.path == entry.path;
                },
                name: name
            };
        },

        /** A reader over one entry's decompressed bytes, reporting progress as they are read.
         */
        readArchiveEntry(archive, entry, progress) {
            return archive.reader.readJS(entry).thenApply(function(reader) {
                if (progress == null)
                    return reader;
                return {
                    readIntoArray: function(res, offset, length) {
                        return reader.readIntoArray(res, offset, length).thenApply(function(read) {
                            progress(read);
                            return read;
                        });
                    },
                    seek: function(high32, low32) {
                        return reader.seekJS(high32, low32);
                    },
                    reset: function() {
                        return reader.reset();
                    },
                    close: function() {
                        reader.close();
                    }
                };
            });
        }
    }
};
