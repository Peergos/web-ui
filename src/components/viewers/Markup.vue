<template>
<transition name="modal">
<div class="modal-mask" @click="close"> 
    <div class="modal-container full-height" @click.stop style="width:100%;overflow-y:auto;padding:0;display:flex;flex-flow:column;">
        <div class="modal-header" style="padding:0">
            <center>
                <h2>
                    <span v-if="!isSecretLink && fullPathForDisplay.length > 0" style="z-index:9999">
                          <img v-if="displayToBookmark" src="/images/bookmark-o.svg" @click="toggleBookmark(false)" style="height:24px;width:24px;cursor:pointer;">
                          <img v-if="!displayToBookmark" src="/images/bookmark.svg" @click="toggleBookmark(true)" style="height:24px;width:24px;cursor:pointer;">
                    </span>
                    {{ getFullPathForDisplay() }}
                </h2>
            </center>
          <span style="position:absolute;top:0;right:0.2em;">
            <span v-if="isWritable() && isMarkdown()" @click="launchEditor" tabindex="0" v-on:keyup.enter="launchEditor"  style="color:black;font-size:2.5em;font-weight:bold;cursor:pointer;margin:.3em;" class='fas fa-edit' title="Edit file"></span>
            <span @click="close" tabindex="0" v-on:keyup.enter="close" style="color:black;font-size:3em;font-weight:bold;cursor:pointer;font-family:'Cambria Math'">&times;</span>
          </span>
        </div>

        <div class="modal-body" style="margin:0;padding:0;display:flex;flex-grow:1;">
            <Spinner v-if="showSpinner"></Spinner>
            <Confirm
                    v-if="showConfirm"
                    v-on:hide-confirm="showConfirm = false"
                    :confirm_message='confirm_message'
                    :confirm_body="confirm_body"
                    :consumer_cancel_func="confirm_consumer_cancel_func"
                    :consumer_func="confirm_consumer_func">
            </Confirm>
            <Gallery
                    v-if="showEmbeddedGallery"
                    v-on:hide-gallery="showEmbeddedGallery = false"
                    :files="filesToViewInGallery"
                    :hideGalleryTitle="false"
                    :context="context">
            </Gallery>
            <div id='md-container' class="modal-body" style="margin:0;padding:0;display:flex;flex-grow:1;">
        </div>
    </div>
</div>
</transition>
</template>

<script>
    const Confirm = require("../confirm/Confirm.vue");
    const Gallery = require("../drive/DriveGallery.vue");
    const Spinner = require("../spinner/Spinner.vue");

    const launcherMixin = require("../../mixins/launcher/index.js");
    const mixins = require("../../mixins/downloader/index.js");
    const routerMixins = require("../../mixins/router/index.js");

