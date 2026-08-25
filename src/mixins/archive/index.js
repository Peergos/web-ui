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

const ProgressBar = require("../../components/drive/ProgressBar.vue");
const storage = require("../storage/index.js");

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

        /** Download a directory inside an archive as a new zip, which is the only way to get a
         *  whole folder out: there is no capability to it to share or copy.
         */
        downloadArchiveFolder() {
            if (this.selectedFiles.length != 1)
                return;
            this.closeMenu();
            const folder = this.selectedFiles[0];
            this.downloadArchiveAsZip(this.collectArchiveFiles(folder.entry.path, folder.getName()),
                    folder.getName() + ".zip",
                    this.translate("DRIVE.DOWNLOAD.FOLDER").replace("$NAME", folder.getName()));
        },

        /** The same for a selection, which may mix entries and directories.
         */
        downloadArchiveSelection() {
            const that = this;
            const files = [];
            this.selectedFiles.forEach(function(selected) {
                if (selected.isDirectory())
                    files.push.apply(files, that.collectArchiveFiles(selected.entry.path, selected.getName()));
                else
                    files.push({path: "", file: selected});
            });
            const name = this.archive.file.getName().replace(/\.zip$/i, "") + "-selection.zip";
            this.downloadArchiveAsZip(files, name, this.translate("DRIVE.DOWNLOAD.FOLDERS"));
        },

        downloadArchiveAsZip(files, zipFilename, title) {
            const that = this;
            if (files.length == 0) {
                this.$toast(this.translate("DRIVE.EMPTY.FOLDER").replace("$NAME", zipFilename));
                return;
            }
            let total = 0;
            files.forEach(function(f) {
                total += that.getFileSize(f.file.getFileProperties());
            });
            const progress = {
                show: true,
                title: title,
                done: 0,
                max: total,
                startTime: Date.now()
            };
            this.$toast({component: ProgressBar, props: progress}, {icon: false, timeout: false, id: zipFilename});
            this.zipFiles(zipFilename, files, progress).thenApply(function(res) {
                that.selectedFiles = [];
                return res;
            }).exceptionally(function(throwable) {
                that.$toast.error(throwable.getMessage());
                return null;
            });
        },

        /** Copy an entry, or a whole directory of them, out of the archive into a Peergos folder.
         *
         *  There is no capability to an entry inside an archive, so this is not a copy in the
         *  Peergos sense: every byte is read, decompressed and uploaded again, client side.
         */
        pasteFromArchive(target, clipboard) {
            const that = this;
            const archive = clipboard.archiveCopy.archive;
            const entry = clipboard.archiveCopy.entry;
            const targetPath = target === this.currentDir ?
                    this.getPath :
                    this.getPath + target.getFileProperties().name;

            const files = entry.isDirectory ?
                    this.collectArchiveEntries(archive, entry.path, entry.getName()) :
                    [{path: "", entry: entry}];
            if (files.length == 0) {
                this.$toast(this.translate("DRIVE.EMPTY.FOLDER").replace("$NAME", entry.getName()));
                return;
            }
            let total = 0;
            files.forEach(function(f) {
                total += f.entry.getSize();
            });
            const spaceAfter = this.checkAvailableSpace(total);
            if (spaceAfter < 0) {
                this.$toast.error(this.translate("DRIVE.COPY.SPACE.ERROR")
                        .replace("$SPACE", storage.convertBytesToHumanReadable('' + -spaceAfter)),
                    {timeout: false, id: 'upload'});
                return;
            }

            const toastId = 'archive-copy-' + entry.getName();
            const progress = {
                show: true,
                title: this.translate("DRIVE.COPYING.TITLE"),
                stats: '',
                done: 0,
                max: total,
                startTime: Date.now(),
                lastUpdateTime: 0
            };
            this.$toast({component: ProgressBar, props: progress}, {icon: false, timeout: false, id: toastId});
            const future = peergos.shared.util.Futures.incomplete();
            this.copyNextArchiveFile(archive, targetPath, files, 0, progress, toastId, future);
            future.thenApply(function(res) {
                that.$toast.dismiss(toastId);
                that.selectedFiles = [];
                that.updateUsage();
                that.updateCurrentDir();
                return res;
            }).exceptionally(function(throwable) {
                that.$toast.dismiss(toastId);
                that.$toast.error(throwable.getMessage(), {timeout: false});
                that.updateCurrentDir();
                return null;
            });
        },

        copyNextArchiveFile(archive, targetPath, files, index, progress, toastId, future) {
            const that = this;
            if (index == files.length) {
                future.complete(true);
                return;
            }
            const item = files[index];
            const directory = item.path == "" ? targetPath : targetPath + "/" + item.path;
            this.ensureDirectory(directory).thenCompose(function(dir) {
                return that.uploadArchiveFile(archive, dir, item.entry, progress, toastId);
            }).thenApply(function(res) {
                that.copyNextArchiveFile(archive, targetPath, files, index + 1, progress, toastId, future);
                return res;
            }).exceptionally(function(throwable) {
                future.completeExceptionally(throwable);
                return null;
            });
        },

        uploadArchiveFile(archive, dir, entry, progress, toastId) {
            const that = this;
            const size = entry.getSize();
            let low = size % 4294967296;
            if (low > 2147483647)
                low -= 4294967296;
            const high = Math.floor(size / 4294967296);
            return archive.reader.readJS(entry).thenCompose(function(reader) {
                return dir.uploadFileJS(entry.getName(), reader, high, low, true,
                    that.getMirrorBatId(dir), that.context.network, that.context.crypto,
                    function(read) {
                        progress.done += read.value_0;
                        const now = Date.now();
                        if (now - progress.lastUpdateTime > 500) {
                            progress.lastUpdateTime = now;
                            progress.stats = storage.formatTransferStats(progress.done, progress.max, progress.startTime);
                            that.$toast.update(toastId, {content: {component: ProgressBar, props: {
                                title: progress.title,
                                stats: progress.stats,
                                done: progress.done,
                                max: progress.max
                            }}});
                        }
                    },
                    that.context.getTransactionService(),
                    function(f) {
                        return peergos.shared.util.Futures.of(false);
                    });
            });
        },

        /** The directory at a path, creating it and any missing parent if it isn't there yet.
         */
        ensureDirectory(path) {
            const that = this;
            const trimmed = path.endsWith("/") ? path.substring(0, path.length - 1) : path;
            const future = peergos.shared.util.Futures.incomplete();
            this.context.getByPath(trimmed).thenApply(function(existing) {
                if (existing.isPresent()) {
                    future.complete(existing.get());
                    return null;
                }
                const index = trimmed.lastIndexOf("/");
                const name = trimmed.substring(index + 1);
                that.ensureDirectory(trimmed.substring(0, index))
                    .thenCompose(function(parent) {
                        return parent.mkdir(name, that.context.network, false,
                                that.getMirrorBatId(parent), that.context.crypto);
                    })
                    .thenCompose(function(updated) {
                        return that.context.getByPath(trimmed);
                    })
                    .thenApply(function(created) {
                        future.complete(created.get());
                        return created;
                    })
                    .exceptionally(function(throwable) {
                        future.completeExceptionally(throwable);
                        return null;
                    });
                return null;
            }).exceptionally(function(throwable) {
                future.completeExceptionally(throwable);
                return null;
            });
            return future;
        },

        /** Every file entry under a directory in the archive, with its path relative to that
         *  directory's parent.
         */
        collectArchiveEntries(archive, entryPath, relativePath) {
            const res = [];
            const children = archive.reader.listDirectoryJS(entryPath);
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (child.isDirectory)
                    res.push.apply(res, this.collectArchiveEntries(archive, child.path,
                            relativePath + "/" + child.getName()));
                else
                    res.push({path: relativePath, entry: child});
            }
            return res;
        },

        /** Every file under a directory in the archive, each with its path relative to that
         *  directory's parent, which is the shape the zip writer wants.
         */
        collectArchiveFiles(entryPath, relativePath) {
            const archive = this.archive;
            const res = [];
            const children = archive.reader.listDirectoryJS(entryPath);
            for (let i = 0; i < children.length; i++) {
                const child = children[i];
                if (child.isDirectory)
                    res.push.apply(res, this.collectArchiveFiles(child.path, relativePath + "/" + child.getName()));
                else
                    res.push({path: relativePath, file: this.buildArchiveEntry(archive, child)});
            }
            return res;
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
