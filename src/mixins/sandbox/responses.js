// How a sandbox host answers the sandbox's service worker: each response is one
// framed message (mode, path + request id, mime type, etag, optional size) followed
// by the body. Shared by the full app host (AppSandbox) and its feed tile (AppTile),
// which each supply postData(bytes) and context.
module.exports = {
    data() {
        return {
            FILE_NOT_FOUND: 2,
            ACTION_FAILED: 3,
            DELETE_SUCCESS: 4,
            DIRECTORY_NOT_FOUND: 5,
            CREATE_SUCCESS: 6,
            UPDATE_SUCCESS: 7,
            GET_SUCCESS: 8,
            PATCH_SUCCESS: 9,
            NAVIGATE_TO: 10,
            FORBIDDEN: 13,
        };
    },
    methods: {
        fixMimeType: function (filePath, mimeTypeInput) {
            var mimeType = "application/octet-stream";
            if (mimeTypeInput != null && mimeTypeInput.trim().length > 0) {
                if (filePath.toLowerCase().endsWith('.html')) {
                    mimeType = "text/html";
                } else if (filePath.toLowerCase().endsWith('.css')) {
                    mimeType = "text/css";
                } else if (filePath.toLowerCase().endsWith('.js')) {
                    mimeType = "text/javascript";
                } else if (filePath.toLowerCase().endsWith('.wasm')) {
                    mimeType = "application/wasm";
                } else {
                    let lastSlashIdx = filePath.lastIndexOf('/');
                    let dotIndex =  filePath.indexOf('.', lastSlashIdx);
                    if (dotIndex == -1 && mimeTypeInput.startsWith('text/')) {
                        mimeType = "text/html";
                    } else {
                        mimeType = mimeTypeInput;
                    }
                }
            }
            return mimeType;
        },
        buildHeader: function(filePath, mimeTypeInput, requestId, streamingInfo, etag = null) {
            return this.buildHeaderWithMime(filePath, this.fixMimeType(filePath, mimeTypeInput), requestId, streamingInfo, etag);
        },
        // The mime type exactly as given, for a body that is not one of the app's own files.
        buildHeaderWithMime: function(filePath, mimeType, requestId, streamingInfo, etag = null) {
            let encoder = new TextEncoder();
            let filePathBytes = encoder.encode(filePath + requestId);
            let mimeTypeBytes = encoder.encode(mimeType);
            let etagBytes = etag ? encoder.encode(etag) : new Uint8Array(0);
            let pathSize = filePathBytes.byteLength;
            if (pathSize >= 255) {
                throw new Error("Path too long!");
            }
            let mimeTypeSize = mimeTypeBytes.byteLength;
            if (mimeTypeSize >= 255) {
                throw new Error("MimeType too long!");
            }
            let etagSize = etagBytes.byteLength;
            var headerSize = 1 + 1 + pathSize + 1 + mimeTypeSize + 1 + etagSize;
            let sizeHighBytes = 0;
            let sizeLowBytes = 0;
            if (streamingInfo != null) {
                sizeHighBytes = this.writeUnsignedLeb128(streamingInfo.sizeHigh);
                sizeLowBytes = this.writeUnsignedLeb128(streamingInfo.sizeLow);
                headerSize = headerSize + sizeHighBytes.byteLength + sizeLowBytes.byteLength;
            }
            var data = new Uint8Array(headerSize);
            var offset = 0;
            var mode = 0;
            if (streamingInfo != null) {
                if (streamingInfo.headOnly) {
                    mode = 12;
                } else if (streamingInfo.appFileStreaming) {
                    mode = 11;
                } else {
                    mode = 1;
                }
            }
            data.set([mode], offset); //status code (or mode)
            offset = offset + 1;
            data.set([pathSize], offset);
            offset = offset + 1;
            data.set(filePathBytes, offset);
            offset = offset + pathSize;
            data.set([mimeTypeSize], offset);
            offset = offset + 1;
            data.set(mimeTypeBytes, offset);
            offset = offset + mimeTypeSize;
            data.set([etagSize], offset);
            offset = offset + 1;
            if (etagSize > 0) {
                data.set(etagBytes, offset);
                offset = offset + etagSize;
            }
            if (streamingInfo != null) {
                data.set(sizeHighBytes, offset);
                offset = offset + sizeHighBytes.byteLength;
                data.set(sizeLowBytes, offset);
            }
            return data;
        },
        buildResponse: function(header, body, mode) {
            var bytes = body == null ? new Uint8Array(header.byteLength)
                : new Uint8Array(body.byteLength + header.byteLength);
            for(var i=0;i < header.byteLength;i++){
                bytes[i] = header[i];
            }
            if (body != null) {
                for(var j=0;j < body.byteLength;j++){
                    bytes[i+j] = body[j];
                }
            }
            bytes[0] = mode;
            let data = convertToByteArray(bytes);
            this.postData(data);
        },
        readInFile: function(headerFunc, file) {
            let that = this;
            let props = file.getFileProperties();
            let size = props.sizeLow();
            let treeHash = props.treeHash;
            let etag = treeHash.isPresent() ? '"' + treeHash.get().toString() + '"' : null;
            let maxChunkSize = 1024 * 1024 * 10;
            if (headerFunc.isHead) {
                // answer HEAD from the file properties without reading the file
                let headInfo = {sizeHigh: props.sizeHigh(), sizeLow: props.sizeLow(), headOnly: true};
                that.postData(convertToByteArray(headerFunc(props.mimeType, headInfo, etag)));
            } else if (size < maxChunkSize) {
                let header = headerFunc(props.mimeType, null, etag);
                file.getLatest(this.context.network).thenApply(updatedFile => {
                    updatedFile.getInputStream(that.context.network, that.context.crypto, props.sizeHigh(), props.sizeLow(), read => {}).thenApply(reader => {
                        var bytes = new Uint8Array(size + header.byteLength);
                        for(var i=0;i < header.byteLength;i++){
                            bytes[i] = header[i];
                        }
                        let data = convertToByteArray(bytes);
                        reader.readIntoArray(data, header.byteLength, size).thenApply(function(read){
                            that.postData(data);
                        });
                    });
                });
            } else if(props.sizeHigh() > 0) {
                let header = headerFunc(props.mimeType);
                that.buildResponse(header, null, that.ACTION_FAILED);
            } else {
                let streamingInfo = {sizeHigh: props.sizeHigh(), sizeLow: props.sizeLow(), appFileStreaming: true};
                let header = headerFunc(props.mimeType, streamingInfo, etag);
                file.getLatest(this.context.network).thenApply(updatedFile => {
                    updatedFile.getBufferedInputStream(that.context.network, that.context.crypto, props.sizeHigh(), props.sizeLow(), 10, read => {}).thenApply(reader => {
                        var currentSize = props.sizeLow();
                        var blockSize = currentSize > maxChunkSize ? maxChunkSize : currentSize;
                        var pump = function() {
                            if(blockSize > 0) {
                                var bytes = new Uint8Array(blockSize + header.byteLength);
                                for(var i=0;i < header.byteLength;i++){
                                    bytes[i] = header[i];
                                }
                                var data = convertToByteArray(bytes);
                                reader.readIntoArray(data, header.byteLength, blockSize).thenApply(function(read){
                                    currentSize = currentSize - read.value_0;
                                    blockSize = currentSize > maxChunkSize ? maxChunkSize : currentSize;
                                    that.postData(data);
                                    Vue.nextTick(function() {
                                        pump();
                                    });
                                });
                            }
                        }
                        pump();
                    });
                });
            }
        },
        writeUnsignedLeb128: function(value) {
            let out = [];
            var remaining = value >>> 7;
            while (remaining != 0) {
                out.push((value & 0x7f) | 0x80);
                value = remaining;
                remaining >>>= 7;
            }
            out.push(value & 0x7f);
            let array = new Uint8Array(new ArrayBuffer(out.length));
            for(var i = 0; i < out.length; i++) {
                array[i] = out[i];
            }
            return array;
        }
    },
};
