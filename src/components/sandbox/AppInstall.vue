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
            <Spinner v-if="showSpinner" :message="spinnerMessage" :absolutePosition="spinnerAbsolutePosition"></Spinner>
            <Confirm
                    v-if="showConfirm"
                    v-on:hide-confirm="showConfirm = false"
                    :confirm_message='confirm_message'
                    :confirm_body="confirm_body"
                    :consumer_cancel_func="confirm_consumer_cancel_func"
                    :consumer_func="confirm_consumer_func">
            </Confirm>
            <AppTemplatePrompt
              v-if="showPrompt"
              @hide-prompt="closePrompt()"
              :message="prompt_message"
              :placeholder="prompt_placeholder"
              :max_input_size="prompt_max_input_size"
              :value="prompt_value"
              :consumer_func="prompt_consumer_func"
              :action="prompt_action"
              :appIconBase64Image="appIconBase64Image"
            />
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
                    <p>
                        <span v-if="appProperties.template.length > 0 && !appProperties.template.includes('instance')" class="app-install-span">Multiple instances of App can be installed</span>
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
const AppTemplatePrompt = require("../prompt/AppTemplatePrompt.vue");
const Confirm = require("../confirm/Confirm.vue");
const Spinner = require("../spinner/Spinner.vue");
const mixins = require("../../mixins/mixins.js");
const downloaderMixin = require("../../mixins/downloader/index.js");
const sandboxMixin = require("../../mixins/sandbox/index.js");
const i18n = require("../../i18n/index.js");

