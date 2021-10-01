<template>
<transition name="modal">
    <div class="modal-mask" @click="close">
        <div class="modal-container full-height" @click.stop style="width:100%;overflow-y:auto;padding:0;display:flex;flex-flow:column;">
            <div class="modal-header" style="padding:0">
                <h2>{{displayPath}}</h2>
                <span style="position:absolute;top:0;right:0.2em;">
                    <span v-if="isWritable()" @click="editMarkdown" tabindex="0" v-on:keyup.enter="editMarkdown"  style="color:black;font-size:2.5em;font-weight:bold;cursor:pointer;margin:.3em;" class="fa fa-edit" title="Preview"></span>
	                <span @click="close" tabindex="1" v-on:keyup.enter="close" style="color:black;font-size:3em;font-weight:bold;cursor:pointer;">&times;</span>
	            </span>
            </div>
            <div class="modal-body" style="margin:0;padding:0;display:flex;flex-grow:1;">
                <gallery
                        v-if="showEmbeddedGallery"
                        v-on:hide-gallery="showEmbeddedGallery = false"
                        :files="filesToViewInGallery"
                        :hideGalleryTitle="true"
                        :context="context">
                </gallery>
                <iframe id="browser-iframe" :src="frameUrl()" style="width:100%;height:100%;" frameBorder="0"></iframe>
            </div>
        </div>
    </div>
</transition>
</template>

<script>
const routerMixins = require("../../../mixins/router/index.js");

module.exports = {
    components: {
    },
    mixins:[routerMixins],
    data: function() {
        return {
            showSpinner: false,
	        currentFile: null,
	        currentBrowserPath: null,
	        isIframeInitialised: false,
            FILE_NOT_FOUND: 2,
            PATH_PREFIX: '/apps/markdown/',
            displayPath: '',
            showEmbeddedGallery: false,
            filesToViewInGallery: [],
            isFileWritable: false
        }
    },
    computed: {
    ...Vuex.mapState([
        'context',
    ]),
    ...Vuex.mapGetters([
        'isSecretLink',
        'getPath',
        'currentFilename',
    ]),
    },
    mounted(){
    },
    props: [],
    created: function() {
        const props = this.getPropsFromUrl();
        let completePath = null;
        if (props.secretLink) {
            this.currentBrowserPath = this.getPath;
            completePath = this.currentBrowserPath + (this.currentBrowserPath.endsWith("/") ? "" : "/") + this.currentFilename;
        } else {
            this.currentBrowserPath = props.path;
            completePath = this.currentBrowserPath + (this.currentBrowserPath.endsWith("/") ? "" : "/") + props.filename;
        }
        let that = this;
        this.context.getByPath(completePath).thenApply(fileOpt => {
            if (! fileOpt.isPresent()) {
                that.$toast.error("Couldn't load file: " + path, {timeout:false})
                return;
            }
            let file = fileOpt.get();
            that.currentFile = file;
            that.isFileWritable = this.currentFile.isWritable();
            that.startListener();
        });
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
            if (this.currentFile != null) {
                this.displayPath = this.currentBrowserPath + this.currentFile.getName();
                this.readInFile(this.currentFile).thenApply(data => {
                    let func = function() {
                        iframe.contentWindow.postMessage({action: "respondToNavigateTo", text:new TextDecoder().decode(data)}, '*');
                    };
                    that.setupIFrameMessaging(iframe, func);
                });
            }
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
            //this.editMarkdownFile(this.currentFile);
            this.openFileOrDir("editor", this.editPath, this.editedFilename);
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
            this.loadResource(filePath, true).thenApply(data => {
                if (data != null) {
                    let func = function() {
                      iframe.contentWindow.postMessage({action: "respondToNavigateTo", text:new TextDecoder().decode(data)}, '*');
                    };
                    that.setupIFrameMessaging(iframe, func);
                }
            });
        },
        updatePath: function(filePath, updateDisplayPath) {
            let peergosPath = filePath.startsWith(this.PATH_PREFIX) ? filePath.substring(this.PATH_PREFIX.length) : filePath;
            let peergosPathWithoutSlash = peergosPath.startsWith('/') ? peergosPath.substring(1) : peergosPath;
            let fullPath = this.currentBrowserPath + peergosPathWithoutSlash;
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
        }
    }
}