<template>
<transition name="modal">
<div class="modal-mask" @click="close"> 
    <div class="modal-container full-height" @click.stop style="width:100%;overflow-y:auto;padding:0;display:flex;flex-flow:column;">
        <div class="modal-header" style="padding:0">
            <center><h2>{{ getFullPathForDisplay() }}</h2></center>
          <span style="position:absolute;top:0;right:0.2em;">
            <span @click="close" tabindex="0" v-on:keyup.enter="close" style="color:black;font-size:3em;font-weight:bold;cursor:pointer;">&times;</span>
          </span>
        </div>

        <div class="modal-body" style="margin:0;padding:0;display:flex;flex-grow:1;">
            <spinner v-if="showSpinner"></spinner>
            <Gallery
                    v-if="showEmbeddedGallery"
                    v-on:hide-gallery="showEmbeddedGallery = false"
                    :files="filesToViewInGallery"
                    :hideGalleryTitle="true"
                    :context="context">
            </Gallery>
	  <iframe id="editor" :src="frameUrl()" style="width:100%;height:100%;" frameBorder="0"></iframe>
        </div>
    </div>
</div>
</transition>
</template>

<script>
    const Gallery = require("../drive/DriveGallery.vue");
    const mixins = require("../../mixins/downloader/index.js");
    const routerMixins = require("../../mixins/router/index.js");

