<template>
<transition name="modal">
<div class="modal-mask" @click="close">
    <meta http-equiv="content-type" content="text/html; charset=utf-8" />
    <div @click.stop class="app-install-container">
        <span @click="close" tabindex="0" v-on:keyup.enter="close" aria-label="close" class="close">&times;</span>
        <div class="modal-header">
            <h2>App Installation</h2>
        </div>
        <div class="modal-body">
            <spinner v-if="showSpinner"></spinner>
            <confirm
                    v-if="showConfirm"
                    v-on:hide-confirm="showConfirm = false"
                    :confirm_message='confirm_message'
                    :confirm_body="confirm_body"
                    :consumer_cancel_func="confirm_consumer_cancel_func"
                    :consumer_func="confirm_consumer_func">
            </confirm>
            <div v-if="appProperties != null">
                <div class="app-install-view">
                    <p>
                        <span class="app-install-span">Name:</span><span>{{appProperties.details.displayName}}&nbsp;
                        {{appProperties.details.majorVersion}}.{{appProperties.details.minorVersion}}
                        </span>
                    </p>
                    <p>
                        <span class="app-install-span">Description:</span><span class="app-install-text">{{appProperties.details.description}}</span>
                    </p>
                    <p>
                        <span class="app-install-span">Support:</span><span class="app-install-text">{{appProperties.details.supportAddress}}</span>
                    </p>
                    <p>
                        <span v-if="appProperties.details.fileExtensions.length > 0" class="app-install-span">Associated File extensions:</span><span class="app-install-text">{{appProperties.details.fileExtensions.join(", ")}}</span>
                    </p>
                    <p>
                        <span v-if="appProperties.details.mimeTypes.length > 0" class="app-install-span">Associated Mime types:</span><span class="app-install-text">{{appProperties.details.mimeTypes.join(", ")}}</span>
                    </p>
                    <p>
                        <span v-if="appProperties.details.fileTypes.length > 0" class="app-install-span">Associated File types:</span><span class="app-install-text">{{appProperties.details.fileTypes.join(", ")}}</span>
                    </p>
                    <p>
                        <span v-if="appProperties.details.folderAction==true" class="app-install-span">Is a Folder Action</span>
                    </p>
                    <p v-if="appProperties.permissions.length == 0">
                        <span class="app-install-span">Permissions:</span><span class="app-install-text">None Required</span>
                    </p>
                    <p v-if="appProperties.permissions.length > 0">
                        <span class="app-install-span">Permissions:</span><span class="app-install-text">{{appProperties.permissions.join(", ")}}</span>
                    </p>
                </div>
                <div class="flex-line-item">
                    <div>
                        <button class="btn btn-success" style = "width:100%" @click="installNewApp()">Install</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
</transition>
</template>

<script>
const mixins = require("../../mixins/mixins.js");
const downloaderMixin = require("../../mixins/downloader/index.js");
const sandboxMixin = require("../../mixins/sandbox/index.js");

