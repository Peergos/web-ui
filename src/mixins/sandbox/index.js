const ProgressBar = require("../../components/drive/ProgressBar.vue");
module.exports = {
    data() {
        return {
            currentAppSchema: "1"
        };
    },
    computed: {
        ...Vuex.mapState([
        "context",
        "sandboxedApps"
        ])
    },
  methods: {
      convertPermissionToHumanReadable: function(permission) {
          if (permission === 'STORE_APP_DATA') {
              return "Can store and read files in a directory private to the app";
          } else if (permission === 'EDIT_CHOSEN_FILE') {
              return "Can modify file chosen by user";
          } else if (permission === 'READ_CHOSEN_FOLDER') {
              return "Can read contents of folder chosen by user";
          } else {
              console.log('Unknown permission: ' + permission);
              this.$toast.error('Unknown permission: ' + permission, {timeout:false});
          }
      },
      verifyJSONFile: function(file) {
          let that = this;
          let appNames = this.sandboxedApps.appsInstalled.slice();
          let future = peergos.shared.util.Futures.incomplete();
          this.readJSONFile(file).thenApply(res => {
              if (res == null) {
                  future.complete({props: null, errors: ['Unable to parse peergos-app.json. See console for details']});
              } else {
                  let props = res.app;
                  let errors = [];
                  if (props.schemaVersion == null) {
                      errors.push("Missing property schemaVersion");
                  }
                  let fields = ["displayName","name","majorVersion","minorVersion"
                      ,"description","supportAddress","fileExtensions","mimeTypes"
                      , "launchable", "fileTypes", "folderAction"];
                  let existingCreateMenuItems = ["upload files","upload folder","new folder","new file"];
                  let validPermissions = ["STORE_APP_DATA", "EDIT_CHOSEN_FILE", "READ_CHOSEN_FOLDER"];
                  fields.forEach(field => {
                      if (props.details[field] == null) {
                          errors.push("Missing property " + field);
                      }
                  });
                  if (errors.length == 0) {
                      if (props.schemaVersion != this.currentAppSchema) {
                          errors.push("Invalid schemaVersion property. Must be: " + this.currentAppSchema);
                      }
                        if (!(props.permissions.constructor === Array)) {
                            errors.push("Invalid App Permissions. Must be an array. Can be empty []");
                        } else {
                            props.permissions.forEach(permission => {
                                let permissionIndex = validPermissions.findIndex(v => v === permission);
                                if (permissionIndex == -1) {
                                    errors.push("Invalid permission: " + permission);
                                }
                            });
                        }
                      if (props.details.displayName.length > 15) {
                          errors.push("Invalid displayName property. Length must not exceed 15 characters");
                      }
                      if (props.details.name.length > 15) {
                          errors.push("Invalid name property. Length must not exceed 15 characters");
                      }
                      if (!props.details.name.match(/^[a-z\d\-_]+$/i)) {
                          errors.push("Invalid name property. Use only alphanumeric characters plus dash and underscore");
                      }
                      const majorVersion = Number(props.details.majorVersion);
                      if (!(majorVersion >= 0 && majorVersion < 1000)) {
                          errors.push("Invalid majorVersion property. Must be numeric between 1 and 999");
                      }
                      const minorVersion = Number(props.details.minorVersion);
                      if (!(minorVersion >= 0 && minorVersion < 1000)) {
                          errors.push("Invalid minorVersion property. Must be numeric between 1 and 999");
                      }
                      if (props.details.description.length > 100) {
                          errors.push("Invalid description property. Length must not exceed 100 characters");
                      }
                      if (!(typeof props.details.launchable == "boolean")) {
                          errors.push("Invalid launchable property. Must have boolean value of true or false");
                      }
                      if (!(typeof props.details.folderAction == "boolean")) {
                          errors.push("Invalid folderAction property. Must have boolean value of true or false");
                      }
                      if (props.details.supportAddress.length > 100) {
                          errors.push("Invalid supportAddress property. Length must not exceed 100 characters");
                      }
                        if (props.details.createMenuText != null) {
                          if (props.details.createMenuText.length > 25) {
                              errors.push("Invalid createMenuText property. Length must not exceed 25 characters");
                          }
                          let lowercaseText = props.details.createMenuText.toLowerCase().trim();
                          let itemIndex = existingCreateMenuItems.findIndex(v => v.name === lowercaseText);
                          if (itemIndex > -1) {
                              errors.push("Invalid createMenuText property. Menu text already exists!");
                          }
                        }
                      if (!(props.details.fileExtensions.constructor === Array)) {
                          errors.push("Invalid fileExtensions property. Must be an array. Can be empty []");
                      }
                      if (!(props.details.mimeTypes.constructor === Array)) {
                          errors.push("Invalid mimeTypes property. Must be an array. Can be empty []");
                      }
                      if (!(props.details.fileTypes.constructor === Array)) {
                          errors.push("Invalid fileTypes property. Must be an array. Can be empty []");
                      }
                  }
                  future.complete({props:props, errors: errors});
              }
          });
          return future;
      },
      readJSONFile: function(file) {
          let future = peergos.shared.util.Futures.incomplete();
          if (file == null) {
                future.complete(null);
          } else {
              let props = file.getFileProperties();
              var low = props.sizeLow();
              if (low < 0) low = low + Math.pow(2, 32);
              let size = low + (props.sizeHigh() * Math.pow(2, 32));
              file.getInputStream(this.context.network, this.context.crypto, props.sizeHigh(), props.sizeLow(), (progress) => {}).thenApply(reader => {
                  let data = convertToByteArray(new Int8Array(size));
                  return reader.readIntoArray(data, 0, data.length).thenApply(read => {
                      try {
                          future.complete(JSON.parse(new TextDecoder().decode(data)));
                      } catch (ex) {
                          console.log(ex);
                          future.complete(null);
                      }
                  });
              });
          }
          return future;
      },
        readAppProperties: function(appName) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let emptyObj = {};
            this.context.getByPath(this.context.username + "/.apps/" + appName).thenApply(appDirOpt => {
                if (appDirOpt.ref != null) {
                    appDirOpt.get().getChild("peergos-app.json", that.context.crypto.hasher, that.context.network).thenApply(function(propFileOpt) {
                        if (propFileOpt.ref == null) {
                            console.log('peergos-app.json not found! App: ' + appName);
                            future.complete(emptyObj);
                        } else {
                            let props = propFileOpt.ref.getFileProperties();
                            if (!props.created.equals(props.modified)) {
                                console.log('peergos-app.json file has changed! App: ' + appName);
                                future.complete(emptyObj);
                            } else {
                                that.readJSONFile(propFileOpt.ref).thenApply(res => {
                                    if (res == null) {
                                        console.log('Properties not found! App: ' + appName);
                                        future.complete(emptyObj);
                                    } else {
                                        future.complete(res.app);
                                    }
                                });
                            }
                        }
                    });
                } else {
                    console.log('App directory not found! App: ' + appName);
                    future.complete(emptyObj);
                }
            });
            return future;
        },
      readAllAppProperties: function(appDirectories) {
          let that = this;
          let accumulator = [];
          let future = peergos.shared.util.Futures.incomplete();
          if (appDirectories.length == 0) {
              future.complete(accumulator);
          }
          let appCount = appDirectories.length;
          appDirectories.forEach(currentApp => {
              currentApp.getChild("peergos-app.json", this.context.crypto.hasher, this.context.network).thenApply(function(propFileOpt) {
                  that.readJSONFile(propFileOpt.ref).thenApply(res => {
                      if (res == null) {
                        appCount = appCount -1;
                      } else {
                        accumulator.push(res.app);
                      }
                      if (accumulator.length == appCount) {
                          future.complete(accumulator);
                      }
                  });
              });
          });
          return future;
      },
      loadAllAppProperties: function(appDirectoryNames) {
          var appDirectories = appDirectoryNames.filter(n => n.getName() != "calendar" &&
                                    n.getName() != "launcher");
          let future = peergos.shared.util.Futures.incomplete();
          this.readAllAppProperties(appDirectories).thenApply(props => {
              future.complete(props);
          });
          return future;
      },
        registerApps: function(sandboxedAppsPropsList) {
            let that = this;
            sandboxedAppsPropsList.forEach(props => {
                that.registerApp(props);
            });
        },
        deRegisterApp: function(app) {
            let appFileExtensionRegistrationMap = new Map();
            let appMimeTypeRegistrationMap = new Map();
            let appFileTypeRegistrationMap = new Map();
            let appsInstalled = this.sandboxedApps.appsInstalled.slice();
            let appIndex = appsInstalled.findIndex(v => v.name === app.name);
            if (appIndex > -1) {
                appsInstalled.splice(appIndex, 1);
                this.$store.commit("SET_SANDBOXED_APPS", appsInstalled);
            }
            this.sandboxedApps.appFileExtensionRegistrationMap.forEach(function(value, key) {
                let updatedList = [];
                value.forEach(entry => {
                    if (entry.name != app.name) {
                        updatedList.push({name: entry.name, displayName: entry.displayName});
                    }
                });
                if (updatedList.length > 0) {
                    appFileExtensionRegistrationMap.set(key, updatedList);
                }
            });
            this.sandboxedApps.appMimeTypeRegistrationMap.forEach(function(value, key) {
                let updatedList = [];
                value.forEach(entry => {
                    if (entry.name != app.name) {
                        updatedList.push({name: entry.name, displayName: entry.displayName});
                    }
                });
                if (updatedList.length > 0) {
                    appMimeTypeRegistrationMap.set(key, updatedList);
                }
            });
            this.sandboxedApps.appFileTypeRegistrationMap.forEach(function(value, key) {
                let updatedList = [];
                value.forEach(entry => {
                    if (entry.name != app.name) {
                        updatedList.push({name: entry.name, displayName: entry.displayName});
                    }
                });
                if (updatedList.length > 0) {
                    appFileTypeRegistrationMap.set(key, updatedList);
                }
            });
            this.$store.commit("SET_FILE_EXTENSION_REGISTRATIONS", appFileExtensionRegistrationMap);
            this.$store.commit("SET_MIMETYPE_REGISTRATIONS", appMimeTypeRegistrationMap);
            this.$store.commit("SET_FILETYPE_REGISTRATIONS", appFileTypeRegistrationMap);
        },
        registerApp: function(props) {
            var appsInstalled = this.sandboxedApps.appsInstalled.slice();
            let appIndex = appsInstalled.findIndex(v => v.name === props.details.name);
            if (appIndex > -1) {
                this.deRegisterApp(props.details);
            }
            appsInstalled = this.sandboxedApps.appsInstalled.slice();
            let appFileExtensionRegistrationMap = new Map(this.sandboxedApps.appFileExtensionRegistrationMap);
            let appMimeTypeRegistrationMap = new Map(this.sandboxedApps.appMimeTypeRegistrationMap);
            let appFileTypeRegistrationMap = new Map(this.sandboxedApps.appFileTypeRegistrationMap);
            appsInstalled.push({name: props.details.name, displayName: props.details.displayName,
                createMenuText: props.details.createMenuText, launchable: props.details.launchable,
                folderAction: props.details.folderAction});
            props.details.fileExtensions.forEach(extension => {
                let currentMapping = appFileExtensionRegistrationMap.get(extension);
                if (currentMapping == null) {
                    currentMapping = [{name: props.details.name, displayName: props.details.displayName}];
                } else {
                    currentMapping.push({name: props.details.name, displayName: props.details.displayName});
                }
                appFileExtensionRegistrationMap.set(extension, currentMapping);
            });
            props.details.mimeTypes.forEach(mimeType => {
                let currentMapping = appMimeTypeRegistrationMap.get(mimeType);
                if (currentMapping == null) {
                    currentMapping = [{name: props.details.name, displayName: props.details.displayName}];
                } else {
                    currentMapping.push({name: props.details.name, displayName: props.details.displayName});
                }
                appMimeTypeRegistrationMap.set(mimeType, currentMapping);
            });
            props.details.fileTypes.forEach(fileType => {
                let currentMapping = appFileTypeRegistrationMap.get(fileType);
                if (currentMapping == null) {
                    currentMapping = [{name: props.details.name, displayName: props.details.displayName}];
                } else {
                    currentMapping.push({name: props.details.name, displayName: props.details.displayName});
                }
                appFileTypeRegistrationMap.set(fileType, currentMapping);
            });
            this.$store.commit("SET_FILE_EXTENSION_REGISTRATIONS", appFileExtensionRegistrationMap);
            this.$store.commit("SET_MIMETYPE_REGISTRATIONS", appMimeTypeRegistrationMap);
            this.$store.commit("SET_FILETYPE_REGISTRATIONS", appFileTypeRegistrationMap);
            this.$store.commit("SET_SANDBOXED_APPS", appsInstalled);
        },
  }
}
