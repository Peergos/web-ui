<template>
<transition name="modal">
    <div class="modal-mask-app" @click="closeApp">
        <div class="modal-container full-height" @click.stop style="width:100%;overflow-y:auto;padding:0;display:flex;flex-flow:column;">
            <div class="modal-header-app">
              <span style="position:absolute;top:0;right:5em;">
                <span @click="closeApp" tabindex="0" v-on:keyup.enter="closeApp" style="color:black;font-size:3em;font-weight:bold;cursor:pointer;">&times;</span>
              </span>
            </div>

            <div class="modal-body" style="padding:0;display:flex;flex-grow:1;">
                <iframe id="sandboxId" :src="frameUrl()" style="width:600px;height:600px" frameBorder="0" scrolling="no"></iframe>
            </div>
            <spinner v-if="showSpinner" :message="spinnerMessage"></spinner>
        </div>
    </div>
</transition>
</template>

<script>
const downloaderMixins = require("../../mixins/downloader/index.js");
const router = require("../../mixins/router/index.js");
const sandboxMixin = require("../../mixins/sandbox/index.js");

module.exports = {
	mixins:[downloaderMixins, router, sandboxMixin],
    data: function() {
        return {
            showSpinner: false,
            spinnerMessage: '',
            maxBlockSize: 1024 * 1024 * 5,
            sandboxedApp: null,
            FILE_NOT_FOUND: 2,
            ACTION_FAILED: 3,
            DELETE_SUCCESS: 4,
            DIRECTORY_NOT_FOUND: 5,
            CREATE_SUCCESS: 6,
            UPDATE_SUCCESS: 7,
            GET_SUCCESS: 8,
            PATCH_SUCCESS: 9,
            isIframeInitialised: false,
            appPath: '',
            isAppPathAFolder: false,
            permissionsMap: new Map(),
            PERMISSION_STORE_APP_DATA: 'STORE_APP_DATA',
            PERMISSION_EDIT_CHOSEN_FILE: 'EDIT_CHOSEN_FILE',
            PERMISSION_READ_CHOSEN_FOLDER: 'READ_CHOSEN_FOLDER'
        }
    },
    computed: {
        ...Vuex.mapState([
            'quotaBytes',
            'usageBytes',
            'context',
        ]),
        ...Vuex.mapGetters([
            'getPath',
        ])
    },
    props: ['sandboxAppName', 'currentFile'],
    created: function() {
        let that = this;
        let currentFilename = this.currentFile == null ? '' : this.currentFile.getName();
        this.appPath = this.currentFile == null ? '' : this.getPath + currentFilename;
        if (this.currentFile != null) {
            if (this.currentFile.getFileProperties().isDirectory) {
                this.isAppPathAFolder = true;
            }
        }
        if (!this.supportsStreaming()) {
            this.giveUp();
        } else {
            this.readAppProperties(that.sandboxAppName).thenApply(props => {
                if (!that.validatePermissions(props)) {
                    that.fatalError('Application configuration error. See console for further details');
                } else {
                    peergos.shared.user.App.init(that.context, that.sandboxAppName).thenApply(sandboxedApp => {
                        that.sandboxedApp = sandboxedApp;
                        that.startListener();
                    });
                }
            });
        }
    },
    methods: {
        validatePermissions: function(props) {
            let allPermissions = new Map();
            props.permissions.forEach(permission => {
                allPermissions.set(permission, new Date());
            });
            this.permissionsMap = allPermissions;
            if (!props.details.folderAction && this.isAppPathAFolder) {
                console.log('App configured as NOT a FolderAction, but Path is a folder!');
                return false;
            }
            if (props.details.folderAction && !this.isAppPathAFolder) {
                console.log('App configured as a FolderAction, but Path is not a folder!');
                return false;
            }
            if (this.isAppPathAFolder) {
                if (!this.permissionsMap.get(this.PERMISSION_READ_CHOSEN_FOLDER)) {
                    console.log('App configured as a FolderAction, but permission READ_CHOSEN_FOLDER not set!');
                    return false;
                }
            }
            return true;
        },
    	giveUp: function() {
            this.fatalError('Your Web browser does not support sandbox applications. Are you running incognito-mode?');
    	},
        fatalError: function(msg) {
            this.showError(msg);
            this.closeApp();
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
                    that.actionRequest(e.data.filePath, e.data.requestId, e.data.apiMethod, e.data.bytes,
                        e.data.hasFormData, e.data.params);
                }
            }
        },
        startListener: function() {
            this.showSpinner = true;
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
                that.postMessage({type: 'init', appName: that.sandboxAppName, appPath: that.appPath});
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
            this.findFile(streamFilePath).thenApply(file => {
                if (file != null) {
                    that.stream(seekHi, seekLo, seekLength, file, streamFilePath);
                }
            });
        },
        fixMimeType: function (filePath, mimeTypeInput) {
            var mimeType = "application/octet-stream";
            if (mimeTypeInput != null && mimeTypeInput.trim().length > 0) {
                if (filePath.endsWith('.html')) {
                    mimeType = "text/html";
                } else if (filePath.endsWith('.css')) {
                    mimeType = "text/css";
                } else if (filePath.endsWith('.js')) {
                    mimeType = "text/javascript";
                } else {
                    mimeType = mimeTypeInput;
                }
            }
            return mimeType;
        },
        buildHeader: function(filePath, mimeTypeInput, requestId, streamingInfo) {
            var mimeType = this.fixMimeType(filePath, mimeTypeInput);
            let encoder = new TextEncoder();
            let filePathBytes = encoder.encode(filePath + requestId);
            let mimeTypeBytes = encoder.encode(mimeType);
            let pathSize = filePathBytes.byteLength;
            if (pathSize >= 255) {
                throw new Error("Path too long!");
            }
            let mimeTypeSize = mimeTypeBytes.byteLength;
            if (mimeTypeSize >= 255) {
                throw new Error("MimeType too long!");
            }
            var headerSize = 1 + 1 + pathSize + 1 + mimeTypeSize;
            let sizeHighBytes = 0;
            let sizeLowBytes = 0;
            if (streamingInfo != null) {
                sizeHighBytes = this.writeUnsignedLeb128(streamingInfo.sizeHigh);
                sizeLowBytes = this.writeUnsignedLeb128(streamingInfo.sizeLow);
                headerSize = headerSize + sizeHighBytes.byteLength + sizeLowBytes.byteLength;
            }
            var data = new Uint8Array(headerSize);
            var offset = 0;
            data.set([streamingInfo != null ? 1 : 0], offset); //status code (or mode)
            offset = offset + 1;
            data.set([pathSize], offset);
            offset = offset + 1;
            data.set(filePathBytes, offset);
            offset = offset + pathSize;
            data.set([mimeTypeSize], offset);
            offset = offset + 1;
            data.set(mimeTypeBytes, offset);
            if (streamingInfo != null) {
                offset = offset + mimeTypeSize;
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
        actionRequest: function(path, requestId, apiMethod, data, hasFormData, params) {
            let that = this;
            let headerFunc = (mimeType) => that.buildHeader(path, mimeType, requestId);

            var bytes = convertToByteArray(new Int8Array(data));
            try {
                if (apiMethod == 'GET') {
                    if (requestId.length > 0) { //GET requests to /form or /data
                        if (!that.permissionsMap.get(that.PERMISSION_STORE_APP_DATA)) {
                            that.showError("App attempted to access file without permission :" + path);
                            that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                        } else {
                            that.getFileAction(headerFunc, path, params);
                        }
                    } else {
                        if (path.startsWith('assets/')) {
                            that.findFile(path).thenApply(file => {
                                if (that.showSpinner && path == "assets/index.html") {
                                    that.showSpinner = false;
                                }
                                if (file != null) {
                                    that.readInFile(headerFunc(file.getFileProperties().mimeType), file);
                                } else {
                                    that.buildResponse(headerFunc(), null, that.FILE_NOT_FOUND);
                                }
                            });
                        } else if (!path.startsWith(that.appPath) || that.appPath.length == 0) {
                            that.showError("App attempted to read unexpected path:" + path);
                            that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                        } else {
                            that.readFileOrFolder(headerFunc, path, params);
                        }
                    }
                } else {
                    if (that.appPath.length > 0 && path.startsWith(that.appPath)) {
                        if (that.isAppPathAFolder) {
                            that.showError("App attempted to write folder without permission :" + path);
                            that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                        } else {
                            if (apiMethod == 'POST' || apiMethod == 'PUT') {
                                if (!that.permissionsMap.get(that.PERMISSION_EDIT_CHOSEN_FILE)) {
                                    that.showError("App attempted to write to file without permission :" + path);
                                    that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                                } else {
                                    that.overwriteFile(headerFunc(), path, bytes);
                                }
                            } else {
                                that.showError("App attempted unexpected action: " + apiMethod);
                                that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                            }
                        }
                    } else {
                        if (!that.permissionsMap.get(that.PERMISSION_STORE_APP_DATA)) {
                            that.showError("App attempted to access file without permission :" + path);
                            that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                        }
                        if(apiMethod == 'DELETE') {
                            that.deleteAction(headerFunc(), path);
                        } else if(apiMethod == 'POST') {
                            that.createAction(headerFunc(), path, bytes, hasFormData);
                        } else if(apiMethod == 'PUT') {
                            that.putAction(headerFunc(), path, bytes);
                        } else if(apiMethod == 'PATCH') {
                            that.patchAction(headerFunc(), path, bytes);
                        }
                    }
                }
            } catch(ex) {
                console.log('Exception:' + ex);
                that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
            }
        },
        readFileOrFolder: function(headerFunc, path, params) {
            let that = this;
            this.context.getByPath(path).thenApply(function(respOpt){
                if (respOpt.ref == null) {
                    that.showError('Path not found: ' + path);
                    that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                } else {
                    let resp = respOpt.get();
                    let props = resp.getFileProperties();
                    if (props.isHidden) {
                        that.showError('Path not accessible: ' + path);
                        that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                    } else {
                        if (props.isDirectory) {
                            that.readFolderListing(headerFunc("text/plain"), resp);
                        } else {
                            let fileType = props.getType();
                            if (params.get('preview') == 'true') {
                                if (fileType == 'image' || fileType == 'video') {
                                    that.readInThumbnail(headerFunc("text/plain"), resp);
                                } else {
                                    that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                                }
                            } else {
                                that.readInFile(headerFunc(props.mimeType), resp);
                            }
                        }
                    }
                }
            });
        },
        readInThumbnail: function(header, file) {
            let thumbnail = file.getBase64Thumbnail();
            let encoder = new TextEncoder();
            let data = encoder.encode(thumbnail);
            this.buildResponse(header, data, this.GET_SUCCESS);
        },
        readFolderListing: function(header, folder) {
            let that = this;
            folder.getChildren(that.context.crypto.hasher, that.context.network).thenApply(function(children) {
                let arr = children.toArray();
                let folderListing = {files:[], subFolders:[]};
                arr.forEach(function(child){
                    let props = child.getFileProperties();
                    if (!props.isHidden) {
                        if(props.isDirectory) {
                            folderListing.subFolders.push(child.getName());
                        } else {
                            folderListing.files.push(child.getName());
                        }
                    }
                });
                let encoder = new TextEncoder();
                let data = encoder.encode(JSON.stringify(folderListing));
                that.buildResponse(header, data, that.GET_SUCCESS);
            });
        },
        overwriteFile: function(header, filePath, bytes) {
            let that = this;
            this.findFile(filePath).thenApply(file => {
                if (file != null) {
                    let java_reader = peergos.shared.user.fs.AsyncReader.build(bytes);
                    let sizeHi = (bytes.length - (bytes.length % Math.pow(2, 32)))/Math.pow(2, 32);
                    file.overwriteFileJS(java_reader, sizeHi, bytes.length, that.context.network, that.context.crypto, len => {})
                    .thenApply(function(updatedFile) {
                        that.buildResponse(header, null, that.UPDATE_SUCCESS);
                    }).exceptionally(function(throwable) {
                            that.showMessage(true, "Unexpected error", throwable.detailMessage);
                            console.log('Error uploading file: ' + that.file.getName());
                            console.log(throwable.getMessage());
                    });
                }
            });
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
        patchAction: function(header, filePath, bytes) {
            let that = this;
            let dataPath = peergos.client.PathUtils.directoryToPath(filePath.split('/'));
            this.sandboxedApp.appendInternal(dataPath, bytes).thenApply(function(res) {
                if (res) {
                    let encoder = new TextEncoder();
                    let relativePathBytes = encoder.encode(filePath);
                    that.buildResponse(header, relativePathBytes, that.PATCH_SUCCESS);
                } else {
                    console.log("unable to append data: " + filePath);
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
        getFileAction: function(headerFunc, filePath, params) {
            let that = this;
            if (filePath.endsWith('/')) {
                let fullFolderPath = this.context.username + "/.apps/" + this.sandboxAppName + '/data/' + filePath;
                this.context.getByPath(fullFolderPath).thenApply(function(folderOpt){
                    if (folderOpt.ref == null) {
                        that.showError('Folder not found: ' + filePath);
                        that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                    } else {
                        let folder = folderOpt.get();
                        let props = folder.getFileProperties();
                        if (props.isDirectory) {
                            that.readFolderListing(headerFunc("text/plain"), folder);
                        } else {
                            that.showError('Path not a folder: ' + filePath);
                            that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                        }
                    }
                });
            } else {
                if (params.get('preview') == 'true') {
                    let fullFilePath = this.context.username + "/.apps/" + this.sandboxAppName + '/data/' + filePath;
                    this.context.getByPath(fullFilePath).thenApply(function(fileOpt){
                        if (fileOpt.ref == null) {
                            that.showError('File not found: ' + filePath);
                            that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                        } else {
                            let file = fileOpt.get();
                            let props = file.getFileProperties();
                            let fileType = props.getType();
                            if (fileType == 'image' || fileType == 'video') {
                                that.readInThumbnail(headerFunc("text/plain"), file);
                            } else {
                                that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                            }
                        }
                    });
                } else {
                    let dataPath = peergos.client.PathUtils.directoryToPath(filePath.split('/'));
                    this.sandboxedApp.readInternal(dataPath).thenApply(data => {
                        that.sandboxedApp.mimeTypeInternal(dataPath).thenApply(mimeType => {
                            that.buildResponse(headerFunc(mimeType), data, that.GET_SUCCESS);
                        });
                    }).exceptionally(function(throwable) {
                        console.log(throwable.getMessage());
                        that.buildResponse(headerFunc(), null, that.FILE_NOT_FOUND);
                    });
                }
            }
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
            this.postMessage({type: 'respondToLoadedChunk', bytes: bytes});
        },
        stream: function(seekHi, seekLo, seekLength, file, filePath) {
            var props = file.getFileProperties();
            let that = this;
            function Context(file, filePath, mimeType, network, crypto, sizeHigh, sizeLow) {
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
                                return reader.readIntoArray(data, header.byteLength, blockSize).thenApply(function(read){
                                       currentSize = currentSize - read.value_0;
                                       blockSize = currentSize > thatRef.maxBlockSize ? thatRef.maxBlockSize : currentSize;
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

                                    let streamingInfo = {sizeHigh: sizeHigh, sizeLow: sizeLow};
                                    let header = that.buildHeader(filePath, mimeType, '', streamingInfo);
                                    return pump(seekReader, header);
                                })
                            });
                    }
                    return work(this, this.counter);
                }
            }

            const context = new Context(file, filePath, props.mimeType, this.context.network, this.context.crypto, props.sizeHigh(), props.sizeLow());
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
            if (filePath == this.appPath) {
                return filePath;
            } else {
                return this.context.username + "/.apps/" + this.sandboxAppName + '/' + filePath;
            }
        },
        findFile: function(filePath) {
            var future = peergos.shared.util.Futures.incomplete();
            let that = this;
            let expandedFilePath = this.expandFilePath(filePath);
            this.context.getByPath(expandedFilePath).thenApply(function(fileOpt){
                if (fileOpt.ref == null) {
                    that.showError('file not found: ' + filePath);
                    future.complete(null);
                } else {
                    let file = fileOpt.get();
                    if (file.getFileProperties().isHidden) {
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
            let that = this;
            let props = file.getFileProperties();
            let size = props.sizeLow();
            file.getInputStream(that.context.network, that.context.crypto, props.sizeHigh(), props.sizeLow(), read => {}).thenApply(reader => {
                var bytes = new Uint8Array(size + header.byteLength);
                for(var i=0;i < header.byteLength;i++){
                    bytes[i] = header[i];
                }
                let data = convertToByteArray(bytes);
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
        showError: function(msg) {
            console.log(msg);
            this.$toast.error(msg);
        },
        closeApp: function () {
            var iframe = document.getElementById("sandboxId");
            //iframe.parentNode.removeChild(iframe);
            iframe.src = '#';
            this.$emit("hide-app-sandbox");
        },
    }
}
</script>
<style>
</style>