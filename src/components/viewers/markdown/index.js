const Gallery = require("../../drive/DriveGallery.vue");
const router = require("../../../mixins/router/index.js");
module.exports = {
    template: require('markdown-viewer.html'),
    components: {
        Gallery
    },
    mixins:[router],
    data: function() {
        return {
	        currentFilename: null,
            showSpinner: false,
            currentFile: null,
            isIframeInitialised: false,
            FILE_NOT_FOUND: 2,
            PATH_PREFIX: '/apps/markdown/',
            displayPath: '',
            showEmbeddedGallery: false,
            filesToViewInGallery: [],
            isFileWritable: false
        }
    },
    props: ['context', 'file', 'messages', 'pathToFile'],
    created: function() {
        this.currentFile = this.file;
        this.currentFilename = this.file.getName();
        this.isFileWritable = this.file.isWritable();
        this.displayPath = this.pathToFile + '/' + this.currentFilename;
        this.startListener();
    },
    methods: {
	    frameUrl: function() {
            return this.frameDomain() + "/apps/markdown/index.html";
        },
        frameDomain: function() {
            return window.location.protocol + "//markdown." + window.location.host;
        },
        startListener: function() {
            var that = this;
            var iframe = document.getElementById("browser-iframe");
            if (iframe == null) {
                setTimeout(that.startListener, 1000);
                return;
            }
            // Listen for response messages from the frames.
            window.addEventListener('message', function (e) {
                // Normally, you should verify that the origin of the message's sender
                // was the origin and source you expected. This is easily done for the
                // unsandboxed frame. The sandboxed frame, on the other hand is more
                // difficult. Sandboxed iframes which lack the 'allow-same-origin'
                // header have "null" rather than a valid origin. This means you still
                // have to be careful about accepting data via the messaging API you
                // create. Check that source, and validate those inputs!
                if ((e.origin === "null" || e.origin === that.frameDomain()) && e.source === iframe.contentWindow) {
                    if (e.data.action == 'pong') {
                        that.isIframeInitialised = true;
                    } else if(e.data.action == 'navigateTo') {
                        that.navigateToRequest(iframe, e.data.path);
                    } else if(e.data.action == 'loadImage') {
                        that.loadImageRequest(iframe, e.data.src, e.data.id);
                    } else if(e.data.action == 'showMedia') {
                        that.showMediaRequest(e.data.path);
                    }
                }
            });
            // Note that we're sending the message to "*", rather than some specific
            // origin. Sandboxed iframes which lack the 'allow-same-origin' header
            // don't have an origin which you can target: you'll have to send to any
            // origin, which might alow some esoteric attacks. Validate your output!
            const props = this.currentFile.getFileProperties();
            const name = this.currentFile.getName();
            this.currentFile.getInputStream(this.context.network, this.context.crypto, props.sizeHigh(), props.sizeLow(), function(read){})
                .thenCompose(function(reader) {
                    var size = that.getFileSize(props);
                    var data = convertToByteArray(new Int8Array(size));
                    return reader.readIntoArray(data, 0, data.length)
                        .thenApply(function(read){
                            let func = function() {
                                iframe.contentWindow.postMessage({action: "respondToNavigateTo", text:new TextDecoder().decode(data)}, '*');
                            };
                            that.setupIFrameMessaging(iframe, func);
                        });
            }).exceptionally(function(throwable) {
                that.showMessage("Unexpected error", throwable.detailMessage);
                console.log('Error loading file: ' + name);
                console.log(throwable.getMessage());
            });
        },
        setupIFrameMessaging: function(iframe, func) {
            if (this.isIframeInitialised) {
                func();
            } else {
                iframe.contentWindow.postMessage({action: 'ping'}, '*');
                let that = this;
                window.setTimeout(function() {that.setupIFrameMessaging(iframe, func);}, 20);
            }
        },
        showMessage: function(isError, title, body) {
            let bodyContents = body == null ? '' : ' ' + body;
            if (isError) {
                this.$toast.error(title + bodyContents, {timeout:false});
            } else {
                this.$toast(title + bodyContents)
            }
        },
        close: function () {
            this.$emit("hide-markdown-viewer");
        },
        isWritable: function() {
            return this.isFileWritable;
        },
        editMarkdown: function() {
            this.openFileOrDir("editor", '/' + this.pathToFile, this.currentFilename);
        },

        showMediaRequest: function(filePath) {
            let that = this;
            let fullPath = this.updatePath(filePath, false);
            that.findFile(fullPath).thenApply(file => {
                if (file != null) {
                    let type = file.props.getType();
                    if(type == "image" || type == "audio" || type == "video") {
                        this.openInGallery(file);
                    } else {
                        console.log("unable to display resource in gallery");
                    }
                } else {
                    console.log("unable to find resource");
                }
            });
        },
        openInGallery: function (file) {
            this.filesToViewInGallery = [file];
            this.showEmbeddedGallery = true;
        },
        loadImageRequest: function(iframe, src, id) {
            let that = this;
            this.loadResource(src, false).thenApply(data => {
                if (data != null) {
                    let func = function() {
                      iframe.contentWindow.postMessage({action: "respondToLoadImage", id:id, data: data}, '*');
                    };
                    that.setupIFrameMessaging(iframe, func);
                }
            });
        },
        navigateToRequest: function(iframe, filePath) {
            let that = this;
            if (filePath.toLowerCase().endsWith('.md')) {
                this.loadResource(filePath, true).thenApply(data => {
                    if (data != null) {
                        let func = function() {
                          iframe.contentWindow.postMessage({action: "respondToNavigateTo", text:new TextDecoder().decode(data)}, '*');
                        };
                        that.setupIFrameMessaging(iframe, func);
                    }
                });
            } else {
                console.log("not implemented!");
            }
        },
        updatePath: function(filePath, updateDisplayPath) {
            let peergosPath = filePath.startsWith(this.PATH_PREFIX) ? filePath.substring(this.PATH_PREFIX.length) : filePath;
            let peergosPathWithoutSlash = peergosPath.startsWith('/') ? peergosPath.substring(1) : peergosPath;
            let fullPath = this.pathToFile + '/' + peergosPathWithoutSlash;
            if (updateDisplayPath) {
                this.displayPath = fullPath;
            }
            return fullPath;
        },
        loadResource: function(filePath, updateDisplayPath) {
            let that = this;
            let fullPath = this.updatePath(filePath, updateDisplayPath);
            var future = peergos.shared.util.Futures.incomplete();
            that.findFile(fullPath).thenApply(file => {
                if (file != null) {
                    that.readInFile(file).thenApply(bytes => {
                        future.complete(bytes);
                    });
                } else {
                    future.complete(null);
                }
            });
            return future;
        },
        findFile: function(filePath) {
            var future = peergos.shared.util.Futures.incomplete();
            this.context.getByPath(filePath).thenApply(function(fileOpt){
                if (fileOpt.ref == null) {
                    console.log("path not found!:" + filePath);
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
        readInFile: function(file) {
            let that = this;
            const props = file.getFileProperties();
            var future = peergos.shared.util.Futures.incomplete();
            file.getInputStream(this.context.network, this.context.crypto, props.sizeHigh(), props.sizeLow(), function(read){})
                .thenCompose(function(reader) {
                    var size = that.getFileSize(props);
                    var data = convertToByteArray(new Int8Array(size));
                    return reader.readIntoArray(data, 0, data.length).thenApply(function(read){
                        future.complete(data);
                    });
            }).exceptionally(function(throwable) {
                that.showMessage(true, "Unexpected error", throwable.detailMessage);
                console.log('Error loading file: ' + that.file.getName());
                console.log(throwable.getMessage());
                future.complete(null);
            });
            return future;
        },
        getFileSize: function(props) {
                var low = props.sizeLow();
                if (low < 0) low = low + Math.pow(2, 32);
                return low + (props.sizeHigh() * Math.pow(2, 32));
        }
    }
}
