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
        "sandboxedApps",
        'mirrorBatId',
        ])
    },
  methods: {
      initSandboxedApps() {
          let that = this;
          this.context.getByPath(this.context.username + "/.apps").thenApply(appsDirOpt => {
              if (appsDirOpt.ref != null) {
                  appsDirOpt.get().getChildren(that.context.crypto.hasher, that.context.network).thenApply(children => {
                      that.loadAllAppProperties(children.toArray()).thenApply(sandboxedAppsPropsList => {
                          that.registerApps(sandboxedAppsPropsList);
                      });
                  });
              }
          });
      },
      convertPermissionToHumanReadable: function(permission) {
          if (permission === 'STORE_APP_DATA') {
              return "Can store and read files in a folder private to the app";
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
          this.readJSONFile(file).thenApply(props => {
              if (props == null) {
                  future.complete({props: null, errors: ['Unable to parse peergos-app.json. See console for details']});
              } else {
                  let errors = [];
                  let mandatoryFields = ["displayName", "description", "launchable"];
                  let existingCreateMenuItems = ["upload files","upload folder","new folder","new file"];
                  let validPermissions = ["STORE_APP_DATA", "EDIT_CHOSEN_FILE", "READ_CHOSEN_FOLDER"];
                  mandatoryFields.forEach(field => {
                      if (props[field] == null) {
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
                      if (props.displayName.length > 25) {
                          errors.push("Invalid displayName property. Length must not exceed 25 characters");
                      }
                      if (!that.validateDisplayName(props.displayName)) {
                          errors.push("Invalid displayName property. Use only alphanumeric characters plus dash and underscore");
                      }
                      const versionStr = props.version;
                      try {
                        peergos.shared.util.Version.parse(versionStr);
                      } catch {
                          errors.push("Invalid version property. Must be of format: major.minor.patch-suffix");
                      }
                      if (props.description.length > 100) {
                          errors.push("Invalid description property. Length must not exceed 100 characters");
                      }
                      if (!(typeof props.launchable == "boolean")) {
                          errors.push("Invalid launchable property. Must have boolean value of true or false");
                      }
                      if (!(typeof props.folderAction == "boolean")) {
                          errors.push("Invalid folderAction property. Must have boolean value of true or false");
                      }
                      if (props.supportAddress.length > 100) {
                          errors.push("Invalid supportAddress property. Length must not exceed 100 characters");
                      }
                        if (props.createMenuText != null) {
                          if (props.createMenuText.length > 25) {
                              errors.push("Invalid createMenuText property. Length must not exceed 25 characters");
                          }
                          let lowercaseText = props.createMenuText.toLowerCase().trim();
                          let itemIndex = existingCreateMenuItems.findIndex(v => v.name === lowercaseText);
                          if (itemIndex > -1) {
                              errors.push("Invalid createMenuText property. Menu text already exists!");
                          }
                        }
                      if (!(props.fileExtensions.constructor === Array)) {
                          errors.push("Invalid fileExtensions property. Must be an array. Can be empty []");
                      }
                      if (!(props.mimeTypes.constructor === Array)) {
                          errors.push("Invalid mimeTypes property. Must be an array. Can be empty []");
                      }
                      if (!(props.fileTypes.constructor === Array)) {
                          errors.push("Invalid fileTypes property. Must be an array. Can be empty []");
                      }
                  }
                  future.complete({props:props, errors: errors});
              }
          });
          return future;
      },
      validateDisplayName: function(displayName) {
          if (displayName === '')
              return false;
          if (displayName.includes('.') || displayName.includes('..'))
              return false;
          if (!displayName.match(/^[a-z\d\-_\s]+$/i)) {
              return false;
          }
          return true;
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
                          let props = JSON.parse(new TextDecoder().decode(data));
                          if (props.schemaVersion == null) {
                              props.schemaVersion = this.currentAppSchema;
                          }
                          if (props.version == null) {
                              props.version = "0.0.1";
                          }
                          if (props.supportAddress == null) {
                              props.supportAddress = "";
                          }
                          if (props.folderAction == null) {
                              props.folderAction = false;
                          }
                          if (props.fileExtensions == null) {
                              props.fileExtensions = [];
                          }
                          if (props.mimeTypes == null) {
                              props.mimeTypes = [];
                          }
                          if (props.fileTypes == null) {
                              props.fileTypes = [];
                          }
                          if (props.permissions == null) {
                              props.permissions = [];
                          }
                          props.name = props.displayName.replaceAll(' ', '').toLowerCase().trim();
                          future.complete(props);
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
            this.context.getByPath(this.context.username + "/.apps/" + appName).thenApply(appDirOpt => {
                if (appDirOpt.ref != null) {
                    appDirOpt.get().getChild("peergos-app.json", that.context.crypto.hasher, that.context.network).thenApply(function(propFileOpt) {
                        if (propFileOpt.ref == null) {
                            console.log('peergos-app.json not found! App: ' + appName);
                            future.complete(null);
                        } else {
                            let props = propFileOpt.ref.getFileProperties();
                            if (!props.created.equals(props.modified)) {
                                console.log('peergos-app.json file has changed! App: ' + appName);
                                future.complete(null);
                            } else {
                                that.readJSONFile(propFileOpt.ref).thenApply(res => {
                                    if (res == null) {
                                        console.log('Properties not found! App: ' + appName);
                                        future.complete(null);
                                    } else {
                                        future.complete(res);
                                    }
                                });
                            }
                        }
                    });
                } else {
                    console.log('App directory not found! App: ' + appName);
                    future.complete(null);
                }
            });
            return future;
        },
      readAllAppProperties: function(appDirectories) {
          let that = this;
          let accumulator = [];
          let future = peergos.shared.util.Futures.incomplete();
          let appCount = appDirectories.length;
          if (appCount == 0) {
            that.installDefaultApp().thenApply( res => {
                accumulator.push(res);
                future.complete(accumulator);
            });
          } else {
              appDirectories.forEach(currentApp => {
                  currentApp.getChild("peergos-app.json", this.context.crypto.hasher, this.context.network).thenApply(function(propFileOpt) {
                      that.readJSONFile(propFileOpt.ref).thenApply(res => {
                          if (res == null) {
                            appCount = appCount -1;
                          } else {
                            accumulator.push(res);
                          }
                          if (accumulator.length == appCount) {
                              future.complete(accumulator);
                          }
                      });
                  });
              });
          }
          return future;
      },
      installDefaultApp: function() {
          let future = peergos.shared.util.Futures.incomplete();
          let that = this;
          let path = ".apps/htmlbrowser";
          let appDir = peergos.client.PathUtils.directoryToPath(path.split('/'));
          this.context.getByPath("/" + this.context.username).thenApply(rootOpt => {
              rootOpt.get().getOrMkdirs(appDir, that.context.network, true, that.mirrorBatId, that.context.crypto).thenApply(dir => {
                let encoder = new TextEncoder();
                let props = {"schemaVersion": "1", "displayName": "HTML Browser", "name": "htmlbrowser",
                    "version": "1.0.0-initial", "supportAddress": "", "folderAction": false,
                    "description": "for viewing HTML files",
                    "launchable": false,
                    "fileExtensions": ["html","htm"], "mimeTypes": [], "fileTypes": [], "permissions": []
                };
                let uint8Array = encoder.encode(JSON.stringify(props));
                let bytes = convertToByteArray(uint8Array);
                let reader = new peergos.shared.user.fs.AsyncReader.ArrayBacked(bytes);
                dir.uploadFileJS("peergos-app.json", reader, 0, bytes.byteLength,
                    true, true, that.mirrorBatId, that.context.network, that.context.crypto, function (len) { },
                    that.context.getTransactionService()
                ).thenApply(function (res) {
                    future.complete(props);
                })
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
            let appIndex = appsInstalled.findIndex(v => v.name === props.name);
            if (appIndex > -1) {
                this.deRegisterApp(props);
            }
            appsInstalled = this.sandboxedApps.appsInstalled.slice();
            let appFileExtensionRegistrationMap = new Map(this.sandboxedApps.appFileExtensionRegistrationMap);
            let appMimeTypeRegistrationMap = new Map(this.sandboxedApps.appMimeTypeRegistrationMap);
            let appFileTypeRegistrationMap = new Map(this.sandboxedApps.appFileTypeRegistrationMap);
            appsInstalled.push({name: props.name, displayName: props.displayName,
                createMenuText: props.createMenuText, launchable: props.launchable,
                folderAction: props.folderAction});
            props.fileExtensions.forEach(extension => {
                let currentMapping = appFileExtensionRegistrationMap.get(extension);
                if (currentMapping == null) {
                    currentMapping = [{name: props.name, displayName: props.displayName}];
                } else {
                    currentMapping.push({name: props.name, displayName: props.displayName});
                }
                appFileExtensionRegistrationMap.set(extension, currentMapping);
            });
            props.mimeTypes.forEach(mimeType => {
                let currentMapping = appMimeTypeRegistrationMap.get(mimeType);
                if (currentMapping == null) {
                    currentMapping = [{name: props.name, displayName: props.displayName}];
                } else {
                    currentMapping.push({name: props.name, displayName: props.displayName});
                }
                appMimeTypeRegistrationMap.set(mimeType, currentMapping);
            });
            props.fileTypes.forEach(fileType => {
                let currentMapping = appFileTypeRegistrationMap.get(fileType);
                if (currentMapping == null) {
                    currentMapping = [{name: props.name, displayName: props.displayName}];
                } else {
                    currentMapping.push({name: props.name, displayName: props.displayName});
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
