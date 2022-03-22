const Gallery = require("../../drive/DriveGallery.vue");
module.exports = {
    template: require('markdown.html'),
    components: {
        Gallery
    },
    data: function() {
        return {
            showSpinner: false,
	        currentPath: null,
	        currentFilename: null,
	        isIframeInitialised: false,
            APP_NAME: 'markdown-viewer',
            PATH_PREFIX: '/apps/markdown-viewer/',
            showEmbeddedGallery: false,
            filesToViewInGallery: []

        }
    },
    props: ['context', 'file', 'messages', 'path'],
    created: function() {
        this.currentPath = this.path.substring(0, this.path.length - 1);
        this.currentFilename = this.file.getName();
        this.startListener();
    },
    methods: {
	frameUrl: function() {
            return this.frameDomain() + this.PATH_PREFIX + "index.html";
        },
        frameDomain: function() {
            return window.location.protocol + "//" + this.APP_NAME + '.' + window.location.host;
        },
        startListener: function() {
	    var that = this;
	    var iframe = document.getElementById("editor");
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
        this.showSpinner = true;
	    const props = this.file.getFileProperties();
        let theme = this.$store.getters.currentTheme;
	    this.file.getInputStream(this.context.network, this.context.crypto, props.sizeHigh(), props.sizeLow(), function(read){})
	        .thenCompose(function(reader) {
                let size = that.getFileSize(props);
                let data = convertToByteArray(new Int8Array(size));
                return reader.readIntoArray(data, 0, data.length).thenApply(function(read){
                        let func = function() {
                            iframe.contentWindow.postMessage({action: "respondToNavigateTo", theme: theme, text:new TextDecoder().decode(data)}, '*');
                            that.showSpinner = false;
                        };
                        that.setupIFrameMessaging(iframe, func);
                });
        }).exceptionally(function(throwable) {
            that.showSpinner = false;
            that.showMessage(true, "Unexpected error", throwable.detailMessage);
            console.log('Error loading file: ' + that.file.getName());
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
    getFullPath: function() {
        return this.currentPath + '/' + this.currentFilename;
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
    calculatePath: function(filePath, updateFullPath) {
        let peergosPath = filePath.startsWith(this.PATH_PREFIX) ? filePath.substring(this.PATH_PREFIX.length) : filePath;
        let pathElements = peergosPath.split('/').filter(n => n.length > 0);
        var path = this.currentPath;
        var filename = '';
        if (pathElements ==  0) {
            if (updateFullPath) {
                this.currentFilename = filename;
            }
        } else if (pathElements.length == 1) {
            filename =  pathElements[0];
            if (updateFullPath) {
                this.currentFilename = filename;
            }
        } else {
            let directories = pathElements.slice();
            directories.pop();
            path = '/' + directories.join('/');
            filename = pathElements[pathElements.length -1];
            if (updateFullPath) {
                this.currentPath = path;
                this.currentFilename = filename;
            }
        }
        return path + '/' + filename;
    },
    loadResource: function(filePath, updateFullPath) {
        let that = this;
        if (updateFullPath) {
            this.showSpinner = true;
        }
        let fullPath = this.calculatePath(filePath, updateFullPath);
        var future = peergos.shared.util.Futures.incomplete();
        that.findFile(fullPath).thenApply(file => {
            if (file != null) {
                that.readInFile(file).thenApply(bytes => {
                    that.showSpinner = false;
                    future.complete(bytes);
                });
            } else {
                that.showSpinner = false;
                that.showMessage(true, "Resource not found: ", fullPath);
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
                let file = fileOpt.get();
                const props = file.getFileProperties();
                if (props.isHidden || props.isDirectory) {
                    console.log("file not accessible:" + filePath);
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
    showMediaRequest: function(filePath) {
        let that = this;
        let fullPath = this.calculatePath(filePath, false);
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
            console.log("not a markdown file:" + filePath);
        }
    },
    }
}
