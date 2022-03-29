<template>
<transition name="modal">
<div class="modal-mask" @click="close"> 
    <div class="modal-container full-height" @click.stop style="width:100%;overflow-y:auto;padding:0;display:flex;flex-flow:column;">
        <div class="modal-header" style="padding:0">
            <center><h2>{{ getFullPath() }}</h2></center>
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
    const Gallery = require("../../drive/DriveGallery.vue");
    const mixins = require("../../../mixins/downloader/index.js");
    const routerMixins = require("../../../mixins/router/index.js");

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
            validImageSuffixes: ['jpg','png','gif'],
            validMediaSuffixes: ['mpg','mp3','mp4','avi','webm'],
            validResourceSuffixes: ['md'],//,'pdf','zip'];
            validResourceMimeTypes: ['text/x-markdown', 'text/'],
            scopedPath: null,
            updatedPath: '',
            updatedFilename: ''
        }
    },
    props: [],
    mixins:[mixins, routerMixins],
    computed: {
        ...Vuex.mapState([
            'context'
        ]),
        ...Vuex.mapGetters([
            'isSecretLink',
            'getPath',
            'currentFilename'
        ]),
    },
    created: function() {
        const props = this.getPropsFromUrl();
        var completePath = props.path + '/' + props.filename;
        if (props.secretLink) {
            completePath = this.getPath + '/' + this.currentFilename;
        }
        let path = props.secretLink ? this.getPath : props.path +'/';
        this.currPath = path.substring(0, path.length - 1);
        this.scopedPath = path;
        this.currFilename = props.secretLink ? this.currentFilename : props.filename;
        let that = this;
        this.findFile(completePath).thenApply(file => {
            if (file != null) {
                that.readInFile(file).thenApply(data => {
                    that.startListener(data);
                });
            }
        });
    },
    methods: {
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
        let func = function() {
            iframe.contentWindow.postMessage({action: "respondToNavigateTo", theme: theme, text:new TextDecoder().decode(data)}, '*');
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
    getFullPath: function() {
        return this.currPath + '/' + this.currFilename;
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
    hasValidFileExtension: function(path, validExtensions) {
        let extensionIndex = path.lastIndexOf('.');
        if (extensionIndex > 0 && extensionIndex < path.length) {
            let extension = path.substring(extensionIndex +1).toLowerCase();
            if (validExtensions.includes(extension)) {
               return true;
            } else {
                this.showErrorMessage('file extension not on allowed list: ' + path);
                return false;
            }
        } else {
            this.showErrorMessage('unable to determine file extension: ' + path);
            return false;
        }
    },
    calculatePath: function(filePath, updateFullPath) {
        if (filePath.startsWith(this.PATH_PREFIX)) {
            return this.calculateFullPath(filePath.substring(this.PATH_PREFIX.length), updateFullPath);
        } else {
            let pathElements = filePath.split('/').filter(n => n.length > 0);
            let username = pathElements[0];
            if (username == this.context.username) {
                //then path must be scope to initial directory
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
        } else if (peergosPath.includes('INVALID_PATH/')) {
            this.showErrorMessage('Links cannot contain ..');
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
                            that.readInFile(file).thenApply(bytes => {
                                that.showSpinner = false;
                                if (updateFullPath) {
                                    this.currPath = this.updatedPath;
                                    this.currFilename = this.updatedFilename;
                                    future.complete(true);
                                } else {
                                    future.complete(bytes);
                                }
                            });
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
        if (this.hasValidFileExtension(fullPath, this.validMediaSuffixes)) {
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
        if (this.hasValidFileExtension(src, this.validImageSuffixes)) {
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
        if (this.hasValidFileExtension(filePath, this.validResourceSuffixes)) {
            this.loadResource(filePath, true, this.validResourceMimeTypes, ["text"]).thenApply(isLoaded => {
                if (isLoaded) {
                    that.updateHistory("markdown", this.updatedPath, this.updatedFilename);
                }
            });
        } else {
            //let app = that.getApp(file.get(), linkPath);
            //that.openFileOrDir(app, that.updatedPath, that.updatedFilename);
            //console.log("not a markdown file:" + filePath);
        }
    },
    }
}
</script>