module.exports = {
    components: {
        AppTemplatePrompt,
        Confirm,
        Spinner
    },
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
            confirm_consumer_func: () => {},
            installAppFromFolder: "",
            isTemplateApp: false,
            prompt_message: '',
            prompt_placeholder: '',
            prompt_max_input_size: 16,
            prompt_value: '',
            prompt_consumer_func: () => { },
            prompt_action: 'ok',
            showPrompt: false,
            messenger: null,
            templateAppSeparator: "!",
            appIconBase64Image: "",
            spinnerAbsolutePosition: true,
            installedApps: [],
        }
    },
    props: ['appPropsFile','installFolder', "appInstallSuccessFunc", "templateInstanceAppName", "templateInstanceTitle", "templateAppIconBase64", "templateInstanceChatId"],
    mixins:[mixins, downloaderMixin, sandboxMixin, i18n],
    computed: {
        ...Vuex.mapState([
            'quotaBytes',
            'usageBytes',
            'context',
            'mirrorBatId',
            "sandboxedApps",
        ]),
    },
    created: function() {
        this.messenger = new peergos.shared.messaging.Messenger(this.context);
        this.installAppFromFolder = this.installFolder.endsWith('/')  ?
            this.installFolder.substring(0, this.installFolder.length -1) : this.installFolder;
        this.initAppInstall();
    },
    methods: {
        initAppInstall() {
            let that = this;
            if(!that.sandboxedApps.appsLoaded) {
                setTimeout( () => { that.initAppInstall();}, 1000);
            } else {
                that.installedApps = that.sandboxedApps.appsInstalled.slice();
                that.loadAppProperties();
            }
        },
        getMirrorBatId(file) {
            return file.getOwnerName() == this.context.username ? this.mirrorBatId : java.util.Optional.empty()
        },
        close: function () {
            this.$emit("hide-app-installation");
        },
        indicateAppInstallSuccess: function (appName) {
            this.appInstallSuccessFunc(appName);
        },
        loadAppProperties: function() {
            let that = this;
            this.showSpinner = true;
            that.verifyJSONFile(this.appPropsFile, this.installAppFromFolder).thenApply((res) => {
                that.showSpinner = false;
                if (res.errors.length > 0) {
                    that.showError("Unable to install App: " + res.errors.join(', '));
                    that.close();
                } else {
                    that.appHasFileAssociation = res.props.fileExtensions.length > 0
                        || res.props.mimeTypes.length > 0
                        || res.props.fileTypes.length > 0;
                    that.isTemplateApp = res.props.template.length > 0;
                    that.appProperties = res.props;
                }
            });
        },
        checkAvailableSpace: function(fileSize) {
            return Number(this.quotaBytes.toString()) - (Number(this.usageBytes.toString()) + fileSize);
        },
        confirmReplaceAppInstall(appName, oldVersion, newVersion, replaceFunction, cancelFunction) {
            this.confirm_message = 'App: ' + appName + ' ' + oldVersion + ' currently installed';
            this.confirm_body = "Are you sure you want to replace with version: " + newVersion + "?";
            this.confirm_consumer_cancel_func = cancelFunction;
            this.confirm_consumer_func = replaceFunction;
            this.showConfirm = true;
        },
        installNewApp: function() {
            if (this.appProperties == null) {
                return;
            }
            let displayName = this.appProperties.displayName;
            let newVersion = this.appProperties.version;
            let that = this;
            let appName = this.appProperties.name;
            this.showSpinner = true;
            let actualAppName = this.isTemplateApp
                && this.templateInstanceAppName != null
                && this.templateInstanceAppName.length > 0 ? this.templateInstanceAppName : appName;
            this.context.getByPath("/" + this.context.username + "/.apps/" + actualAppName).thenApply(appOpt => {
                if (appOpt.ref != null) {
                    that.readAppProperties(actualAppName).thenApply(props => {
                        if (props == null) {
                            that.installApp();
                        } else {
                            let oldVersion = props.version;
                            that.showSpinner = false;
                            that.confirmReplaceAppInstall(displayName, oldVersion, newVersion,
                                () => {
                                    that.showConfirm = false;
                                    that.showSpinner = true;
                                    if (this.isTemplateApp) {
                                        that.installTemplateApp(props);
                                    } else {
                                        that.installApp(props);
                                    }
                                },
                                () => {
                                    that.showConfirm = false;
                                    that.close();
                                }
                            );
                        }
                    });
                } else {
                    if (this.isTemplateApp) {
                        that.installTemplateApp();
                    } else {
                        that.installApp();
                    }
                }
            });
        },
        uuid() {
          return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
          ).substring(0, 12);
        },
        getTemplateAppTitle(oldProperties, callback) {
            if (oldProperties != null) {
                callback(oldProperties.displayName);
            } else if(this.templateInstanceTitle != null&& this.templateInstanceTitle.length > 0) {
                callback(this.templateInstanceTitle);
            } else if(this.appProperties.template.includes('instance')) {
                callback(this.appProperties.displayName, "");
            }else {
                let that = this;
                this.prompt_placeholder = this.translate("NEW.TEMPLATE.APP.NAME.LABEL");
                this.prompt_message = this.translate("NEW.TEMPLATE.APP.NAME.MESSAGE") + " " + this.appProperties.displayName;
                this.prompt_value = '';
                this.prompt_action = this.translate("PROMPT.OK");
                this.prompt_consumer_func = function (prompt_result, appIconBase64) {
                    if (prompt_result === null)
                        return;
                    let title = prompt_result.trim();
                    if (title === '')
                        return;
                    if (title === '.' || title === '..')
                        return;
                    if (title.includes("/"))
                        return;
                    if (!that.validateDisplayName(title)) {
                        return;
                    }
                    that.showSpinner = true;
                    callback(that.appProperties.displayName + " - " + title, appIconBase64);
                };
                this.context.getByPath(this.installAppFromFolder + '/assets/' + this.appProperties.appIcon).thenApply(iconFileOpt => {
                    if (iconFileOpt.ref != null) {
                        let file = iconFileOpt.ref;
                        let fileProps = file.getFileProperties();
                        var low = fileProps.sizeLow();
                        if (low < 0) low = low + Math.pow(2, 32);
                        let size = low + (fileProps.sizeHigh() * Math.pow(2, 32));
                        file.getInputStream(that.context.network, that.context.crypto, fileProps.sizeHigh(), fileProps.sizeLow(), (progress) => {}).thenApply(reader => {
                            let data = convertToByteArray(new Int8Array(size));
                            reader.readIntoArray(data, 0, data.length).thenApply(read => {
                                var str = "";
                                for (let i = 0; i < data.length; i++) {
                                    str = str + String.fromCharCode(data[i] & 0xff);
                                }
                                that.appIconBase64Image = "data:image/png;base64," + window.btoa(str);
                                that.showSpinner = false;
                                that.showPrompt = true;
                            });
                        });
                    }
                });
            }
        },
        closePrompt() {
            this.showPrompt = false;
        },
        createNewTemplateApp: function(appName, displayName, appIconBase64, chatId) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            if (chatId.length > 0) {
                future.complete(chatId);
            } else {
                this.messenger.createAppChat(appName).thenApply(function(controller){
                    let chatId = controller.chatUuid;
                    that.messenger.setGroupProperty(controller, "title", displayName).thenApply(function(updatedController) {
                        that.messenger.setGroupProperty(updatedController, "iconBase64", appIconBase64).thenApply(function(updatedController2) {
                            future.complete(chatId);
                        }).exceptionally(err => {
                            console.log('iconBase64 call failed: ' + err);
                            future.complete(null);
                        });
                    }).exceptionally(err => {
                        console.log('setTitle call failed: ' + err);
                        future.complete(null);
                    });
                }).exceptionally(err => {
                    console.log('Unable to create chat. error:' + err);
                    future.complete(null);
                });
            }
            return future;
        },
        extractChatOwner: function(chatUuid) {
            let withoutPrefix = chatUuid.substring(chatUuid.indexOf("$") +1);
            return withoutPrefix.substring(0,withoutPrefix.indexOf("$"));
        },
        installTemplateApp: function(oldProperties) {
            let that = this;
            if (oldProperties == null && this.appProperties.template.includes('instance') && this.templateInstanceChatId == null) {
                let existingInstanceApps = this.installedApps.filter(a => a.template.includes('instance'))
                    .filter(a => this.extractChatOwner(a.chatId) == this.context.username);
                if (existingInstanceApps.filter(a => a.displayName == this.appProperties.displayName).length > 0 ) {
                    this.showError("App already installed!");
                    this.showSpinner = false;
                    return;
                }
            }
            this.getTemplateAppTitle(oldProperties, (displayName, selectedAppIconBase64) => {
                var appName = "";
                if (oldProperties != null) {
                    appName = oldProperties.name;
                } else if(that.templateInstanceAppName != null&& that.templateInstanceAppName.length > 0) {
                    appName = that.templateInstanceAppName;
                }else {
                    appName = that.appProperties.name + that.templateAppSeparator + that.uuid();
                }
                that.context.getByPath(that.installAppFromFolder).thenApply(srcDirectoryOpt => {
                    that.calculateTotalSize(srcDirectoryOpt.ref, that.installAppFromFolder).thenApply(statistics => {
                        let spaceAfterOperation = that.checkAvailableSpace(statistics.apparentSize);
                        if (spaceAfterOperation < 0) {
                            that.showError("App installation size exceeds available Space.  Please free up " + that.convertBytesToHumanReadable('' + -spaceAfterOperation) + " and try again");
                            that.showSpinner = false;
                        } else {
                            that.spinnerMessage = "Installing App: " + displayName;
                            var existingChatId = "";
                            var appIconBase64 = selectedAppIconBase64;
                            if (oldProperties != null) {
                                existingChatId = oldProperties.chatId;
                                appIconBase64 = oldProperties.templateIconBase64;
                            } else if(that.templateInstanceChatId != null && that.templateInstanceChatId.length > 0) {
                                existingChatId = that.templateInstanceChatId;
                                appIconBase64 = that.templateAppIconBase64;
                            }
                            that.createNewTemplateApp(appName, displayName, appIconBase64, existingChatId).thenApply(chatId => {
                                if (chatId == null) {
                                    that.showError("App installation failed");
                                    that.showSpinner = false;
                                } else {
                                    peergos.shared.user.App.init(that.context, appName).thenApply(ready => {
                                        that.attemptAppInstall(0, srcDirectoryOpt.ref, appName, displayName, chatId, appIconBase64, oldProperties != null);
                                    });
                                }
                            });
                        }
                    });
                });
            });
        },
        installApp: function(oldProperties) {
           let that = this;
           let displayName = this.appProperties.displayName;
           let appName = this.appProperties.name;
           that.context.getByPath(that.installAppFromFolder).thenApply(srcDirectoryOpt => {
               that.calculateTotalSize(srcDirectoryOpt.ref, that.installAppFromFolder).thenApply(statistics => {
                   let spaceAfterOperation = that.checkAvailableSpace(statistics.apparentSize);
                   if (spaceAfterOperation < 0) {
                       that.showError("App installation size exceeds available Space.  Please free up " + that.convertBytesToHumanReadable('' + -spaceAfterOperation) + " and try again");
                       that.showSpinner = false;
                   } else {
                       that.spinnerMessage = "Installing App: " + displayName;
                       peergos.shared.user.App.init(that.context, appName).thenApply(ready => {
                             that.attemptAppInstall(0, srcDirectoryOpt.ref, appName, displayName);
                       });
                   }
               });
           });
        },
        attemptAppInstall: function(attemptCount, srcDirectory, appName, displayName, chatId, appIconBase64, isUpdateInstall) {
           let that = this;
           peergos.shared.user.App.init(this.context, appName).thenApply(ready => {
                 that.gatherDataFiles(appName, srcDirectory)
                    .thenApply(dataFiles =>
                        that.copyAppFiles(dataFiles, appName, displayName, chatId, appIconBase64, isUpdateInstall)
                            .thenApply(installed => {
                                if (!installed) {
                                    if (attemptCount < 3) {
                                        that.attemptAppInstall(attemptCount + 1, srcDirectory, appName, displayName, chatId, appIconBase64, isUpdateInstall);
                                    } else {
                                        that.showSpinner = false;
                                        that.spinnerMessage = "";
                                        that.showError("Unable to install App. Please try again");
                                    }
                                }
                            })


                    );
           });
        },
        gatherDataFiles: function(appName, appDirectory) {
            let future = peergos.shared.util.Futures.incomplete();
            let dataFolderName = 'data';
            let that = this;
            appDirectory.getChild(dataFolderName, this.context.crypto.hasher, this.context.network).thenApply(dataFolderOpt => {
                if (dataFolderOpt.ref != null) {
                    let dataFolderEntries = [{directory: dataFolderOpt.ref, path: that.installAppFromFolder + "/" + dataFolderName}];
                    that.gatherDataFilesRecursively(dataFolderEntries, 0, future, []);
                } else {
                    future.complete([]);
                }
            });
            return future;
        },
        gatherDataFilesRecursively: function(directoryEntries, index, future, accumulator) {
            if (index == directoryEntries.length) {
                let appFiles = peergos.client.JsUtil.asList(accumulator);
                future.complete(appFiles);
            } else {
                let that = this;
                let directoryEntry = directoryEntries[index];
                let fileProperties = directoryEntry.directory.getFileProperties();
                if (fileProperties.isHidden) {
                    this.gatherDataFilesRecursively(directoryEntries, index +1, future, accumulator);
                } else {
                    directoryEntry.directory.getChildren(this.context.crypto.hasher, this.context.network).thenApply(function(children) {
                        let arr = children.toArray();
                        let fileUploadList = [];
                        var lastEntryWasFolder = false;
                        let files = [];
                        arr.forEach(file => {
                            let fileProps = file.getFileProperties();
                            if (fileProps.isDirectory) {
                                directoryEntries.push({directory: file, path: directoryEntry.path + "/" + fileProps.name});
                            } else {
                                files.push(file);
                            }
                        });
                        if (files.length == 0) {
                            this.gatherDataFilesRecursively(directoryEntries, index +1, future, accumulator);
                        } else {
                            var filesProcessedCounter = 0;
                            files.forEach( (file) => {
                                let fileProps = file.getFileProperties();
                                file.getInputStream(that.context.network, that.context.crypto, fileProps.sizeHigh(), fileProps.sizeLow(), function(read){})
                                    .thenApply(function(reader) {
                                        filesProcessedCounter++;
                                        let fup = new peergos.shared.user.fs.FileWrapper.FileUploadProperties(fileProps.name, {get_0: () => reader},
                                            (fileProps.size_0 - (fileProps.size_0 % Math.pow(2, 32))) / Math.pow(2, 32), fileProps.size_0, java.util.Optional.empty(), java.util.Optional.empty(), false,
                                            true, x => {});
                                        fileUploadList.push(fup);
                                        if (filesProcessedCounter == files.length) {
                                            let basePath = that.installAppFromFolder;
                                            let relativePath = directoryEntry.path.substring(basePath.length);
                                            let pathList = peergos.client.JsUtil.asList(relativePath.split('/').filter(n => n.length > 0));
                                            let filePropsList = peergos.client.JsUtil.asList(fileUploadList);
                                            let folderUP = new peergos.shared.user.fs.FileWrapper.FolderUploadProperties(pathList, filePropsList);
                                            accumulator.push(folderUP);
                                            that.gatherDataFilesRecursively(directoryEntries, index +1, future, accumulator);
                                        }
                                });
                            });
                        }
                    });
                }
            }
        },
        copyAssetsFolder(appName) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let appFolderPath = "/" + this.context.username + "/.apps/" + appName;
            this.context.getByPath(this.installAppFromFolder + '/assets').thenApply(srcAssetsDirOpt => {
                if (srcAssetsDirOpt.ref != null) {
                    that.context.getByPath(appFolderPath).thenApply(destAppDirOpt => {
                        srcAssetsDirOpt.ref.copyTo(destAppDirOpt.ref, that.context)
                            .thenApply(function () {
                                future.complete(true);
                            }).exceptionally(function (throwable) {
                                console.log('unable to copy app assets. error: ' + throwable.getMessage());
                                future.complete(false);
                            });
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
                            future.complete(true);
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
        copyAppFiles: function(appDataFiles, app, displayName, chatId, appIconBase64, isUpdateInstall) {
            let future = peergos.shared.util.Futures.incomplete();
            let that = this;
            this.deleteAssetsFolder(app).thenApply(res => {
                that.copyAssetsFolder(app).thenApply(res2 => {
                    that.copyAllDataFiles(appDataFiles, app, displayName).thenApply(res3 => {
                        if (res && res2 && res3) {
                            that.updateAppManifest(app, displayName, chatId, appIconBase64).thenApply(function(props){
                                that.appProperties = props;
                                that.showSpinner = false;
                                that.spinnerMessage = "";
                                that.registerApp(that.appProperties);
                                that.showMessage("Installed App: " + displayName);
                                that.indicateAppInstallSuccess(app);
                                that.close();
                                future.complete(true);
                            });
                        } else {
                            future.complete(false);
                        }
                    });
                });
            });
            return future;
        },
        copyAllDataFiles: function(appDataFiles, app, displayName) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            if (appDataFiles.length == 0) {
                future.complete(true);
            } else {
                var commitWatcher = {
                    get_0: function() {
                        return true;
                    }
                };
                let folderStream = appDataFiles.stream();
                let resumeFileUpload = function(f) {
                    let resumeFuture = peergos.shared.util.Futures.incomplete();
                    resumeFuture.complete(true);
                    return resumeFuture;
                }
                let destinationPath = "/" + this.context.username + "/.apps/" + app;
                this.context.getByPath(destinationPath).thenApply(appDirOpt => {
                    appDirOpt.ref.uploadSubtree(folderStream, that.getMirrorBatId(appDirOpt.ref), that.context.network,
                        that.context.crypto, that.context.getTransactionService(),
                        f => resumeFileUpload(f),commitWatcher).thenApply(res => {
                            future.complete(true);
                        }).exceptionally(function (throwable) {
                            console.log('Unable to install App. Error: ' +  + throwable.getMessage());
                            future.complete(false);
                        });
                });
            }
            return future;
        },
        updateAppManifest: function(appName, appDisplayName, chatId, appIconBase64) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            this.context.getByPath(this.installAppFromFolder + '/peergos-app.json').thenApply(propsFileOpt => {
                that.readJSONFile(propsFileOpt.ref).thenApply(props => {
                    props.source = props.source.length > 0 ? props.source : that.installAppFromFolder;
                    if (that.isTemplateApp) {
                        props.name = appName;
                        if (appDisplayName.length > 0) {
                            props.displayName = appDisplayName;
                        }
                        if (chatId != null && chatId.length > 0) {
                            props.chatId = chatId;
                        }
                        if (appIconBase64 != null && appIconBase64.length > 0) {
                            props.templateIconBase64 = appIconBase64;
                        }
                    }
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
                              future.complete(props);
                          }).exceptionally(function (throwable) {
                              console.log('unable to update manifest: ' + filename + ' error: ' + throwable.getMessage());
                              future.complete(props);
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
