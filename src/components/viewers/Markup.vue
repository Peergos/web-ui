<template>
<transition name="modal">
<div class="pg-viewer__mask" @click="close">
    <section class="pg-viewer" role="dialog" aria-modal="true" :aria-label="displayName" @click.stop>
        <header class="pg-viewer__bar">
            <span class="pg-viewer__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h5"/></svg>
            </span>
            <div class="pg-viewer__heading">
                <h2 class="pg-viewer__title">{{ displayName }}</h2>
                <span v-if="displayFolder.length > 0" class="pg-viewer__path">{{ displayFolder }}</span>
            </div>
            <button v-if="canBookmark" type="button" class="pg-icon-btn" aria-label="Bookmark"
                    :aria-pressed="displayToBookmark ? 'false' : 'true'"
                    :title="displayToBookmark ? 'Bookmark' : 'Remove bookmark'"
                    @click="toggleBookmark(!displayToBookmark)">
                <svg viewBox="0 0 24 24" :fill="displayToBookmark ? 'none' : 'currentColor'" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
            <button v-if="isWritable() && isMarkdown()" type="button" class="pg-btn" aria-label="Edit" @click="launchEditor">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>
                <span class="pg-viewer__label">Edit</span>
            </button>
            <span v-if="canBookmark || (isWritable() && isMarkdown())" class="pg-viewer__divider" aria-hidden="true"></span>
            <DialogClose @close="close"/>
        </header>

        <div class="pg-viewer__body">
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
            <!-- the page's frame is added here once the file is known -->
            <div id="md-container" style="display:flex;flex:1 1 auto;min-width:0;"></div>
        </div>
    </section>
</div>
</transition>
</template>

<script>
    const Confirm = require("../confirm/Confirm.vue");
    const DialogClose = require("../dialog/DialogClose.vue");
    const Gallery = require("../drive/DriveGallery.vue");
    const Spinner = require("../spinner/Spinner.vue");

    const launcherMixin = require("../../mixins/launcher/index.js");
    const mixins = require("../../mixins/downloader/index.js");
    const routerMixins = require("../../mixins/router/index.js");

module.exports = {
    components: {
        Confirm,
        DialogClose,
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
            // a bookmark is a path, and a page inside an archive has one only while it is open
            isArchiveEntry: false,
            targetFile: null,
        }
    },
    props: ['propAppArgs', 'archiveResolver'],
    mixins:[mixins, routerMixins, launcherMixin],
    computed: {
        ...Vuex.mapState([
            'context',
            "shortcuts",
        ]),
        ...Vuex.mapGetters([
            'isSecretLink'
        ]),
        // the bar names the file and, under it, its folder: the two halves of the path it had
        displayName: function() {
            let path = this.fullPathForDisplay;
            return path.substring(path.lastIndexOf('/') + 1);
        },
        displayFolder: function() {
            let path = this.fullPathForDisplay;
            let slash = path.lastIndexOf('/');
            return slash > 0 ? path.substring(0, slash) : '';
        },
        canBookmark: function() {
            return ! this.isSecretLink && ! this.isArchiveEntry && this.fullPathForDisplay.length > 0;
        }
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
                that.isArchiveEntry = file.isArchiveEntry === true;
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
                    that.isArchiveEntry = file.isArchiveEntry === true;
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
        // a path inside a zip the drive is looking at, which getByPath cannot resolve
        let entry = this.archiveResolver == null ? null : this.archiveResolver(filePath);
        if (entry != null) {
            if (allowFolder != true && entry.getFileProperties().isDirectory) {
                this.showErrorMessage("folder not accessible: " + filePath);
                future.complete(null);
            } else {
                future.complete(entry);
            }
            return future;
        }
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
