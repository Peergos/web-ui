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
                        <span class="app-install-span">Name:</span><span>{{appProperties.displayName}}&nbsp;
                        {{appProperties.version}}
                        </span>
                    </p>
                    <p>
                        <span class="app-install-span">Description:</span><span class="app-install-text">{{appProperties.description}}</span>
                    </p>
                    <p v-if="appProperties.author.length > 0">
                        <span class="app-install-span">Author:</span><span class="app-install-text">{{appProperties.author}}</span>
                    </p>
                    <p>
                        <span v-if="appProperties.fileExtensions.length > 0" class="app-install-span">Associated File extensions:</span><span class="app-install-text">{{appProperties.fileExtensions.join(", ")}}</span>
                    </p>
                    <p>
                        <span v-if="appProperties.mimeTypes.length > 0" class="app-install-span">Associated Mime types:</span><span class="app-install-text">{{appProperties.mimeTypes.join(", ")}}</span>
                    </p>
                    <p>
                        <span v-if="appProperties.fileTypes.length > 0" class="app-install-span">Associated File types:</span><span class="app-install-text">{{appProperties.fileTypes.join(", ")}}</span>
                    </p>
                    <p>
                        <span v-if="appProperties.folderAction==true" class="app-install-span">Is a Folder Action</span>
                    </p>
                    <p v-if="!appHasFileAssociation && appProperties.permissions.length == 0">
                        <span class="app-install-span">Permissions:</span><span class="app-install-text">None Required</span>
                    </p>
                    <p v-if="appProperties.permissions.length > 0">
                        <span class="app-install-span">Permissions:</span><span class="app-install-text"></span>
                    </p>
                    <p v-if="appProperties.permissions.length > 0">
                        <li v-for="permission in appProperties.permissions">
                          {{ convertPermissionToHumanReadable(permission) }}
                        </li>
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
            appHasFileAssociation: false,
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
            let appPath = that.getPath.substring(0, that.getPath.length -1);
            that.verifyJSONFile(this.appPropsFile, appPath).thenApply((res) => {
                that.showSpinner = false;
                if (res.errors.length > 0) {
                    that.showError("Unable to install App: " + res.errors.join(', '));
                    that.close();
                } else {
                    that.appHasFileAssociation = res.props.fileExtensions.length > 0
                        || res.props.mimeTypes.length > 0
                        || res.props.fileTypes.length > 0;
                    that.appProperties = res.props;
                }
            });
        },
        checkAvailableSpace: function(fileSize) {
            return Number(this.quotaBytes.toString()) - (Number(this.usageBytes.toString()) + fileSize);
        },
        confirmReplaceAppInstall(appName, oldVersion, newVersion, replaceFunction, cancelFunction) {
            this.confirm_message = 'App: ' + appName + ' ' + oldVersion + ' already installed!';
            this.confirm_body = "Are you sure you want to replace with version: " + newVersion + "?";
            this.confirm_consumer_cancel_func = cancelFunction;
            this.confirm_consumer_func = replaceFunction;
            this.showConfirm = true;
        },
        installNewApp: function() {
            if (this.appProperties == null) {
                return;
            }
            let appName = this.appProperties.name;
            let displayName = this.appProperties.displayName;
            let newVersion = this.appProperties.version;
            let that = this;
            this.showSpinner = true;
            this.context.getByPath("/" + this.context.username + "/.apps/" + appName).thenApply(appOpt => {
                if (appOpt.ref != null) {
                    that.readAppProperties(appName).thenApply(props => {
                        if (props == null) {
                            that.installApp();
                        } else {
                            let oldVersion = props.version;
                            that.confirmReplaceAppInstall(displayName, oldVersion, newVersion,
                                () => {
                                    that.showConfirm = false;
                                    that.installApp({app:props});
                                },
                                () => {
                                    that.showConfirm = false;
                                    that.showSpinner = false;
                                }
                            );
                        }
                    });
                } else {
                    that.installApp();
                }
            });
        },
       installApp: function(oldProperties) {
           let that = this;
           let displayName = this.appProperties.displayName;
           let appName = this.appProperties.name;
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
                             that.backupPropertiesFile(appName, oldProperties).thenApply(done => {
                                 that.gatherAppFiles([{directory: srcDirectoryOpt.ref, path: srcPath}], 0, future, []);
                                 future.thenApply(appFiles => that.copyAppFiles(appFiles, appName, displayName));
                             });
                       });
                   }
               });
           });
       },
       backupPropertiesFile: function(appName, oldProperties) {
           var future = peergos.shared.util.Futures.incomplete();
           if (oldProperties == null) {
                future.complete(true);
           } else {
               let that = this;
               peergos.shared.user.App.init(that.context, appName).thenApply(app => {
                    let filePath = peergos.client.PathUtils.directoryToPath(['peergos-app-previous.json']);
                    let encoder = new TextEncoder();
                    let uint8Array = encoder.encode(JSON.stringify(oldProperties, null, 2));
                    let bytes = convertToByteArray(uint8Array);
                    app.writeInternal(filePath, bytes).thenApply(done => {
                        that.deletePropertiesFile(appName).thenApply(done => {
                            future.complete(true);
                        });
                    });
                });
            }
            return future;
       },
        gatherAppFiles: function(directoryEntries, index, future, accumulator) {
            if (index == directoryEntries.length) {
                let appFiles = peergos.client.JsUtil.asList(accumulator);
                future.complete(appFiles);
            } else {
                let that = this;
                let directoryEntry = directoryEntries[index];
                let fileProperties = directoryEntry.directory.getFileProperties();
                if (fileProperties.isHidden) {
                    this.gatherAppFiles(directoryEntries, index +1, future, accumulator);
                } else {
                    directoryEntry.directory.getChildren(this.context.crypto.hasher, this.context.network).thenApply(function(children) {
                        let arr = children.toArray();
                        let fileUploadList = [];
                        var lastEntryWasFolder = false;
                        arr.forEach( (file, fileIndex) => {
                            let fileProps = file.getFileProperties();
                            if (fileProps.isDirectory) {
                                directoryEntries.push({directory: file, path: directoryEntry.path + "/" + fileProps.name});
                                if (fileIndex == arr.length -1) {
                                    lastEntryWasFolder = true;
                                    that.gatherAppFiles(directoryEntries, index +1, future, accumulator);
                                }
                            } else {
                                file.getInputStream(that.context.network, that.context.crypto, fileProps.sizeHigh(), fileProps.sizeLow(), function(read){})
                                    .thenApply(function(reader) {
                                        if (! (index == 0 && fileProps.name == 'peergos-app.json')) {
                                            let fup = new peergos.shared.user.fs.FileWrapper.FileUploadProperties(fileProps.name, reader,
                                                (fileProps.size_0 - (fileProps.size_0 % Math.pow(2, 32))) / Math.pow(2, 32), fileProps.size_0, false,
                                                true, x => {});
                                            fileUploadList.push(fup);
                                        }
                                        if (lastEntryWasFolder || fileIndex == arr.length -1) {
                                            if (fileUploadList.length > 0) {
                                                let basePath = that.getPath;
                                                let relativePath = directoryEntry.path.substring(basePath.length);
                                                let pathList = peergos.client.JsUtil.asList(relativePath.split('/').filter(n => n.length > 0));
                                                let filePropsList = peergos.client.JsUtil.asList(fileUploadList);
                                                let folderUP = new peergos.shared.user.fs.FileWrapper.FolderUploadProperties(pathList, filePropsList);
                                                accumulator.push(folderUP);
                                            }
                                            if (!lastEntryWasFolder) {
                                                that.gatherAppFiles(directoryEntries, index +1, future, accumulator);
                                            }
                                        }
                                });
                            }
                        });
                    });
                }
            }
        },
        deletePropertiesFile(appName) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let folderPath = "/" + this.context.username + "/.apps/" + appName;
            let filename = 'peergos-app.json';
            this.context.getByPath(folderPath).thenApply(appDirOpt => {
                if (appDirOpt.ref != null) {
                    appDirOpt.ref.getChild(filename, that.context.crypto.hasher, that.context.network).thenApply(fileToDeleteOpt => {
                        if (fileToDeleteOpt.ref != null) {
                            that.removeFile(folderPath + '/' + filename, fileToDeleteOpt.ref, appDirOpt.ref).thenApply(res => {
                                future.complete(true);
                            });
                        } else {
                            future.complete(false);
                        }
                    });
                }else {
                    future.complete(false);
                }
            });
            return future;
        },
        deleteAssetsFolder(appName) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let folderPath = "/" + this.context.username + "/.apps/" + appName;
            this.context.getByPath(folderPath).thenApply(appDirOpt => {
                if (appDirOpt.ref != null) {
                    appDirOpt.ref.getChild('assets', that.context.crypto.hasher, that.context.network).thenApply(assetsFolderToDeleteOpt => {
                        if (assetsFolderToDeleteOpt.ref != null) {
                            that.removeFile(folderPath + '/assets', assetsFolderToDeleteOpt.ref, appDirOpt.ref).thenApply(res => {
                                future.complete(true);
                            });
                        } else {
                            future.complete(false);
                        }
                    });
                }else {
                    future.complete(false);
                }
            });
            return future;
        },
        removeFile: function(filename, file, parent) {
            let future = peergos.shared.util.Futures.incomplete();
            let that = this;
            let filePath = peergos.client.PathUtils.directoryToPath(filename.split('/').filter(n => n.length > 0));
            file.remove(parent, filePath, this.context).thenApply(function(b){
                future.complete(true);
            }).exceptionally(function(throwable) {
                console.log('Unexpected error: ' + throwable);
                future.complete(false);
            });
            return future;
        },
        copyAppFiles: function(appFiles, app, displayName) {
            let future = peergos.shared.util.Futures.incomplete();
            let that = this;
            this.deleteAssetsFolder(app).thenApply(res => {
                that.copyAllFiles(appFiles, app, displayName).thenApply(res => {
                    future.complete(true);
                });
            });
            return future;
        },
        copyAllFiles: function(appFiles, app, displayName) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();

            var commitWatcher = {
                get_0: function() {
                    return true;
                }
            };

            let folderStream = appFiles.stream();
            let resumeFileUpload = function(f) {
                let future = peergos.shared.util.Futures.incomplete();
                future.complete(true);
                return future;
            }
            let destinationPath = "/" + this.context.username + "/.apps/" + app;
            this.context.getByPath(destinationPath).thenApply(appDirOpt => {
                appDirOpt.ref.uploadSubtree(folderStream, that.getMirrorBatId(appDirOpt.ref), that.context.network,
                    that.context.crypto, that.context.getTransactionService(),
                    f => resumeFileUpload(f),commitWatcher).thenApply(res => {
                        that.updateSourceInAppManifest(app).thenApply(function(res){
                            that.registerApp(that.appProperties);
                            that.showMessage("Installed App: " + displayName);
                            that.showSpinner = false;
                            that.spinnerMessage = "";
                            that.close();
                        });
                }).exceptionally(function (throwable) {
                    that.showSpinner = false;
                    that.spinnerMessage = "";
                    console.log('Unable to install App. Error: ' +  + throwable.getMessage());
                    that.showError("Unable to install App. See console for details");
                });
            });
        },
        updateSourceInAppManifest: function(appName) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            this.context.getByPath(this.getPath + 'peergos-app.json').thenApply(propsFileOpt => {
                that.readJSONFile(propsFileOpt.ref).thenApply(props => {
                    props.source = props.source.length > 0 ? props.source : that.getPath;
                    let encoder = new TextEncoder();
                    let uint8Array = encoder.encode(JSON.stringify(props, null, 2));
                    let bytes = convertToByteArray(uint8Array);
                    let reader = new peergos.shared.user.fs.AsyncReader.ArrayBacked(bytes);
                    let filename = 'peergos-app.json';
                    that.context.getByPath("/" + that.context.username + "/.apps/" + appName).thenApply(appDirOpt => {
                          appDirOpt.get().uploadFileJS(filename, reader, 0, bytes.byteLength,
                              true, that.getMirrorBatId(appDirOpt.get()), that.context.network, that.context.crypto, function (len) { },
                              that.context.getTransactionService(), f => peergos.shared.util.Futures.of(true)
                          ).thenApply(function (res) {
                              future.complete(true);
                          }).exceptionally(function (throwable) {
                              console.log('unable to update manifest: ' + filename + ' error: ' + throwable.getMessage());
                              future.complete(false);
                          })
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
