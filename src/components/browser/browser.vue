<template>
<transition name="modal">
    <div class="modal-mask-app" @click="closeApp">
        <div class="modal-container full-height" @click.stop style="width:100%;overflow-y:auto;padding:0;display:flex;flex-flow:column;">
            <div class="modal-header-app">
              <span v-if="!showBookmarks && toolbarDisplayable">
                <center v-if="!showBookmarks && toolbarDisplayable"><h2>{{ addressBarText }}</h2></center>
              </span>
              <span v-if="!showBookmarks && toolbarDisplayable && !fromSecretLink" style="position:absolute;top:10px;right:100px;z-index:9999;cursor:pointer">
                    <img v-if="displayToBookmark" src="/images/bookmark-o.png" @click="toggleBookmark">
                    <img v-if="!displayToBookmark" src="/images/bookmark.png" @click="toggleBookmark">
              </span>
              <span @click="closeApp" tabindex="0" v-on:keyup.enter="closeApp" style="position:absolute;top:-10px;right:40px;z-index:999;color:black;font-size:3em;font-weight:bold;cursor:pointer;">&times;</span>

            </div>

            <div class="modal-body">
                <iframe v-if="!showBookmarks" id="browserId" :src="frameUrl()" scrolling="no" style="width:100%; min-height:100vh" frameBorder="0"></iframe>
                <div v-if="showBookmarks">
                    <span>
                        <center>
                            <input type="text" v-model="navigateToAddress" v-on:keyup.enter="navigateTo" type="text" size="60" maxlength="70" class="form-control" style="width: 500px;" placeholder="Type address">
                            <button @click='navigateTo()' class="btn btn-success">Go</button>
                        </center>
                    </span>
                    <ul v-for="bookmark in sortedBookmarks" class="flex-container vspace-5" style="justify-content:space-between; max-width:700px;">
                        <li style="font-size:1.5em;">
                            <a v-on:click="navigateToBookmark(bookmark)" style="cursor: pointer">{{ bookmark.displayText }}</a>
                        </li>
                    </ul>
                </div>
            </div>
            <spinner v-if="showSpinner" :message="spinnerMessage"></spinner>
            <prompt
                    v-if="showPrompt"
                    v-on:hide-prompt="closePrompt"
                    :prompt_message='prompt_message'
                    :placeholder="prompt_placeholder"
                    :max_input_size="prompt_max_input_size"
                    :value="prompt_value"
                    :consumer_func="prompt_consumer_func">
            </prompt>
        </div>
    </div>
</transition>
</template>

<script>
const routerMixins = require("../../mixins/router/index.js");
const downloaderMixins = require("../../mixins/downloader/index.js");

