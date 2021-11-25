module.exports = {
    template: require('installation.html'),
    data() {
	    return {
	        showSpinner: false,
            spinnerMessage: '',
            appProperties: null,
            errorTitle:'',
            errorBody:'',
            showError:false,
	    }
    },
    props: ["messages", "context", "appPath", "appDirectory", "appPropFile", "checkAvailableSpace", "appsInstalled"],
    created: function() {
        this.loadAppProperties();
    },
    methods: {
        loadAppProperties: function() {
            let that = this;
            this.showSpinner = true;
            that.verifyJSONFile(this.appPropFile, this.appsInstalled).thenApply((res) => {
                that.showSpinner = false;
                if (res.errors.length > 0) {
                    that.showMessage("Unable to install App", res.errors.join(', '));
                    that.close();
                } else {
                    that.appProperties = res.props;
                }
            });
        },
        installNewApp: function() {
            let displayName = this.appProperties.details.displayName;
            let app = this.appProperties.details.name;
            let that = this;
            this.showSpinner = true;
            this.context.getByPath("/" + this.context.username + "/.apps/" + app).thenApply(appOpt => {
                if (appOpt.ref != null) {
                    that.showMessage("App already installed");
                    that.showSpinner = false;
                } else {
                    that.calculateTotalFileSize(that.appDirectory, that.appPath).thenApply(totalSize => {
                        let spaceAfterOperation = that.checkAvailableSpace(totalSize);
                        if (spaceAfterOperation < 0) {
                            that.errorTitle = "App installation size exceeds available Space";
                            that.errorBody = "Please free up " + this.convertBytesToHumanReadable('' + -spaceAfterOperation) + " and try again";
                            that.showError = true;
                            that.showSpinner = false;
                        } else {
                            that.spinnerMessage = "Installing App: " + displayName;
                            peergos.shared.user.App.init(that.context, app).thenApply(ready => {
                                let future = peergos.shared.util.Futures.incomplete();
                                that.gatherAppFiles([{directory: that.appDirectory, path: that.appPath}], 0, app, future, []);
                                future.thenApply(appFiles => that.copyAllFiles(appFiles, app, displayName));
                            });
                        }
                    });
                }
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
        reduceCopyingAllAppFiles: function(appSourceDirName, appFiles, index, future, app) {
            let that = this;
            if (index == appFiles.length) {
                future.complete(true);
            } else {
                let entry = appFiles[index];
                that.copyFile(appSourceDirName, entry.path, entry.file, app).thenApply(function(res){
                    that.reduceCopyingAllAppFiles(appSourceDirName, appFiles, index + 1, future, app);
                }).exceptionally(function(throwable) {
                    that.showMessage("Unable to install App. Error:" + throwable.getMessage());
                });
            }
        },
        copyAllFiles: function(appFiles, app, displayName) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let appSourceDirName = appFiles[0].path.substring(appFiles[0].path.lastIndexOf("/"));
            this.reduceCopyingAllAppFiles(appSourceDirName, appFiles, 0, future, app);
            future.thenApply(res => {
        	    that.appsInstalled.push({name: app, displayName: displayName});
                that.showMessage("Installed App: " + displayName);
                that.showSpinner = false;
                that.spinnerMessage = "";
                that.close();
            });
        },
        copyFile: function(appSourceDirName, sourcePath, sourceFile, appName) {
            let future = peergos.shared.util.Futures.incomplete();
            let that = this;
            let path = ".apps" + sourcePath.substring(sourcePath.indexOf(appSourceDirName)).replace(appSourceDirName, "/" + appName);
            let appDir = peergos.client.PathUtils.directoryToPath(path.split('/'));
            this.context.getByPath("/" + this.context.username).thenApply(rootOpt => {
                rootOpt.get().getOrMkdirs(appDir, that.context.network, false, that.context.crypto).thenApply(dir => {
                    sourceFile.copyTo(dir, that.context).thenApply(function() {
                        future.complete(true);
                    });
                });
            });
            return future;
        },
        showMessage: function(title, message) {
            this.messages.push({
                title: title,
                body: message,
                show: true
            });
        },
        close: function () {
            this.$emit("hide-app-installation");
        }
    }
};
