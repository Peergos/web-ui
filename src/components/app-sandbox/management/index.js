module.exports = {
    template: require('management.html'),
    data() {
	    return {
	        showSpinner: false,
            spinnerMessage: '',
            appProperties: null,
            errorTitle:'',
            errorBody:'',
            showError:false,
            showConfirm: false,
            confirm_message: "",
            confirm_body: "",
            confirm_consumer_cancel_func: () => {},
            confirm_consumer_func: () => {},
            installedApps: []
	    }
    },
    props: ["messages", "context", "appsInstalled"],
    created: function() {
        let that = this;
        this.showSpinner = true;
        this.context.getByPath("/" + this.context.username + "/.apps").thenApply(appDirOpt => {
            if (appDirOpt.ref != null) {
                appDirOpt.ref.getChildren(that.context.crypto.hasher, that.context.network).thenApply(children => {
                    var appDirs = children.toArray();
                    that.showSpinner = false;
                    appDirs.forEach(appDir => {
                        appDir.getChild("peergos-app.json", that.context.crypto.hasher, that.context.network).thenApply(appConfigOpt => {
                            if (appConfigOpt.ref != null) {
                                that.readJSONFile(appConfigOpt.ref).thenApply(res => {
                                    that.installedApps.push(res.app);
                                });
                            }
                        });
                    });
                });
            }
        });
    },
    methods: {
        uninstallApp: function(appIndex) {
            let that = this;
            this.confirmUninstallApp(this.installedApps[appIndex].details.name,
                () => { that.showConfirm = false;
                    that.uninstallAppDirectory(this.installedApps[appIndex]);
                },
                () => { that.showConfirm = false;}
            );
        },
        confirmUninstallApp: function(title, deleteAppFunction, cancelFunction) {
            this.confirm_message='Are you sure you want to delete the App: ' + title + ' ?';
            this.confirm_body='';
            this.confirm_consumer_cancel_func = cancelFunction;
            this.confirm_consumer_func = deleteAppFunction;
            this.showConfirm = true;
        },
        uninstallAppDirectory: function(app) {
            let that = this;
            let appDirName = app.details.name;
            this.showSpinner = true;
            this.context.getByPath("/" + this.context.username + "/.apps").thenApply(appDirOpt => {
                if (appDirOpt.ref != null) {
                    appDirOpt.ref.getChild(appDirName, that.context.crypto.hasher, that.context.network).thenApply(appToDeleteOpt => {
                        if (appToDeleteOpt.ref != null) {
                            that.deleteAppFolder(app, appToDeleteOpt.ref, appDirOpt.ref);
                        }
                    });
                }
            });
        },
        deleteAppFolder: function(app, file, parent) {
            let name = file.getFileProperties().name;
            let that = this;
            let filePath = peergos.client.PathUtils.directoryToPath([this.context.username, ".apps", name]);
            file.remove(parent, filePath, this.context).thenApply(function(b){
                var index = that.installedApps.findIndex(v => v.details.name === app.details.name);
                if (index > -1) {
                    that.installedApps.splice(index, 1);
                }
                index = that.appsInstalled.findIndex(v => v.name === app.details.name);
                if (index > -1) {
                    that.appsInstalled.splice(index, 1);
                }
                that.showSpinner = false;
            }).exceptionally(function(throwable) {
                that.errorTitle = 'Error deleting App: ' + name;
                that.errorBody = throwable.getMessage();
                that.showError = true;
                that.showSpinner = false;
            });
        },
        showMessage: function(title, message) {
            this.messages.push({
                title: title,
                body: message,
                show: true
            });
        },
        close: function () {
            this.$emit("hide-app-management");
        }
    }
};