module.exports = {
    components: {
    },
    mixins:[routerMixins, downloaderMixins],
    data: function() {
        return {
            showSpinner: false,
            spinnerMessage: '',
            maxBlockSize: 1024 * 1024 * 5,
            browserShutdownOK: false,
            browserApp: null,
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
            isIframeInitialised: false,
            showBookmarks: false,
            navigateToAddress: '',
            allBookmarks: [],
            toolbarDisplayable: false,
            fromSecretLink: false
        }
    },
    computed: {
    ...Vuex.mapState([
        'context',
    ]),
    sortedBookmarks: function() {
        let sorted = this.allBookmarks;
        return sorted;
    }
    },
    mounted(){
    },
    props: ['internalNavigation'],
    created: function() {
        let that = this;
        if (this.internalNavigation == null) {
            this.showBookmarks = true;
        } else {
            this.showBookmarks = false;
        }
        if (!this.supportsStreaming()) {
            this.giveUp();
        } else {
            that.showSpinner = true;
            const props = this.getPropsFromUrl();
            this.fromSecretLink = props.secretLink;
            let path = props.path;
            let filename = props.args.filename;
            let pathToFile = path + (path.endsWith("/") ? "" : "/") + filename;

            peergos.shared.user.App.init(that.context, "browser").thenApply(browserApp => {
                that.browserApp = browserApp;
                if (this.showBookmarks) {
                    that.loadBrowserBookmarks().thenApply(done => {
                        that.showSpinner = false;
                        console.log("bookmarks loaded");
                    });
                } else {
                    that.context.getByPath(pathToFile).thenApply(fileOpt => {
                        if (! fileOpt.isPresent()) {
                            that.$toast.error("Couldn't load file: " + path, {timeout:false})
                            return;
                        }
                        that.file = fileOpt.get();
                        if (that.fromSecretLink) {
                                that.startListener(pathToFile);
                        } else {
                            that.loadBrowserBookmarks().thenApply(done => {
                                that.startListener(pathToFile);
                            });
                        }
                    });
                }
            });
        }
    },
    methods: {
        navigateTo: function() {
            this.showBookmarks = false;
            this.startListener(this.navigateToAddress);
        },
        navigateToBookmark: function(bookmark) {
            this.showBookmarks = false;
            this.startListener(bookmark.link);
        },
    	giveUp: function() {
            this.showMessage(true, 'Your Web browser does not support sandbox applications :(');
            this.closeBrowser();
    	},
        loadBrowserBookmarks: function() {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            if (that.fromSecretLink) {
                future.complete(false);
            } else {
                let dataPath = peergos.client.PathUtils.directoryToPath(['bookmarks.dat']);
                this.browserApp.readInternal(dataPath).thenApply(data => {
                    if (data.byteLength == 2) { //empty file
                        future.complete(false);
                    } else {
                        let items = JSON.parse(new TextDecoder().decode(data));
                        items.forEach(item => {
                            let linkText = item.text.length > 0 ? item.text + ' - ' + item.link : item.link;
                            item.displayText = linkText;
                           that.bookmarks.set(item.link, item);
                           that.allBookmarks.push(item);
                        });
                        future.complete(true);
                    }
                }).exceptionally(function(throwable) {
                    future.complete(false);
                });
            }
            return future;
        },
        frameUrl: function() {
            let url= this.frameDomain() + "/apps/browser/browser.html";
            return url;
        },
        frameDomain: function() {
            return window.location.protocol + "//browser." + window.location.host;
        },
        postMessage: function(obj) {
            let iframe = document.getElementById("browserId");
            iframe.contentWindow.postMessage(obj, '*');
        },
        messageHandler: function(e) {
            let that = this;
            let iframe = document.getElementById("browserId");
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
        startListener: function(filePath) {
            var that = this;
            var iframe = document.getElementById("browserId");
            if (iframe == null) {
                setTimeout(() => {that.startListener(filePath);}, 100);
                return;
            }
            // Listen for response messages from the frames.
            window.removeEventListener('message', that.messageHandler);
            window.addEventListener('message', that.messageHandler);
            let func = function() {
                that.showSpinner = false;
                that.postMessage({type: 'init', filePath: filePath});
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
            that.showSpinner = true;
            that.findFile(streamFilePath).thenApply(file => {
                if (file != null) {
                    that.stream(seekHi, seekLo, seekLength, file, streamFilePath);
                }
                that.showSpinner = false;
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
            if (mode == this.FILE_NOT_FOUND) {
                this.toolbarDisplayable = false;
            }
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
            let forDisplay = filePath;
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
            that.showSpinner = true;
            let header = this.buildHeader(filePath, requestId);
            var bytes = convertToByteArray(new Int8Array(data));
            try {
                if (apiMethod == 'GET') {
                    if (requestId.length > 0) {
                        that.getFileAction(header, filePath);
                        that.showSpinner = false;
                    } else {
                        that.findFile(filePath).thenApply(file => {
                            if (file != null) {
                                that.readInFile(header, file).thenApply(data => {
                                    that.postData(data);
                                    that.showSpinner = false;
                                    if (filePath.toLowerCase().endsWith('.html')) {
                                        that.toolbarDisplayable = true;
                                        that.addressBarText = that.formatPathForDisplay(filePath);
                                    }
                                });
                            } else {
                                that.showSpinner = false;
                                that.buildResponse(header, null, that.FILE_NOT_FOUND);
                            }
                        });
                    }
                }
            } catch(ex) {
                console.log('Exception:' + ex);
                that.buildResponse(header, null, that.ACTION_FAILED);
            }
        },
        //https://stackoverflow.com/questions/105034/how-to-create-guid-uuid
        generateUUID: function() {
          return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
          );
        },
        getRelativePath: function(filePath) {
            let sandboxDataPrefix = '/apps/browser/assets/';
            if (!filePath.startsWith(sandboxDataPrefix)) {
                throw new Error('Path to resource invalid!');
            }
            return filePath.substring(sandboxDataPrefix.length);
        },
        getFileAction: function(header, filePath) {
            let that = this;
            let dataPath = peergos.client.PathUtils.directoryToPath(filePath.split('/'));
            this.browserApp.readInternal(dataPath).thenApply(data => {
                that.buildResponse(header, data, that.GET_SUCCESS);
            }).exceptionally(function(throwable) {
                console.log(throwable.getMessage());
                that.buildResponse(header, null, that.FILE_NOT_FOUND);
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
        findFile: function(filePath) {
            var future = peergos.shared.util.Futures.incomplete();
            let that = this;
            this.context.getByPath(filePath).thenApply(function(fileOpt){
                if (fileOpt.ref == null) {
                    console.log("file not found!:" + filePath);
                    that.showMessage(true, 'file not found: ' + filePath);
                    future.complete(null);
                } else {
                    let file = fileOpt.get();
                    let props = file.getFileProperties();
                    if (props.isHidden) {
                        future.complete(null);
                    } else {
                        future.complete(file);
                    }
                }
            }).exceptionally(function(throwable) {
                console.log(throwable.getMessage());
                future.complete(null);
            });
            return future;
        },
        readInFile: function(header, file) {
            var future = peergos.shared.util.Futures.incomplete();
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
                    future.complete(data);
                });
            });
            return future;
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
        showMessage: function(isError, title, body) {
            let bodyContents = body == null ? '' : ' ' + body;
            if (isError) {
                this.$toast.error(title + bodyContents, {timeout:false});
            } else {
                this.$toast(title + bodyContents)
            }
        },
        updateBookmarks: function(items, address, removeBookmark, title) {
            let that = this;
            if (this.fromSecretLink) {
                return;
            }
            if (removeBookmark) {
                items.splice(items.findIndex(v => v.link === address), 1);
            } else if (items.findIndex(v => v.link === address) != -1) {
                that.showMessage(false, 'already bookmarked');
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
                that.allBookmarks.push(item);
            });
            let encoder = new TextEncoder();
            let bytes = convertToByteArray(new Int8Array(encoder.encode(JSON.stringify(items))));
            let dataPath = peergos.client.PathUtils.directoryToPath(['bookmarks.dat']);
            that.browserApp.writeInternal(dataPath, bytes).thenApply(function(res) {
                if (removeBookmark) {
                    if (res) {
                        that.displayToBookmark = true;
                    } else {
                        that.showMessage(true, "unable to remove bookmark");
                        console.log("unable to remove bookmark: " + address);
                    }
                } else {
                    if (res) {
                        that.displayToBookmark = false;
                    } else {
                        that.showMessage(true, "unable to add bookmark");
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
            this.browserApp.readInternal(dataPath).thenApply(data => {
                if (data.byteLength == 2) { //empty file
                    that.updateBookmarks([], address, removeBookmark, title);
                } else {
                    let items = JSON.parse(new TextDecoder().decode(data));
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
            if(this.showSpinner || this.fromSecretLink) {
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
            if (this.isIframeInitialised) {
                this.postMessage({type: 'shutdown'});
                setTimeout(function(){
                    if (!that.browserShutdownOK) {
                        that.browserShutdownOK = true;
                        this.closeBrowser();
                    }
                }, 3000);
            } else {
                this.closeBrowser();
            }

        },
        closeBrowser: function() {
            if (this.internalNavigation == null) {
                this.openFileOrDir("Drive", this.context.username, "");
            } else {
                this.$emit("hide-browser");
            }
        },
        postShutdown: function() {
            window.removeEventListener('message', this.messageHandler);
            this.browserShutdownOK = true;
            this.closeBrowser();
        }
    }
}
    </script>
<style>
</style>