module.exports = {
    components: {
        Confirm,
        Gallery,
        Spinner
    },
    data: function() {
        return {
            showSpinner: false,
	        currPath: null,
	        currFilename: null,
	        isIframeInitialised: false,
            APP_NAME: 'markup-viewer',
            PATH_PREFIX: '/apps/markup-viewer/',
            showEmbeddedGallery: false,
            filesToViewInGallery: [],
            validImageSuffixes: ['jpg','jpeg','png','gif','webp'],
            validMediaSuffixes: ['mpg','mp3','mp4','avi','webm'],
            validResourceSuffixes: ['md', 'note'],//,'pdf','zip'];
            validResourceMimeTypes: ['text/x-markdown', 'text/'],
            scopedPath: null,
            updatedPath: '',
            updatedFilename: '',
            fullPathForDisplay: '',
            isFileWritable: false,
            showConfirm: false,
            confirm_message: "",
            confirm_body: "",
            confirm_consumer_cancel_func: () => {},
            confirm_consumer_func: () => {},
            launcherApp: null,
            displayToBookmark: true,
            targetFile: null,
        }
    },
    props: ['propAppArgs'],
    mixins:[mixins, routerMixins, launcherMixin],
    computed: {
        ...Vuex.mapState([
            'context',
            "shortcuts",
        ]),
        ...Vuex.mapGetters([
            'isSecretLink'
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
        let subPath = props.args.subPath != null && props.args.subPath.length > 0 ? props.args.subPath + "/" : "";
        let path = '/' + props.path;
        var completePath = '';
        if (subPath.length == 0 || props.args.subPath == path) {
            completePath = props.path + '/' + filename
        } else {
            completePath = subPath + filename
        }
        this.currFilename = filename;

        this.currPath = path;
        this.scopedPath = path + '/';
        let that = this;
        this.findFile(completePath, false).thenApply(file => {
            if (file != null) {
                that.isFileWritable = file.isWritable();
                that.readInFile(file).thenApply(data => {
                    that.setFullPathForDisplay();
                    that.targetFile = file;
                    let theme = that.$store.getters.currentTheme;
                    let subPath = that.propAppArgs.subPath != null ? that.propAppArgs.subPath
                                    : that.scopedPath.substring(0, that.scopedPath.length -1);
                    let extension = that.currFilename.substring(that.currFilename.lastIndexOf('.') + 1);
                    let func = function(iframe) {
                        iframe.contentWindow.postMessage({action: "respondToNavigateTo", theme: theme
                            , text:new TextDecoder().decode(data), extension: extension, subPath: subPath}, '*');
                        that.showSpinner = false;
                    };

                    that.resetEditor(func);
                });
            }
        });
    },
    methods: {
        launchEditor: function() {
            this.openFileOrDir("editor", this.currPath, {filename:this.currFilename});
        },
        isMarkdown: function() {
            return this.currFilename != null && this.currFilename.endsWith(".md");
        },
        isWritable: function() {
            return this.isFileWritable;
        },
        goToPage: function() {
            let filename = this.propAppArgs.filename;
            let subPath = this.propAppArgs.subPath != null ? this.propAppArgs.subPath
                : this.scopedPath.substring(0, this.scopedPath.length -1);
            let completePath = subPath + '/' + filename;
            this.currPath = subPath;
            this.currFilename = filename;
            let extension = filename.substring(filename.lastIndexOf('.') + 1);
            let that = this;
            this.showSpinner = true;
            let theme = this.$store.getters.currentTheme;
            this.findFile(completePath, false).thenApply(file => {
                if (file != null) {
                    that.readInFile(file).thenApply(data => {
                        that.setFullPathForDisplay();
                        that.targetFile = file;
                        let func = function(iframe) {
                            iframe.contentWindow.postMessage({action: "respondToNavigateTo", theme: theme, text:new TextDecoder().decode(data)
                                , extension: extension, subPath: subPath}, '*');
                            that.showSpinner = false;
                        };
                        that.resetEditor(func);
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
        messageHandler: function(e) {
            let that = this;
            let iframe = document.getElementById("md-editor");
            let win = iframe.contentWindow;
            if (win == null ) {
                that.close();
            } else {
                if ((e.origin === "null" || e.origin === that.frameDomain()) && e.source === iframe.contentWindow) {
                    if (e.data.action == 'pong') {
                        that.isIframeInitialised = true;
                    } else if(e.data.action == 'navigateTo') {
                        that.navigateToRequest(iframe, e.data.path);
                    } else if(e.data.action == 'externalLink') {
                        that.navigateToExternalLink(e.data.url);
                    } else if(e.data.action == 'loadImage') {
                        that.loadImageRequest(iframe, e.data.src, e.data.id);
                    } else if(e.data.action == 'showMedia') {
                        that.showMediaRequest(e.data.path);
                    }
                }
            }
        },
        resetEditor: function(func) {
            let iframe = document.getElementById("md-editor");
            if (iframe != null) {
                iframe.parentNode.removeChild(iframe);
                window.removeEventListener('message', this.messageHandler);
            }
            this.isIframeInitialised = false;
            let that = this;
            peergos.shared.user.App.init(this.context, "launcher").thenApply(launcher => {
                that.launcherApp = launcher;
                that.startListener(func);
            });
        },
        startListener: function(func) {
            let that = this;
            let iframeContainer = document.getElementById("md-container");
            let iframe = document.createElement('iframe');
            iframe.id = 'md-editor';
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.frameBorder="0";
            iframeContainer.appendChild(iframe);

            Vue.nextTick(function() {
                iframe.src = that.frameUrl();
                window.addEventListener('message', that.messageHandler);
                that.showSpinner = true;
                that.setupIFrameMessaging(iframe, func);
                setTimeout(() => {
                    if (!that.isIframeInitialised)
                        that.$toast.error("Unable to register service worker. Viewer will not work offline. \nTo enable offline usage, allow 3rd party cookies for " + window.location.protocol + "//[*]." + window.location.host + "\n Note: this is not tracking", {timeout:false});
                }, 1000 * 10);
            });
        },
        toggleBookmark: function(remove) {
            if(this.showSpinner || this.isSecretLink) {
                return;
            }
            let that = this;
            let address = this.fullPathForDisplay;
            if (address.length <= 1) {
                return;
            }
            let bookmark = this.shortcuts.shortcutsMap.get(address);
            let fileCreatedDate = new Date(this.targetFile.getFileProperties().created.toString() + "+00:00")
            if (remove) {
                if (bookmark != null) {
                    this.refreshAndDeleteBookmark(address);
                }
            } else {
                if (bookmark == null) {
                    this.refreshAndAddBookmark(address, fileCreatedDate);
                }
            }
        },
        refreshAndAddBookmark(link, created) {
            let that = this;
            this.showSpinner = true;
            this.loadShortcutsFile(this.launcherApp).thenApply(shortcutsMap => {
                if (shortcutsMap.get(link) == null) {
                    let entry = {added: new Date(), created: created};
                    shortcutsMap.set(link, entry)
                    that.updateShortcutsFile(that.launcherApp, shortcutsMap).thenApply(res => {
                        that.showSpinner = false;
                        that.displayToBookmark = false;
                        that.$store.commit("SET_SHORTCUTS", shortcutsMap);
                    });
                } else {
                    that.showSpinner = false;
                }
            })
        },
        refreshAndDeleteBookmark(link) {
            let that = this;
            this.showSpinner = true;
            this.loadShortcutsFile(this.launcherApp).thenApply(shortcutsMap => {
                if (shortcutsMap.get(link) != null) {
                    shortcutsMap.delete(link)
                    that.updateShortcutsFile(that.launcherApp, shortcutsMap).thenApply(res => {
                        that.showSpinner = false;
                        that.displayToBookmark = true;
                        that.$store.commit("SET_SHORTCUTS", shortcutsMap);
                    });
                } else {
                    that.showSpinner = false;
                }
            })
        },
	setupIFrameMessaging: function(iframe, func) {
        if (this.isIframeInitialised) {
            func(iframe);
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
        if (this.shortcuts.shortcutsMap.get(this.fullPathForDisplay) == null) {
            this.displayToBookmark = true;
        } else {
            this.displayToBookmark = false;
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
    showErrorMessage(errMsg) {
        console.log(errMsg);
        this.showMessage(true, "", errMsg);
        this.showSpinner = false;
    },
    close: function () {
        window.removeEventListener('message', this.messageHandler);
        this.$emit("hide-markup-viewer");
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
            return this.calculateFullPath(filePath, updateFullPath);
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
            that.findFile(fullPath, false).thenApply(file => {
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
    findFile: function(filePath, allowFolder) {
        let that = this;
        var future = peergos.shared.util.Futures.incomplete();
        this.context.getByPath(filePath).thenApply(function(fileOpt){
            if (fileOpt.ref == null) {
                //that.showErrorMessage("path not found!: " + filePath);
                future.complete(null);
            } else {
                let file = fileOpt.get();
                const props = file.getFileProperties();
                if (props.isHidden) {
                    that.showErrorMessage("file not accessible: " + filePath);
                    future.complete(null);
                }
                if (allowFolder != true && props.isDirectory) {
                    that.showErrorMessage("folder not accessible: " + filePath);
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
        that.findFile(fullPath, false).thenApply(file => {
            if (file != null) {
                let type = file.props.getType();
                if(this.hasValidFileExtension(fullPath, allMediaSuffixes, false) && (type == "image" || type == "audio" || type == "video")) {
                    that.openInGallery(file);
                } else {
                    let slashIndex = fullPath.lastIndexOf('/');
                    let filename = slashIndex >=0 ? fullPath.substring(slashIndex +1) : fullPath;
                    that.openFileOrDir("Drive", fullPath, {filename:filename});
                }
            } else {
                that.showErrorMessage("unable to find resource: " + fullPath);
            }
        });
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
    confirmNavigationToExternalLink(url, confirmFunction, cancelFunction) {
        this.confirm_message='External Link Confirmation';
        this.confirm_body='You are about to open another browser tab and visit: ' + url;
        this.confirm_consumer_cancel_func = cancelFunction;
        this.confirm_consumer_func = confirmFunction;
        this.showConfirm = true;
    },
    openLinkInNewTab: function(url) {
        let link = document.createElement('a');
        let click = new MouseEvent('click');
        link.rel = "noopener noreferrer";
        link.target = "_blank"
        link.href = url;
        link.dispatchEvent(click);
    },
    navigateToExternalLink: function(url) {
        let that = this;
        if (this.isSecretLink) {
            this.openLinkInNewTab(url);
        } else {
            this.confirmNavigationToExternalLink(url,
                () => {
                    that.showConfirm = false;
                    that.openLinkInNewTab(url);
                },
                () => {
                    that.showConfirm = false;
                }
            );
        }
    },
    navigateToRequest: function(iframe, filePath) {
        let that = this;
        if (this.hasValidFileExtension(filePath, this.validResourceSuffixes, false)) {
            let previousPath = this.currPath;
            this.loadResource(filePath, true, this.validResourceMimeTypes, ["text"]).thenApply(isLoaded => {
                if (isLoaded) {
                    that.currPath = previousPath;
                    that.updateHistory("markup", that.scopedPath, {subPath: that.updatedPath, filename:that.updatedFilename});
                }
            });
        } else {
            var fullPath = this.calculatePath(filePath, false);
            that.findFile(fullPath, true).thenApply(file => {
                if (file != null) {
                    if (file.getFileProperties().isDirectory) {
                        that.openFileOrDir("Drive", fullPath, {filename:""});
                    } else {
                        fullPath = this.calculatePath(filePath, true);
                        let app = that.getApp(file, that.updatedPath);
                        if (app == 'hex') {
                            that.openFileOrDir("Drive", that.updatedPath, {filename:""});
                        } else {
                            that.openFileOrDir(app, that.updatedPath, {filename:that.updatedFilename});
                        }
                    }
                }
            });
        }
    },
    }
}
</script>
