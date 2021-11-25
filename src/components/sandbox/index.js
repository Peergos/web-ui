module.exports = {
    template: require('sandbox.html'),
    data: function() {
        return {
            showSpinner: false,
            spinnerMessage: '',
            maxBlockSize: 1024 * 1024 * 5,
            sandboxShutdownOK: false,
            indexHTML: null,
            peergosUserToken: "/$peergos-user",
            peergosAppToken: "/apps/sandbox/",
            sandboxedApp: null,
            FILE_NOT_FOUND: 2,
            ACTION_FAILED: 3,
            DELETE_SUCCESS: 4,
            DIRECTORY_NOT_FOUND: 5,
            CREATE_SUCCESS: 6,
            UPDATE_SUCCESS: 7,
            GET_SUCCESS: 8,
            addressBarText: '',
            bookmarks: new Map(),
            displayToBookmark : true,
            showPrompt: false,
            prompt_message: '',
            prompt_placeholder: '',
            prompt_max_input_size: 20,
            prompt_value: '',
            prompt_consumer_func: () => {},
            isIframeInitialised: false
        }
    },
    props: ['context', 'appName', 'appFilePath', 'messages'],
    created: function() {
        let that = this;
        this.indexHTML = this.appName + "/assets/index.html";
        if (!this.supportsStreaming()) {
            this.giveUp();
        } else {
            peergos.shared.user.App.init(that.context, this.appName).thenApply(sandboxedApp => {
                that.sandboxedApp = sandboxedApp;
                that.loadBrowserBookmarks().thenApply(done => {
                    that.startListener();
                });
            });
        }
    },
    methods: {
    	giveUp: function() {
            this.showMessage('Your Web browser does not support sandbox applications :(');
            this.$emit("hide-sandbox");
    	},
    	supportsStreaming: function() {
            try {
                //see https://github.com/jimmywarting/StreamSaver.js/issues/69
                //safari is getting writable streams, but unable to use them due to issues
                let safari = /constructor/i.test(window.HTMLElement) || !!window.safari || !!window.WebKitPoint
    		    return !safari && 'serviceWorker' in navigator && !!new ReadableStream() && !!new WritableStream()
            } catch(err) {
    		    return false;
            }
    	},
        loadBrowserBookmarks: function() {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            if (that.appName == 'browser') {
                let dataPath = peergos.client.PathUtils.directoryToPath(['bookmarks.dat']);
                this.sandboxedApp.readInternal(dataPath).thenApply(data => {
                    if (data.byteLength == 2) { //empty file
                        future.complete(false);
                    } else {
                        let bookmarks = new TextDecoder().decode(data);
                        let items = JSON.parse(bookmarks);
                        items.forEach(item => {
                           that.bookmarks.set(item.link, item);
                        });
                        future.complete(true);
                    }
                }).exceptionally(function(throwable) {
                    future.complete(false);
                });
            } else {
                future.complete(true);
            }
            return future;
        },
        frameUrl: function() {
            let url= this.frameDomain() + "/apps/sandbox/sandbox.html";
            return url;
        },
        frameDomain: function() {
            return window.location.protocol + "//sandbox." + window.location.host;
        },
        postMessage: function(obj) {
            let iframe = document.getElementById("sandboxId");
            iframe.contentWindow.postMessage(obj, '*');
        },
        messageHandler: function(e) {
            let that = this;
            let iframe = document.getElementById("sandboxId");
            if ((e.origin === "null" || e.origin === that.frameDomain()) && e.source === iframe.contentWindow) {
                if (e.data.action == 'pong') {
                    that.isIframeInitialised = true;
                } else if (e.data.action == 'failedInit') {
                    that.giveUp();
                } else if (e.data.action == 'streamFile') {
                    that.streamFile(e.data.seekHi, e.data.seekLo, e.data.seekLength, e.data.streamFilePath);
                } else if(e.data.action == 'actionRequest') {
                    that.actionRequest(e.data.filePath, e.data.requestId, e.data.apiMethod, e.data.bytes, e.data.hasFormData);
                } else if(e.data.action == 'currentTitleResponse') {
                    that.currentTitleResponse(e.data.title);
                } else if(e.data.action == 'postShutdown') {
                    that.postShutdown();
                }
            }
        },
        startListener: function() {
            this.showSpinner = this.appName == 'browser' ? false : true;
            var that = this;
            var iframe = document.getElementById("sandboxId");
            if (iframe == null) {
                setTimeout(() => {that.startListener();}, 100);
                return;
            }
            // Listen for response messages from the frames.
            window.removeEventListener('message', that.messageHandler);
            window.addEventListener('message', that.messageHandler);
            let func = function() {
                that.postMessage({type: 'init', appName: that.appName, indexHTML: that.indexHTML, appFilePath: that.appFilePath});
            };
            that.setupIFrameMessaging(iframe, func);
        },
        setupIFrameMessaging: function(iframe, func) {
            if (this.isIframeInitialised) {
                func();
            } else {
                iframe.contentWindow.postMessage({type: 'ping'}, '*');
                let that = this;
                window.setTimeout(function() {that.setupIFrameMessaging(iframe, func);}, 30);
            }
        },
        streamFile: function(seekHi, seekLo, seekLength, streamFilePath) {
            let that = this;
            that.findFile(streamFilePath).thenApply(file => {
                if (file != null) {
                    that.stream(seekHi, seekLo, seekLength, file, streamFilePath);
                }
            });
        },
        buildHeader: function(filePath, requestId) {
            let encoder = new TextEncoder();
            let idBytes = encoder.encode(filePath + requestId);
            let idSize = this.writeUnsignedLeb128(idBytes.byteLength);
            let headerSize = 1 + idSize.byteLength + idBytes.byteLength;
            var header = new Uint8Array(headerSize);
            header[0] = 0;
            header.set(idSize, 1);
            header.set(idBytes, idSize.byteLength + 1);
            return header;
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
            data.length = bytes.byteLength;
            this.postData(data);
        },
        formatPathForDisplay: function(filePath) {
            if (filePath == '/apps/sandbox/browser/assets/index.html') {
                return '';
            }
            let forDisplay = filePath.startsWith(this.peergosUserToken)
                ? this.context.username + filePath.substring(this.peergosUserToken.length)
                : filePath;
            let address = forDisplay.startsWith('/') ? forDisplay.substring(1) : forDisplay;
            if (this.bookmarks.get(address) == null) {
                this.displayToBookmark = true;
            } else {
                this.displayToBookmark = false;
            }
            return address;
        },
        actionRequest: function(filePath, requestId, apiMethod, data, hasFormData) {
            let that = this;
            let header = this.buildHeader(filePath, requestId);

            var bytes = convertToByteArray(new Int8Array(data));
            try {
                if (apiMethod == 'GET') {
                    if (requestId.length > 0) {
                        that.getFileAction(header, filePath);
                    } else {
                        that.findFile(filePath).thenApply(file => {
                            if (that.showSpinner && filePath == that.peergosAppToken + that.indexHTML) {
                                that.showSpinner = false;
                            }
                            if (file != null) {
                                that.readInFile(header, file);
                                if (that.appName == 'browser' && filePath.endsWith('.html')) { //todo improve
                                    that.addressBarText = that.formatPathForDisplay(filePath);
                                }
                            } else {
                                that.buildResponse(header, null, that.FILE_NOT_FOUND);
                            }
                        });
                    }
                } else if(apiMethod == 'DELETE') {
                    that.deleteAction(header, filePath);
                } else if(apiMethod == 'POST') {
                    that.createAction(header, filePath, bytes, hasFormData);
                } else if(apiMethod == 'PUT') {
                    that.putAction(header, filePath, bytes);
                }
            } catch(ex) {
                console.log('Exception:' + ex);
                that.buildResponse(header, null, that.ACTION_FAILED);
            }
        },
        putAction: function(header, filePath, bytes) {
            let that = this;
            let dataPath = peergos.client.PathUtils.directoryToPath(filePath.split('/'));
            this.sandboxedApp.existsInternal(dataPath).thenApply(function(existsResult) {
                if (existsResult == -1) { // not found
                    that.updateAction(header, filePath, bytes, true);
                } else if(existsResult == 0) { //file
                    that.updateAction(header, filePath, bytes, false);
                } else if(existsResult == 1) { //directory
                    that.createAction(header, filePath, bytes, false);
                }
            }).exceptionally(function(throwable) {
                console.log(throwable.getMessage());
                that.buildResponse(header, null, that.ACTION_FAILED);
            });
        },
        updateAction: function(header, filePath, bytes, newFile) {
            let that = this;
            let dataPath = peergos.client.PathUtils.directoryToPath(filePath.split('/'));
            this.sandboxedApp.writeInternal(dataPath, bytes).thenApply(function(res) {
                if (res) {
                    if (newFile) {
                        let encoder = new TextEncoder();
                        let relativePathBytes = encoder.encode(filePath);
                        that.buildResponse(header, relativePathBytes, that.CREATE_SUCCESS);
                    } else {
                        that.buildResponse(header, null, that.UPDATE_SUCCESS);
                    }
                } else {
                    console.log("unable to update file: " + filePath);
                    that.buildResponse(header, null, that.ACTION_FAILED);
                }
            }).exceptionally(function(throwable) {
                console.log(throwable.getMessage());
                that.buildResponse(header, null, that.ACTION_FAILED);
            });
        },
        createAction: function(header, filePath, bytes, hasFormData) {
            let that = this;
            let relativePath = hasFormData ? filePath : filePath + "/" + this.generateUUID();
            //let relativePath = this.getRelativePath(fullPath);
            let dirPath = peergos.client.PathUtils.directoryToPath(relativePath.split('/'));
            this.sandboxedApp.writeInternal(dirPath, bytes).thenApply(function(res) {
                if (res) {
                    let encoder = new TextEncoder();
                    let relativePathBytes = encoder.encode(relativePath);
                    that.buildResponse(header, relativePathBytes, hasFormData ? that.UPDATE_SUCCESS : that.CREATE_SUCCESS);
                } else {
                    console.log("unable to create file: " + dirPath);
                    that.buildResponse(header, null, that.ACTION_FAILED);
                }
            }).exceptionally(function(throwable) {
                console.log(throwable.getMessage());
                that.buildResponse(header, null, that.ACTION_FAILED);
            });
        },
        //https://stackoverflow.com/questions/105034/how-to-create-guid-uuid
        generateUUID: function() {
          return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
          );
        },
        getRelativePath: function(filePath) {
            let sandboxDataPrefix = '/apps/sandbox/' + this.appName + '/assets/';
            if (!filePath.startsWith(sandboxDataPrefix)) {
                throw new Error('Path to resource invalid!');
            }
            return filePath.substring(sandboxDataPrefix.length);
        },
        getFileAction: function(header, filePath) {
            let that = this;
            let dataPath = peergos.client.PathUtils.directoryToPath(filePath.split('/'));
            this.sandboxedApp.readInternal(dataPath).thenApply(data => {
                that.buildResponse(header, data, that.GET_SUCCESS);
            }).exceptionally(function(throwable) {
                console.log(throwable.getMessage());
                that.buildResponse(header, null, that.FILE_NOT_FOUND);
            });
        },
        deleteAction: function(header, filePath) {
            let that = this;
            let dirPath = peergos.client.PathUtils.directoryToPath(filePath.split('/'));
            this.sandboxedApp.deleteInternal(dirPath).thenApply(function(res) {
                if (res) {
                    that.buildResponse(header, null, that.DELETE_SUCCESS);
                } else {
                    console.log("unable to delete: " + filePath);
                    that.buildResponse(header, null, that.ACTION_FAILED);
                }
            }).exceptionally(function(throwable) {
                console.log(throwable.getMessage());
                that.buildResponse(header, null, that.ACTION_FAILED);
            });
        },
        postData: function(bytes) {
            let that = this;
            that.postMessage({type: 'respondToLoadedChunk', bytes: bytes});
        },
        stream: function(seekHi, seekLo, seekLength, file, filePath) {
            var props = file.getFileProperties();
            let that = this;
            function Context(file, pathSize, filePathBytes, sizeHighBytes, sizeLowBytes, network, crypto, sizeHigh, sizeLow) {
                this.maxBlockSize = 1024 * 1024 * 5;
                this.writer = null;
                this.file = file;
                this.network = network;
                this.crypto = crypto;
                this.sizeHigh = sizeHigh,
                this.sizeLow = sizeLow;
                this.counter = 0;
                this.readerFuture = null;
                this.postData = function(data) {
                   that.postData(data);
                }
                this.stream = function(seekHi, seekLo, length) {
                    this.counter++;
                    var work = function(thatRef, currentCount) {
                        var currentSize = length;
                        var blockSize = currentSize > this.maxBlockSize ? this.maxBlockSize : currentSize;
                        var pump = function(reader, header) {
                            if(blockSize > 0 && thatRef.counter == currentCount) {
                                var bytes = new Uint8Array(blockSize + header.byteLength);
                                for(var i=0;i < header.byteLength;i++){
                                    bytes[i] = header[i];
                                }
                                var data = convertToByteArray(bytes);
                                data.length = blockSize + header.byteLength;
                                return reader.readIntoArray(data, header.byteLength, blockSize).thenApply(function(read){
                                       currentSize = currentSize - read.value_0;
                                       blockSize = currentSize > thatRef.maxBlockSize ? thatRef.maxBlockSize : currentSize;
                                       //that.streamWriter.write(data);
                                       //thatRef.postMessage({type: 'respondToLoadedChunk', bytes: data});
                                       thatRef.postData(data);
                                       return pump(reader, header);
                                });
                            } else {
                                var future = peergos.shared.util.Futures.incomplete();
                                future.complete(true);
                                return future;
                            }
                        }
                        var updated = thatRef.readerFuture != null && thatRef.counter == currentCount ?
                        thatRef.readerFuture :
                            file.getBufferedInputStream(network, crypto, sizeHigh, sizeLow, 4, function(read) {})
                            updated.thenCompose(function(reader) {
                                return reader.seekJS(seekHi, seekLo).thenApply(function(seekReader){
                                    var readerFuture = peergos.shared.util.Futures.incomplete();
                                    readerFuture.complete(seekReader);
                                    thatRef.readerFuture = readerFuture;

                                    let headerSize = 1 + pathSize.byteLength + filePathBytes.byteLength
                                        + sizeHighBytes.byteLength + sizeLowBytes.byteLength;
                                    var header = new Uint8Array(headerSize);
                                    header[0] = 1; //STREAMING_MODE
                                    var offset = 1;
                                    header.set(pathSize, offset);
                                    offset += pathSize.byteLength;
                                    header.set(filePathBytes, offset);
                                    offset += filePathBytes.byteLength;
                                    header.set(sizeHighBytes, offset);
                                    offset += sizeHighBytes.byteLength;
                                    header.set(sizeLowBytes, offset);
                                    return pump(seekReader, header);
                                })
                            });
                    }
                    return work(this, this.counter);
                }
            }
            let encoder = new TextEncoder();
            let filePathBytes = encoder.encode(filePath);
            let pathSize = this.writeUnsignedLeb128(filePathBytes.byteLength);
            let sizeHighBytes = this.writeUnsignedLeb128(props.sizeHigh());
            let sizeLowBytes = this.writeUnsignedLeb128(props.sizeLow());

            const context = new Context(file, pathSize, filePathBytes, sizeHighBytes, sizeLowBytes, this.context.network, this.context.crypto, props.sizeHigh(), props.sizeLow());
            if (seekLength < 0) { //first 1 Mib block of file
                var end = (1024 * 1024 * 1) - 1;
                if(end > props.sizeLow() - 1) {
                    end = props.sizeLow() - 1;
                }
                context.stream(0, 0, end + 1);
            } else {
                context.stream(seekHi, seekLo, seekLength);
            }
        },
        expandFilePath(filePath) {
            let expandedFilePath = null;
            if (filePath.startsWith(this.peergosUserToken)) {
                return this.context.username + filePath.substring(this.peergosUserToken.length);
            } else if(filePath.startsWith(this.peergosAppToken)) {
                return this.context.username + "/.apps/" + filePath.substring(this.peergosUserToken.length);
            } else {
                return filePath;
            }
        },
        findFile: function(filePath) {
            var future = peergos.shared.util.Futures.incomplete();
            let that = this;
            let expandedFilePath = this.expandFilePath(filePath);
            this.context.getByPath(expandedFilePath).thenApply(function(fileOpt){
                if (fileOpt.ref == null) {
                    console.log("file not found!:" + filePath);
                    that.showMessage('file not found: ' + filePath);
                    future.complete(null);
                } else {
                    future.complete(fileOpt.get());
                }
            }).exceptionally(function(throwable) {
                console.log(throwable.getMessage());
                future.complete(null);
            });
            return future;
        },
        readInFile: function(header, file) {
            let that = this;
            let props = file.getFileProperties();
            let size = props.sizeLow();
            file.getInputStream(that.context.network, that.context.crypto, props.sizeHigh(), props.sizeLow(), read => {}).thenApply(reader => {
                var bytes = new Uint8Array(size + header.byteLength);
                for(var i=0;i < header.byteLength;i++){
                    bytes[i] = header[i];
                }
                let data = convertToByteArray(bytes);
                data.length = size + header.byteLength;
                reader.readIntoArray(data, header.byteLength, size).thenApply(function(read){
                    that.postData(data);
                });
            });
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
        },
        showMessage: function(title, body) {
            this.messages.push({
                title: title,
                body: body,
                show: true
            });
        },
        updateBookmarks: function(items, address, removeBookmark, title) {
            let that = this;
            if (removeBookmark) {
                items.splice(items.findIndex(v => v.link === address), 1);
            } else if (items.findIndex(v => v.link === address) != -1) {
                that.showMessage('already bookmarked');
                that.showSpinner = false;
                return;
            }
            if (!removeBookmark) {
                let newItem = {id: that.generateUUID(), created: Date.now(), link: address, text: title};
                items.push(newItem);
            }
            that.bookmarks = new Map();
            items.forEach(item => {
               that.bookmarks.set(item.link, item);
            });
            let encoder = new TextEncoder();
            let bytes = convertToByteArray(new Int8Array(encoder.encode(JSON.stringify(items))));
            let dataPath = peergos.client.PathUtils.directoryToPath(['bookmarks.dat']);
            that.sandboxedApp.writeInternal(dataPath, bytes).thenApply(function(res) {
                if (removeBookmark) {
                    if (res) {
                        that.showMessage("removed bookmark");
                        that.displayToBookmark = true;
                    } else {
                        that.showMessage("unable to remove bookmark");
                        console.log("unable to remove bookmark: " + address);
                    }
                } else {
                    if (res) {
                        that.showMessage("added bookmark");
                        that.displayToBookmark = false;
                    } else {
                        that.showMessage("unable to add bookmark");
                        console.log("unable to add bookmark: " + address);
                    }
                }
                that.showSpinner = false;
            }).exceptionally(function(throwable) {
                that.showSpinner = false;
                console.log(throwable.getMessage());
            });
        },
        refreshBookmarks: function(address, removeBookmark, title) {
            let that = this;
            this.showSpinner = true;
            let dataPath = peergos.client.PathUtils.directoryToPath(['bookmarks.dat']);
            this.sandboxedApp.readInternal(dataPath).thenApply(data => {
                if (data.byteLength == 2) { //empty file
                    that.updateBookmarks([], address, removeBookmark, title);
                } else {
                    let bookmarks = new TextDecoder().decode(data);
                    let items = JSON.parse(bookmarks);
                    that.updateBookmarks(items, address, removeBookmark, title);
  				}
            }).exceptionally(function(throwable) { //means bookmarks.dat does not exist
                that.updateBookmarks([], address, removeBookmark, title);
            });
        },
        currentTitleResponse: function(title) {
            let that = this;
            let address = this.addressBarText;
            let val = this.bookmarks.get(address);
            let removeBookmark = val != null;

            this.prompt_placeholder='Optional description';
            this.prompt_message='Add Bookmark for: ' + address;
            this.prompt_value=title;
            this.prompt_consumer_func = function(prompt_result) {
                let bookmarkTitle = prompt_result.trim();
                that.refreshBookmarks(address, removeBookmark, bookmarkTitle);
            };
            this.showPrompt = true;
        },
        toggleBookmark: function() {
            if(this.showSpinner) {
                return;
            }
            let that = this;
            let address = this.addressBarText;
            let val = this.bookmarks.get(address);
            let removeBookmark = val != null;
            if (!removeBookmark) {
                that.postMessage({type: 'currentTitleRequest'});
            } else {
                that.refreshBookmarks(address, removeBookmark, '');
            }
        },
        closePrompt: function() {
            this.showPrompt = false;
        },
        closeApp: function () {
            let that = this;
            this.postMessage({type: 'shutdown'});
            setTimeout(function(){
                if (!that.sandboxShutdownOK) {
                    that.sandboxShutdownOK = true;
                    that.$emit("hide-sandbox");
                }
            }, 3000);

        },
        postShutdown: function() {
            window.removeEventListener('message', this.messageHandler);
            this.sandboxShutdownOK = true;
            this.$emit("hide-sandbox");
        }
    }
}