module.exports = {
    components: {
        Gallery
    },
    data: function() {
        return {
            showSpinner: false,
	        currPath: null,
	        currFilename: null,
	        isIframeInitialised: false,
            APP_NAME: 'markdown-viewer',
            PATH_PREFIX: '/apps/markdown-viewer/',
            showEmbeddedGallery: false,
            filesToViewInGallery: [],
            validImageSuffixes: ['jpg','jpeg','png','gif','webp'],
            validMediaSuffixes: ['mpg','mp3','mp4','avi','webm'],
            validResourceSuffixes: ['md'],//,'pdf','zip'];
            validResourceMimeTypes: ['text/x-markdown', 'text/'],
            scopedPath: null,
            updatedPath: '',
            updatedFilename: '',
            fullPathForDisplay: ''
        }
    },
    props: ['propAppArgs'],
    mixins:[mixins, routerMixins],
    computed: {
        ...Vuex.mapState([
            'context'
        ]),
        ...Vuex.mapGetters([
            'getPath',
            'currentFilename'
        ])
    },
    watch: {
        propAppArgs(newQuestion, oldQuestion) {
            this.goToPage();
        }
    },
    created: function() {
        const props = this.getPropsFromUrl();
        
        let filename = props.args.filename;
        let completePath = props.path + '/' + filename;
        let path = '/' + props.path +'/';
        this.currFilename = filename;

        this.currPath = path.substring(0, path.length - 1);
        this.scopedPath = path;
        let that = this;
        this.findFile(completePath).thenApply(file => {
            if (file != null) {
                that.readInFile(file).thenApply(data => {
                    that.setFullPathForDisplay();
                    that.startListener(data);
                });
            }
        });
    },
    methods: {
        goToPage: function() {
            let filename = this.propAppArgs.filename;
            let subPath = this.propAppArgs.subPath != null ? this.propAppArgs.subPath
                : this.scopedPath.substring(0, this.scopedPath.length -1);
            let completePath = subPath + '/' + filename;
            this.currPath = subPath;
            this.currFilename = filename;
            let that = this;
            this.showSpinner = true;
            this.findFile(completePath).thenApply(file => {
                if (file != null) {
                    that.readInFile(file).thenApply(data => {
                        that.setFullPathForDisplay();
                        let iframe = document.getElementById("editor");
                        let func = function() {
                            iframe.contentWindow.postMessage({action: "respondToNavigateTo", text:new TextDecoder().decode(data)
                                , subPath: subPath}, '*');
                            that.showSpinner = false;
                        };
                        that.setupIFrameMessaging(iframe, func);
                    });
                }
            });
        },
	    frameUrl: function() {
            return this.frameDomain() + this.PATH_PREFIX + "index.html";
        },
        frameDomain: function() {
            return window.location.protocol + "//" + this.APP_NAME + '.' + window.location.host;
        },
        startListener: function(data) {
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
        let theme = this.$store.getters.currentTheme;
        let subPath = this.propAppArgs.subPath != null ? this.propAppArgs.subPath
                        : this.scopedPath.substring(0, this.scopedPath.length -1);
        let func = function() {
            iframe.contentWindow.postMessage({action: "respondToNavigateTo", theme: theme
                , text:new TextDecoder().decode(data), subPath: subPath}, '*');
            that.showSpinner = false;
        };
        that.setupIFrameMessaging(iframe, func);
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
    getFullPathForDisplay: function() {
        return this.fullPathForDisplay;
    },
    setFullPathForDisplay: function() {
        this.fullPathForDisplay = this.currPath + '/' + this.currFilename;
    },
    showMessage: function(isError, title, body) {
        let bodyContents = body == null ? '' : ' ' + body;
        if (isError) {
            this.$toast.error(title + bodyContents, {timeout:false});
        } else {
            this.$toast(title + bodyContents)
        }
    },
    showErrorMessage(errMsg) {
        console.log(errMsg);
        this.showMessage(true, "", errMsg);
        this.showSpinner = false;
    },
    close: function () {
        this.$emit("hide-markdown-viewer");
    },
    hasValidFileExtension: function(path, validExtensions, showErrorMessage) {
        let extensionIndex = path.lastIndexOf('.');
        if (extensionIndex > 0 && extensionIndex < path.length) {
            let extension = path.substring(extensionIndex +1).toLowerCase();
            if (validExtensions.includes(extension)) {
               return true;
            } else {
                if (showErrorMessage) {
                    this.showErrorMessage('file extension not on allowed list: ' + path);
                }
                return false;
            }
        } else {
            if (showErrorMessage) {
                this.showErrorMessage('unable to determine file extension: ' + path);
            }
            return false;
        }
    },
    calculatePath: function(filePath, updateFullPath) {
        if (filePath.startsWith(this.PATH_PREFIX)) {
            return this.calculateFullPath(this.scopedPath + filePath.substring(this.PATH_PREFIX.length), updateFullPath);
        } else {
            let pathElements = filePath.split('/').filter(n => n.length > 0);
            let username = pathElements[0];
            if (username == this.context.username) {
                if (filePath.startsWith(this.scopedPath)) {
                    return this.calculateFullPath(filePath, updateFullPath);
                } else {
                    this.showErrorMessage('Links are restricted to folder: ' + this.scopedPath);
                    return null;
                }
            } else {
                return this.calculateFullPath(filePath, updateFullPath);
            }
        }
    },
    calculateFullPath: function(peergosPath, updateFullPath) {
        let pathElements = peergosPath.split('/').filter(n => n.length > 0);
        var path = this.currPath;
        var filename = '';
        if (pathElements == 0) {
            return null;
        } else if (pathElements.length == 1) {
            filename =  pathElements[0];
            if (updateFullPath) {
                this.updatedPath = path;
                this.updatedFilename = filename;
            }
        } else {
            let directories = pathElements.slice();
            directories.pop();
            path = '/' + directories.join('/');
            filename = pathElements[pathElements.length -1];
            if (updateFullPath) {
                this.updatedPath = path;
                this.updatedFilename = filename;
            }
        }
        return path + '/' + filename;
    },
    findMimeType(mimeType, validMimeTypes) {
        let matches = validMimeTypes.filter(validMimeType => mimeType.startsWith(validMimeType));
        return matches.length > 0;
    },
    loadResource: function(filePath, updateFullPath, validMimeTypes, validFileTypes) {
        let that = this;
        if (updateFullPath) {
            this.showSpinner = true;
        }
        let fullPath = this.calculatePath(filePath, updateFullPath);
        var future = peergos.shared.util.Futures.incomplete();
        if (fullPath == null) {
            future.complete(null);
        } else {
            that.findFile(fullPath).thenApply(file => {
                if (file != null) {
                    let mimeType = file.props.mimeType;
                    let type = file.props.getType();
                    if(validFileTypes.includes(type) || validFileTypes.length == 0) {
                        if (validMimeTypes.length == 0 || that.findMimeType(mimeType, validMimeTypes)) {
                            if (updateFullPath) {
                                that.showSpinner = false;
                                this.currPath = this.updatedPath;
                                this.currFilename = this.updatedFilename;
                                future.complete(true);
                            } else {
                                that.readInFile(file).thenApply(bytes => {
                                    that.showSpinner = false;
                                    future.complete(bytes);
                                });
                            }
                        } else {
                            that.showErrorMessage("Resource not of correct mimetype: " + fullPath);
                            future.complete(null);
                        }
                    } else {
                        that.showErrorMessage("Resource not of correct type: " + fullPath);
                        future.complete(null);
                    }
                } else {
                    that.showSpinner = false;
                    future.complete(null);
                }
            });
        }
        return future;
    },
    findFile: function(filePath) {
        let that = this;
        var future = peergos.shared.util.Futures.incomplete();
        this.context.getByPath(filePath).thenApply(function(fileOpt){
            if (fileOpt.ref == null) {
                that.showErrorMessage("path not found!: " + filePath);
                future.complete(null);
            } else {
                let file = fileOpt.get();
                const props = file.getFileProperties();
                if (props.isHidden || props.isDirectory) {
                    that.showErrorMessage("file not accessible: " + filePath);
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
        if (fullPath == null) {
            return;
        }
        let allMediaSuffixes = this.validMediaSuffixes.concat(this.validImageSuffixes);
        if (this.hasValidFileExtension(fullPath, allMediaSuffixes, true)) {
            that.findFile(fullPath).thenApply(file => {
                if (file != null) {
                    let type = file.props.getType();
                    if(type == "image" || type == "audio" || type == "video") {
                        that.openInGallery(file);
                    } else {
                        that.showErrorMessage("unable to display resource in gallery. Not an allowed filetype");
                    }
                } else {
                    that.showErrorMessage("unable to find resource: " + fullPath);
                }
            });
        }
    },
    openInGallery: function (file) {
        this.filesToViewInGallery = [file];
        this.showEmbeddedGallery = true;
    },
    loadImageRequest: function(iframe, src, id) {
        let that = this;
        if (this.hasValidFileExtension(src, this.validImageSuffixes, true)) {
            this.loadResource(src, false, [], ["image"]).thenApply(data => {
                if (data != null) {
                    let func = function() {
                      iframe.contentWindow.postMessage({action: "respondToLoadImage", id:id, data: data}, '*');
                    };
                    that.setupIFrameMessaging(iframe, func);
                }
            });
        }
    },
    navigateToRequest: function(iframe, filePath) {
        let that = this;
        if (this.hasValidFileExtension(filePath, this.validResourceSuffixes, false)) {
            let previousPath = this.currPath;
            this.loadResource(filePath, true, this.validResourceMimeTypes, ["text"]).thenApply(isLoaded => {
                if (isLoaded) {
                    that.currPath = previousPath;
                    that.updateHistory("markdown", that.scopedPath, {subPath: that.updatedPath, filename:that.updatedFilename});
                }
            });
        } else {
            let fullPath = this.calculatePath(filePath, true);
            that.findFile(fullPath).thenApply(file => {
                if (file != null) {
                    let app = that.getApp(file, that.updatedPath);
                    if (app == 'hex') {
                        that.openFileOrDir("Drive", that.updatedPath, {filename:""});
                    } else {
                        that.openFileOrDir(app, that.updatedPath, {filename:that.updatedFilename});
                    }
                }
            });
        }
    },
    }
}
</script>