module.exports = {
    data: function() {
        return {
            showSpinner: false,
            spinnerMessage: '',
            appProperties: null,
            showConfirm: false,
            confirm_message: "",
            confirm_body: "",
            confirm_consumer_cancel_func: () => {},
            confirm_consumer_func: () => {}
        }
    },
    props: ['appPropsFile'],
    mixins:[mixins, downloaderMixin, sandboxMixin],
    computed: {
        ...Vuex.mapState([
            'quotaBytes',
            'usageBytes',
            'context',
            'mirrorBatId'
        ]),
        ...Vuex.mapGetters([
            'getPath',
        ])
    },
    created: function() {
        this.loadAppProperties();
    },
    methods: {
        getMirrorBatId(file) {
            return file.getOwnerName() == this.context.username ? this.mirrorBatId : java.util.Optional.empty()
        },
        close: function () {
            this.$emit("hide-app-installation");
        },
        loadAppProperties: function() {
            let that = this;
            this.showSpinner = true;
            that.verifyJSONFile(this.appPropsFile).thenApply((res) => {
                that.showSpinner = false;
                if (res.errors.length > 0) {
                    that.showError("Unable to install App: " + res.errors.join(', '));
                    that.close();
                } else {
                    that.appProperties = res.props;
                }
            });
        },
        checkAvailableSpace: function(fileSize) {
            return Number(this.quotaBytes.toString()) - (Number(this.usageBytes.toString()) + fileSize);
        },
        confirmReplaceAppInstall(appName, replaceFunction, cancelFunction) {
            this.confirm_message = 'App: ' + appName + ' already installed!';
            this.confirm_body = "Are you sure you want to replace existing installation?";
            this.confirm_consumer_cancel_func = cancelFunction;
            this.confirm_consumer_func = replaceFunction;
            this.showConfirm = true;
        },
        installNewApp: function() {
            if (this.appProperties == null) {
                return;
            }
            let appName = this.appProperties.details.name;
            let that = this;
            this.showSpinner = true;
            this.context.getByPath("/" + this.context.username + "/.apps/" + appName).thenApply(appOpt => {
                if (appOpt.ref != null) {
                    that.confirmReplaceAppInstall(appName,
                        () => {
                            that.showConfirm = false;
                            that.installApp();
                        },
                        () => {
                            that.showConfirm = false;
                            that.showSpinner = false;
                        }
                    );
                } else {
                    that.installApp();
                }
            });
        },
       installApp: function() {
           let that = this;
           let displayName = this.appProperties.details.displayName;
           let appName = this.appProperties.details.name;
           let srcPath = that.getPath.substring(0, that.getPath.length -1);
           that.context.getByPath(that.getPath).thenApply(srcDirectoryOpt => {
               that.calculateTotalSize(srcDirectoryOpt.ref, srcPath).thenApply(statistics => {
                   let spaceAfterOperation = that.checkAvailableSpace(statistics.apparentSize);
                   if (spaceAfterOperation < 0) {
                       that.showError("App installation size exceeds available Space.  Please free up " + that.convertBytesToHumanReadable('' + -spaceAfterOperation) + " and try again");
                       that.showSpinner = false;
                   } else {
                       that.spinnerMessage = "Installing App: " + displayName;
                       peergos.shared.user.App.init(that.context, appName).thenApply(ready => {
                             let future = peergos.shared.util.Futures.incomplete();
                             that.gatherAppFiles([{directory: srcDirectoryOpt.ref, path: srcPath}], 0, appName, future, []);
                             future.thenApply(appFiles => that.copyAllFiles(appFiles, appName, displayName));
                       });
                   }
               });
           });
       },
        gatherAppFiles: function(directoryEntries, index, app, future, accumulator) {
            if (index == directoryEntries.length) {
                future.complete(accumulator);
            } else {
                let that = this;
                let directoryEntry = directoryEntries[index];
                let fileProperties = directoryEntry.directory.getFileProperties();
                if (fileProperties.isHidden) {
                    this.gatherAppFiles(directoryEntries, index +1, app, future, accumulator);
                } else {
                    directoryEntry.directory.getChildren(this.context.crypto.hasher, this.context.network).thenApply(function(children) {
                        let arr = children.toArray();
                        arr.forEach(child => {
                            if (child.getFileProperties().isDirectory) {
                                directoryEntries.push({directory: child, path: directoryEntry.path + "/" + child.getFileProperties().name});
                            } else {
                                accumulator.push({path: directoryEntry.path, file: child});
                            }
                        });
                        that.gatherAppFiles(directoryEntries, index +1, app, future, accumulator);
                    });
                }
            }
        },
        copyAllFiles: function(appFiles, app, displayName) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let appSourceDirName = appFiles[0].path.substring(appFiles[0].path.lastIndexOf("/"));
            this.reduceCopyingAllAppFiles(appSourceDirName, appFiles, 0, future, app);
            future.thenApply(res => {
                that.registerApp(that.appProperties);
                that.showMessage("Installed App: " + displayName);
                that.showSpinner = false;
                that.spinnerMessage = "";
                that.close();
            });
        },
        reduceCopyingAllAppFiles: function(appSourceDirName, appFiles, index, future, app) {
            let that = this;
            if (index == appFiles.length) {
                future.complete(true);
            } else {
                let entry = appFiles[index];
                that.copyFile(appSourceDirName, entry.path, entry.file, app).thenApply(function(res){
                    that.reduceCopyingAllAppFiles(appSourceDirName, appFiles, index + 1, future, app);
                }).exceptionally(function(throwable) {
                    console.log('Unable to install App. Error: ' +  + throwable.getMessage());
                    that.showError("Unable to install App. See console for details");
                });
            }
        },
        copyFile: function(appSourceDirName, sourcePath, sourceFile, appName) {
            let future = peergos.shared.util.Futures.incomplete();
            let that = this;
            let path = ".apps" + sourcePath.substring(sourcePath.indexOf(appSourceDirName)).replace(appSourceDirName, "/" + appName);
            let appDir = peergos.client.PathUtils.directoryToPath(path.split('/'));
            this.context.getByPath("/" + this.context.username).thenApply(rootOpt => {
                rootOpt.get().getOrMkdirs(appDir, that.context.network, true, that.getMirrorBatId(rootOpt.get()), that.context.crypto).thenApply(dir => {
                    dir.getChild(sourceFile.getName(), this.context.crypto.hasher, this.context.network).thenApply(destFileOpt => {
                        if (destFileOpt.ref != null) {
                            destFileOpt.ref.replaceFile(sourceFile, that.context.network, this.context.crypto, () => {}).thenApply(() => {
                                future.complete(true);
                            });
                        } else {
                            sourceFile.copyTo(dir, that.context).thenApply(function() {
                                future.complete(true);
                            });
                        }
                    });
                });
            });
            return future;
        },
        showMessage: function(message) {
            this.$toast(message)
        },
        showError: function(message) {
            this.$toast.error(message, {timeout:false});
        }
    }
}
</script>
<style>
.app-install-container {
    width: 40%;
    height: 100%;
    overflow-y: auto;
    position: fixed;
    left: 50%;
    transform: translate(-50%, 0);
    padding: 20px 30px;
    background-color: var(--bg);
    border-radius: 2px;
    box-shadow: 0 2px 8px rgba(0,0,0,.33);
    transition: all .3s ease;
}

.app-install-view {
    font-size: 1.3em;
}
.app-install-text {
    font-size: 1.0em;
}
.app-install-span {
    font-weight: bold;
    padding-right: 10px;
}
</style>
