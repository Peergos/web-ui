<template>
<Article class="app-view launcher-view">
	<AppHeader>
	</AppHeader>
        <div class="modal-body">
            <Spinner v-if="showSpinner"></Spinner>
            <Replace
                v-if="showReplace"
                v-on:hide-replace="showReplace = false"
                :replace_message='replace_message'
                :replace_body="replace_body"
                :consumer_cancel_func="replace_consumer_cancel_func"
                :consumer_func="replace_consumer_func"
                :showApplyAll=replace_showApplyAll>
            </Replace>
            <NewFilePicker
                v-if="showNewFilePicker"
                @hide-prompt="closeNewFilePicker()"
                :pickerFileExtension="pickerFileExtension"
                :consumer_func="prompt_consumer_func"
            />
            <AppInstall
                v-if="showAppInstallation"
                v-on:hide-app-installation="closeAppInstallation"
                :appInstallSuccessFunc="appInstallSuccess"
                :appPropsFile="appInstallPropsFile"
                :installFolder="appInstallFolder">
            </AppInstall>
            <AppSandbox
                v-if="showAppSandbox"
                v-on:hide-app-sandbox="closeAppSandbox"
                :sandboxAppName="sandboxAppName"
                :currentFile="currentFile"
                :currentPath="currentPath">
            </AppSandbox>
            <Confirm
                    v-if="showConfirm"
                    v-on:hide-confirm="showConfirm = false"
                    :confirm_message='confirm_message'
                    :confirm_body="confirm_body"
                    :consumer_cancel_func="confirm_consumer_cancel_func"
                    :consumer_func="confirm_consumer_func">
            </Confirm>
            <AppDetails
                v-if="showAppDetails"
                v-on:hide-app-details="closeAppDetails"
                :appPropsFile=currentAppPropertiesFile>
            </AppDetails>
            <Share
                v-if="showShare"
                v-on:hide-share-with="closeShare"
                v-on:update-shared-refresh="sharingChangesMade"
                :data="sharedWithData"
                :fromApp="fromApp"
                :displayName="displayName"
                :allowReadWriteSharing="allowReadWriteSharing"
                :allowCreateSecretLink="allowCreateSecretLink"
                :files="filesToShare"
                :path="pathToFile">
            </Share>
            <ul id="appMenu" v-if="showAppMenu" class="dropdown-menu" v-bind:style="{top:menutop, left:menuleft}" style="cursor:pointer;display:block;min-width:100px;padding: 10px;">
                <li id='open-in-app' style="padding-bottom: 5px;" v-for="app in availableApps" v-on:keyup.enter="appOpen($event, app.name, app.path, app.file)" v-on:click="appOpen($event, app.name, app.path, app.file)">{{app.contextMenuText}}</li>
            </ul>
            <div>
                <h3>Custom Apps
                    <button class="btn btn-success" @click="navigateToRecommendedApps()" style="margin-left: 10px;">Recommended Apps</button>
                    <button class="btn btn-info" @click="checkForAppUpdates()" style="margin-left: 10px;">Check for Updates</button>
                    <span style="margin-left: 40px;">{{updateMessage}}</span>
                </h3>
                <div v-if="appsList.length ==0" class="table-responsive">
                    No Custom Apps currently installed.  Create an App from the "create app" menu item of the green plus.
                </div>
                <div v-if="appsList!=0">
                    <AppGrid
                        v-if="showAppGrid"
                        :launchAppFunc="launchAppFromUI"
                        :appDetailsFunc="displayAppDetails"
                        :removeAppFunc="removeApp"
                        :updateAppFunc="updateApp"
                        :apps="appGridItems">
                    </AppGrid>
                </div>
            </div>
            <div>
                <h3>Shortcuts</h3>
                <div v-if="shortcutList.length ==0" class="table-responsive">
                    Entries can be added via context menu item 'Add to Launcher'
                </div>
                <div v-if="shortcutList!=0" class="table-responsive">
                    <table class="table">
                        <thead>
                        <tr  v-if="shortcutList.length!=0" style="cursor:pointer;">
                            <th @click="setShortcutsSortBy('added')">Added <span v-if="shortcutsSortBy=='added'" v-bind:class="['fas', shortcutsNormalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setShortcutsSortBy('name')">Name <span v-if="shortcutsSortBy=='name'" v-bind:class="['fas', shortcutsNormalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setShortcutsSortBy('path')">Folder <span v-if="shortcutsSortBy=='path'" v-bind:class="['fas', shortcutsNormalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setShortcutsSortBy('modified')">Modified <span v-if="shortcutsSortBy=='modified'" v-bind:class="['fas', shortcutsNormalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setShortcutsSortBy('created')">Created <span v-if="shortcutsSortBy=='created'" v-bind:class="['fas', shortcutsNormalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th></th>
                        </tr>
                        </thead>
                        <tbody>
                        <tr v-for="shortcut in sortedShortcuts">
                            <td v-bind:class="[shortcut.missing ? 'deleted-entry' : '']">
                                {{ formatJSDate(shortcut.added) }}
                            </td>
                            <td v-bind:class="[shortcut.missing ? 'deleted-entry' : '']" v-on:click="view($event, shortcut)" style="cursor:pointer;">{{ shortcut.name }}</td>
                            <td v-bind:class="[shortcut.missing ? 'deleted-entry' : '']"  v-on:click="navigateTo(shortcut)" style="cursor:pointer;">
                                {{ shortcut.path }}
                            </td>
                            <td v-bind:class="[shortcut.missing ? 'deleted-entry' : '']">
                                {{ formatDateTime(shortcut.lastModified) }}
                            </td>
                            <td v-bind:class="[shortcut.missing ? 'deleted-entry' : '']">
                                {{ formatJSDate(shortcut.created) }}
                            </td>
                            <td> <button class="btn btn-danger" @click="removeShortcut(shortcut)">Remove</button>
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <div v-if="showSharedItems">
                <h3>Files &amp; Folders I have Shared</h3>
                <div class="flex-container">
                    <div class="flex-item" style="margin: 10px;">
                        <button id='submit-search' class="btn btn-success" @click="findShared()">Recalculate</button>
                    </div>
                </div>
                <div v-if="sharedItemsList!=0" class="table-responsive">
                    <table class="table">
                        <thead>
                        <tr  v-if="sharedItemsList!=0" style="cursor:pointer;">
                            <th @click="setSharedSortBy('name')">Name <span v-if="sortBy=='name'" v-bind:class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setSharedSortBy('path')">Directory <span v-if="sortBy=='path'" v-bind:class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setSharedSortBy('modified')">Modified <span v-if="sortBy=='modified'" v-bind:class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setSharedSortBy('created')">Created <span v-if="sortBy=='created'" v-bind:class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setSharedSortBy('access')">Access <span v-if="sortBy=='access'" v-bind:class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th>Share</th>
                        </tr>
                        </thead>
                        <tbody>
                        <tr v-for="match in sortedSharedItems">
                            <td v-on:click="view($event, match)" style="cursor:pointer;">{{ match.name }}</td>
                            <td v-on:click="navigateTo(match)" style="cursor:pointer;">
                                {{ match.path }}
                            </td>
                            <td>
                                {{ formatDateTime(match.lastModified) }}
                            </td>
                            <td>
                                {{ formatDateTime(match.created) }}
                            </td>
                            <td>
                                {{ match.access }}
                            </td>
                            <td> <button class="btn btn-success" @click="share(match)">Share</button>
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
</article>
</template>

<script>
import AppInstall from "../components/sandbox/AppInstall.vue";
import AppHeader from "../components/AppHeader.vue";
import AppDetails from "../components/sandbox/AppDetails.vue";
import AppGrid from "../components/app-grid/AppGrid.vue";
import AppSandbox from "../components/sandbox/AppSandbox.vue";
import Confirm from "../components/confirm/Confirm.vue";
import NewFilePicker from "../components/picker/NewFilePicker.vue";
import Replace from "../components/replace/Replace.vue";
import Share from "../components/drive/DriveShare.vue";
import Spinner from "../components/spinner/Spinner.vue";

import routerMixins from "../mixins/router/index.js";
import mixins from "../mixins/mixins.js";
import launcherMixin from "../mixins/launcher/index.js";
import sandboxMixin from "../mixins/sandbox/index.js";

import { mapState } from 'vuex'
import { toast } from 'vue3-toastify';
import 'vue3-toastify/dist/index.css';

export default {
    components: {
        AppInstall,
		AppHeader,
		AppDetails,
		AppGrid,
		AppSandbox,
		Confirm,
		NewFilePicker,
		Replace,
		Share,
		Spinner,
    },
    data: function() {
        return {
            showSpinner: false,
            walkCounter: 0,
            sharedItemsList: [],
            sortBy: "name",
            normalSortOrder: true,
            launcherApp: null,
            shortcutList: [],
            shortcutsSortBy: "added",
            shortcutsNormalSortOrder: false,
            appsList: [],
            appsSortBy: "name",
            appsNormalSortOrder: true,
            showConfirm: false,
            confirm_message: "",
            confirm_body: "",
            confirm_consumer_cancel_func: () => {},
            confirm_consumer_func: () => {},
            showAppDetails: false,
            currentAppPropertiesFile: null,
            showAppSandbox: false,
            sandboxAppName: '',
            showShare: false,
            messages: [],
            currentEntry: null,
            currentFile: null,
            currentPath: null,
            showSharedItems: false,
            updateMessage:'',
            showAppInstallation: false,
            appInstallPropsFile: null,
            appInstallFolder: '',
            availableApps: [],
            showAppMenu: false,
            menutop:"",
            menuleft:"",
            showNewFilePicker: false,
            prompt_consumer_func: () => { },
            pickerFileExtension: '',
            showReplace: false,
            replace_message: "",
            replace_body: "",
            replace_consumer_cancel_func: (applyToAll) => { },
            replace_consumer_func: (applyToAll) => { },
            showAppGrid: false,
            forceAppDisplayUpdate: 0,
            appGridItems: []
        }
    },
    props: [],
    mixins:[routerMixins, mixins, launcherMixin, sandboxMixin],
	watch: {
		forceAppDisplayUpdate(newUpdateCounter, oldUpdateCounter) {
		    let that = this;
            this.showAppGrid = false;
			this.appGridItems = this.appsList.slice().sort(function (a, b) {
                 return ('' + a.name).localeCompare(b.name);
             });
            Vue.nextTick(function() {
                that.showAppGrid = true;
            });
		},
    },
    computed: {
        ...mapState([
            'context',
            "shortcuts",
            "sandboxedApps",
            'mirrorBatId',
        ]),
        sortedShortcuts(){
            var sortBy = this.shortcutsSortBy;
            var reverseOrder = ! this.shortcutsNormalSortOrder;
            if(sortBy == "name") {
                return this.shortcutList.sort(function (a, b) {
                    if (reverseOrder) {
                        return ('' + b.name).localeCompare(a.name);
                    } else {
                        return ('' + a.name).localeCompare(b.name);
                    }
                });
            } else if(sortBy == "path") {
                return this.shortcutList.sort(function (a, b) {
                    if (reverseOrder) {
                        return ('' + b.path).localeCompare(a.path);
                    } else {
                        return ('' + a.path).localeCompare(b.path);
                    }
                });
            } else if(sortBy == "modified") {
                return this.shortcutList.sort(function (a, b) {
                    let aVal = a.lastModified;
                    let bVal = b.lastModified;
                    if (reverseOrder) {
                        return bVal.compareTo(aVal);
                    } else {
                        return aVal.compareTo(bVal);
                    }
                });
            } else if(sortBy == "created") {
                return this.shortcutList.sort(function (a, b) {
                    let aVal = a.created;
                    let bVal = b.created;
                    if (reverseOrder) {
                        return bVal - aVal;
                    } else {
                        return aVal - bVal;
                    }
                });
            } else if(sortBy == "added") {
                return this.shortcutList.sort(function (a, b) {
                    let aVal = a.added;
                    let bVal = b.added;
                    if (reverseOrder) {
                        return bVal - aVal;
                    } else {
                        return aVal - bVal;
                    }
                });
            }
        },
        sortedSharedItems(){
            var sortBy = this.sortBy;
            var reverseOrder = ! this.normalSortOrder;
            if(sortBy == "name" || sortBy == "path") {
                return this.sharedItemsList.sort(function (a, b) {
                    if (reverseOrder) {
                        return ('' + b.name).localeCompare(a.name);
                    } else {
                        return ('' + a.name).localeCompare(b.name);
                    }
                });
            } else if(this.sortBy == "modified") {
                return this.sharedItemsList.sort(function (a, b) {
                    let aVal = a.lastModified;
                    let bVal = b.lastModified;
                    if (reverseOrder) {
                        return bVal.compareTo(aVal);
                    } else {
                        return aVal.compareTo(bVal);
                    }
                });
            } else if(this.sortBy == "created") {
                return this.sharedItemsList.sort(function (a, b) {
                    let aVal = a.created;
                    let bVal = b.created;
                    if (reverseOrder) {
                        return bVal.compareTo(aVal);
                    } else {
                        return aVal.compareTo(bVal);
                    }
                });
            } else if(sortBy == "access") {
                return this.sharedItemsList.sort(function (a, b) {
                    let aVal = a.access;
                    let bVal = b.access;
                    if (reverseOrder) {
                        return bVal.compareTo(aVal);
                    } else {
                        return aVal.compareTo(bVal);
                    }
                });
            }
        }
    },
    created: function() {
        let that = this;
        this.showSpinner = true;
        peergos.shared.user.App.init(that.context, "launcher").thenApply(launcher => {
            that.launcherApp = launcher;
            that.setShortcutList(new Map(that.shortcuts.shortcutsMap));
            that.loadInstalledApps();
        });
    },
    methods: {
        confirmReplaceFile(filename, cancelFn, replaceFn) {
            this.showSpinner = false;
            this.replace_message = 'File: "' + filename + '" already exists in this location. Do you wish to replace it?';
            this.replace_body = '';
            this.replace_consumer_cancel_func = cancelFn;
            this.replace_consumer_func = replaceFn;
            this.showReplace = true;
        },
        launchAppFromUI: function(app) {
            if (app.createFile) {
                let that = this;
                this.prompt_consumer_func = function (prompt_result, folder) {
                    if (prompt_result === null)
                        return;
                    let fileName = prompt_result.trim();
                    if (fileName === '')
                        return;
                    that.uploadEmptyFileToFolder(app.name, folder, fileName).thenApply(fileCreated => {
                        if (fileCreated != null && fileCreated === true) {
                            let pathString = '/' + folder;
                            that.findFile(pathString + "/" + fileName).thenApply(file => {
                                that.showAppSandbox = true;
                                that.sandboxAppName = app.name;
                                that.currentFile = file;
                                that.currentPath = pathString;
                            });
                        }
                    });
                };
                this.pickerFileExtension = app.primaryFileExtension;
                this.showNewFilePicker = true;
            } else {
                this.launchApp(app.name);
            }
        },
        getMirrorBatId(file) {
            return file.getOwnerName() == this.context.username ? this.mirrorBatId : java.util.Optional.empty()
        },
        uploadEmptyFileToFolder(appName, folder, filename) {
            this.showSpinner = true;
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            this.context.getByPath(folder).thenApply(function (optDir) {
                let dir = optDir.get();
                dir.hasChild(filename, that.context.crypto.hasher, that.context.network).thenApply(function (alreadyExists) {
                    if (alreadyExists) {
                        that.confirmReplaceFile(filename,
                            () => {
                                future.complete(null);
                            },
                            () => {
                                that.uploadEmptyFile(appName, dir, filename, future);
                            }
                        );
                    } else {
                        that.uploadEmptyFile(appName, dir, filename, future);
                    }
                });
            });
            return future;
        },
        readInEmptyFile: function(fullPathToFile) {
            let that = this;
            var future = peergos.shared.util.Futures.incomplete();
            this.findFile(fullPathToFile).thenApply(file => {
                if (file == null) {
                    future.complete(peergos.shared.user.JavaScriptPoster.emptyArray());
                } else {
                    const props = file.getFileProperties();
                    file.getInputStream(that.context.network, that.context.crypto, props.sizeHigh(), props.sizeLow(), function(read){})
                        .thenCompose(function(reader) {
                            var size = that.getFileSize(props);
                            var data = convertToByteArray(new Int8Array(size));
                            return reader.readIntoArray(data, 0, data.length).thenApply(function(read){
                                future.complete(data);
                            });
                    });
                }
            });
            return future;
        },

        uploadEmptyFile(appName, dir, filename, future) {
            let that = this;
            let extension = filename.substring(filename.lastIndexOf('.') + 1);
            let fullPathToAppEmptyFile = "/" + this.context.username + "/.apps/" + appName + '/assets/empty.' + extension;
            this.readInEmptyFile(fullPathToAppEmptyFile).thenApply(fileData => {
                let reader = new peergos.shared.user.fs.AsyncReader.ArrayBacked(fileData);
                dir.uploadFileJS(filename, reader, 0, fileData.length,
                    true, that.getMirrorBatId(dir), that.context.network, that.context.crypto, function (len) { },
                    that.context.getTransactionService(),
                    f => peergos.shared.util.Futures.of(false)
                ).thenApply(function (res) {
                    that.showMessage(false, "File created");
                    that.showSpinner = false;
                    future.complete(true);
                }).exceptionally(function (throwable) {
                    that.showSpinner = false;
                    that.showMessage(true, "File creation failed");
                    future.complete(false);
                });
            });
            return future;
        },
        closeNewFilePicker() {
            this.showNewFilePicker = false;
        },
        appOpen(event, appName, path, file) {
            this.showAppMenu = false;
            event.stopPropagation();
            this.availableApps = [];
            this.openFileOrDir(appName, path, {filename:file.isDirectory() ? "" : file.getName()})
        },
        loadInstalledApps() {
            let that = this;
            if(!this.sandboxedApps.appsLoaded) {
                setTimeout( () => { that.loadInstalledApps();}, 1000);
            } else {
                let installedApps = that.sandboxedApps.appsInstalled.slice().filter(a => a.name != "htmlviewer");
                for(var i=0; i < installedApps.length; i++) {
                    let appRow = installedApps[i];
                    appRow.updateAvailable = false;
                }
                that.appsList = installedApps;
                that.loadAppIcons();
                that.showSpinner = false;
            }
        },
        appInstallSuccess(appName) {
            let appIndex = this.appsList.findIndex(v => v.name === appName);
            let appRow = this.appsList[appIndex];
            this.appsList.splice(appIndex, 1);
            appRow.updateAvailable = false;
            this.appsList.push(appRow);
            this.updateMessage = '';
            this.forceAppDisplayUpdate++;
        },
        closeAppInstallation() {
            this.showAppInstallation = false;
        },
        updateApp: function(app) {
            let that = this;
            let pathStr = app.source.endsWith('/') ? app.source  : app.source + '/';
            this.context.getByPath(pathStr + 'peergos-app.json').thenApply(propsFileOpt => {
                if (propsFileOpt.ref != null) {
                    that.appInstallPropsFile = propsFileOpt.ref;
                    that.appInstallFolder = pathStr;
                    that.showAppInstallation = true;
                }
            });
        },
        checkForAppUpdates: function() {
            let that = this;
            this.showSpinner = true;
            let appsInstalledWithSource = this.sandboxedApps.appsInstalled.slice().filter(a => a.source.length > 0);
            let future = peergos.shared.util.Futures.incomplete();
            this.gatherAppsWithUpdates(appsInstalledWithSource, 0, [], future);
            future.thenApply(appsWithUpdates => {
                if (appsWithUpdates.length == 0) {
                    that.updateMessage = 'All up-to-date';
                } else if (appsWithUpdates.length == 1) {
                    that.updateMessage = '1 has an update';
                } else {
                    that.updateMessage = appsWithUpdates.length + ' have updates';
                }
                for(var i=0; i < appsWithUpdates.length; i++) {
                    let appName = appsWithUpdates[i].name;
                    let appIndex = that.appsList.findIndex(v => v.name === appName);
                    let appRow = that.appsList[appIndex];
                    appRow.updateAvailable = true;
                    that.forceAppDisplayUpdate++;
                }
                that.showSpinner = false;
            });
        },
        gatherAppsWithUpdates: function(appsInstalledWithSource, index, accumulator, future) {
            if (index == appsInstalledWithSource.length) {
                future.complete(accumulator);
            } else {
                let that = this;
                let app = appsInstalledWithSource[index];
                let pathStr = app.source.endsWith('/') ? app.source + 'peergos-app.json' : app.source + '/peergos-app.json';
                this.context.getByPath(pathStr).thenApply(propsFileOpt => {
                    if (propsFileOpt.ref != null) {
                        that.readJSONFile(propsFileOpt.ref).thenApply(props => {
                            if (that.isAppVersionNewer(app.version, props.version)) {
                                accumulator.push(app);
                            }
                            that.gatherAppsWithUpdates(appsInstalledWithSource, index + 1, accumulator, future);
                        });
                    } else {
                        that.gatherAppsWithUpdates(appsInstalledWithSource, index + 1, accumulator, future);
                    }
                });
            }
        },
        isAppVersionNewer: function(existingVersionStr, sourceVersionStr) {
            try {
                let existingVersion = peergos.shared.util.Version.parse(existingVersionStr);
                let sourceVersion = peergos.shared.util.Version.parse(sourceVersionStr);
                return existingVersion.isBefore(sourceVersion);
            } catch {
                return false;
            }
        },
        navigateToRecommendedApps: function() {
            let that = this;
            let path = "/peergos/recommended-apps/";
            that.findFile(path + "index.html").thenApply(file => {
                if (file != null) {
                    that.launchApp('$$app-gallery$$', file, path);
                }
            });

        },
        loadAppIcons: function() {
            let that = this;
            this.loadAppIconsRecursively(this.appsList, 0, () => {
                    that.forceAppDisplayUpdate++;
                });
        },
        loadAppIconsRecursively: function(apps, index, cb) {
            if (index == apps.length) {
                cb();
            } else {
                let that = this;
                let app = apps[index];
                if (app.appIcon.length == 0) {
                    this.loadAppIconsRecursively(apps, index + 1, cb);
                } else {
                    let fullPathToAppIcon = "/" + this.context.username + "/.apps/" + app.name + '/assets/' + app.appIcon;
                    that.findFile(fullPathToAppIcon).thenApply(file => {
                        if (file != null) {
                           let appIndex = that.appsList.findIndex(v => v.name === app.name);
                           if (appIndex > -1) {
                               let appRow = that.appsList[appIndex];
                               appRow.thumbnail = file.getBase64Thumbnail();
                           }
                        }
                        that.loadAppIconsRecursively(apps, index + 1, cb);
                    });
                }
            }
        },
        setShortcutList: function(shortcutsMap) {
            let that = this;
            let allShortcuts = [];
            shortcutsMap.forEach(function(value, key) {
                var isDirectory = false;
                var name = '';
                if (key.endsWith('/')) {
                    isDirectory = true;
                } else {
                    name = key.substring(key.lastIndexOf('/') + 1);
                }
                let path = key.substring(0, key.lastIndexOf('/'));
                let shortcut = {missing: false, name: name, path: path, isDirectory : isDirectory, lastModified: '',
                    created: new Date(value.created), added: new Date(value.added)};
                that.populateShortcut(shortcut);
                allShortcuts.push(shortcut);
            });
            that.shortcutList = allShortcuts;
        },
        launchApp: function(appName, currentFile, currentPath) {
            this.showAppSandbox = true;
            this.sandboxAppName = appName;
            this.currentFile = currentFile;
            this.currentPath = currentPath;
        },
        closeAppSandbox() {
            this.showAppSandbox = false;
            this.loadInstalledApps();
        },
        displayAppDetails: function(app) {
            let that = this;
            let fullPath = "/" + this.context.username + "/.apps/" + app.name + '/peergos-app.json';
            this.findFile(fullPath).thenApply(file => {
                if (file != null) {
                    that.currentAppPropertiesFile = file;
                    that.showAppDetails = true;
                }
            });
        },
        closeAppDetails() {
            this.currentAppPropertiesFile = null;
            this.showAppDetails = false;
        },
        confirmRemoveApp(appName, replaceFunction, cancelFunction) {
            this.confirm_message = 'Remove App: ' + appName;
            this.confirm_body = "Are you sure you want to remove this App (Including all associated data)?";
            this.confirm_consumer_cancel_func = cancelFunction;
            this.confirm_consumer_func = replaceFunction;
            this.showConfirm = true;
        },
        removeApp: function(app) {
            let that = this;
            if (app.name == 'htmlviewer') {
                this.showErrorMessage('Unable to remove HTML Viewer');
            } else {
                this.confirmRemoveApp(app.displayName,
                    () => {
                        that.showConfirm = false;
                        that.deleteApp(app);
                    },
                    () => {
                        that.showConfirm = false;
                        that.showSpinner = false;
                    }
                );
            }
        },
        deleteApp(app) {
            let that = this;
            let appDirName = app.name;
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
                that.deRegisterApp(app);
                let appIndex = that.appsList.findIndex(v => v.name === app.name);
                if (appIndex > -1) {
                    that.appsList.splice(appIndex, 1);
                    that.forceAppDisplayUpdate++;
                }
                that.showSpinner = false;
            }).exceptionally(function(throwable) {
                console.log('Unexpected error: ' + throwable);
                that.showErrorMessage('Error deleting App: ' + app.name);
                that.showSpinner = false;
            });
        },
        confirmRemoveShortcut(replaceFunction, cancelFunction) {
            this.confirm_message = 'Remove shortcut';
            this.confirm_body = "Are you sure you want to remove this shortcut?";
            this.confirm_consumer_cancel_func = cancelFunction;
            this.confirm_consumer_func = replaceFunction;
            this.showConfirm = true;
        },
        removeShortcut: function(shortcut) {
            let that = this;
            this.confirmRemoveShortcut(
                () => {
                    that.showConfirm = false;
                    that.deleteShortcut(shortcut);
                },
                () => {
                    that.showConfirm = false;
                    that.showSpinner = false;
                }
            );
        },
        deleteShortcut: function(entry) {
            let link = entry.path + '/' + (entry.isDirectory ? "" : entry.name);
            this.refreshAndDeleteShortcutLink(link);
        },
        refreshAndDeleteShortcutLink(link) {
            let that = this;
            this.showSpinner = true;
            this.loadShortcutsFile(this.launcherApp).thenApply(shortcutsMap => {
                if (shortcutsMap.get(link) != null) {
                    shortcutsMap.delete(link)
                    that.updateShortcutsFile(that.launcherApp, shortcutsMap).thenApply(res => {
                        that.showSpinner = false;
                        that.$store.commit("SET_SHORTCUTS", shortcutsMap);
                        that.setShortcutList(new Map(shortcutsMap));
                    });
                } else {
                    that.showSpinner = false;
                }
            })
        },
        populateShortcut(entry) {
            let fullPath = entry.path + (entry.isDirectory ? "" : '/' + entry.name);
            this.findFile(fullPath).thenApply(file => {
                if (file != null) {
                    let props = file.getFileProperties();
                    entry.lastModified = props.modified;
                } else {
                    entry.missing = true;
                }
            });
        },
        walk: function(file, path, sharedWithState) {
            let searchButton = document.getElementById("submit-search");
            let fileProperties = file.getFileProperties();
            if (fileProperties.isHidden)
                return;
            let that = this;
            if (fileProperties.isDirectory) {
                that.walkCounter++;
                if (that.walkCounter == 1) {
                    that.showSpinner = true;
                    searchButton.disabled = true;
                }
                let pathWithoutEndingSlash = path.endsWith('/') ? path.substring(0, path.length -1) : path;
                let directoryPath = peergos.client.PathUtils.directoryToPath(pathWithoutEndingSlash.substring(1).split("/"));
                this.context.getDirectorySharingState(directoryPath).thenApply(function (updatedSharedWithState) {
                    file.getChildren(that.context.crypto.hasher, that.context.network).thenApply(function(children) {
                        let arr = children.toArray();
                        let size = arr.length;
                        if (size == 0) {
                            that.walkCounter--;
                            if (that.walkCounter == 0) {
                                that.showSpinner = false;
                                searchButton.disabled = false;
                            }
                        }
                        arr.forEach(function(child, index){
                            let newPath = child.getFileProperties().isDirectory ? path + child.getFileProperties().name : path;
                            that.walk(child, newPath, updatedSharedWithState);
                            if (index == size - 1) {
                                that.walkCounter--;
                                if (that.walkCounter == 0) {
                                    that.showSpinner = false;
                                    searchButton.disabled = false;
                                }
                            }
                        });
                    });
                });
            }
            this.isSharedTest(sharedWithState, file, path);
        },
        getFileSize: function(props) {
                var low = props.sizeLow();
                if (low < 0) low = low + Math.pow(2, 32);
                return low + (props.sizeHigh() * Math.pow(2, 32));
        },
        addSharedItem: function(sharedWithState, file, path) {
            let props = file.getFileProperties();
            let pathStr = props.isDirectory ? path.substring(0, path.lastIndexOf("/")): path;
            let fileSharingState = sharedWithState.get(props.name);
            let read_usernames = fileSharingState.readAccess.toArray([]);
            let edit_usernames = fileSharingState.writeAccess.toArray([]);
            let entry = {
                path: pathStr,
                name: props.name,
                lastModified: props.modified,
                created: props.created,
                isDirectory: props.isDirectory,
                type: props.getType(),
                file: file,
                read_shared_with_users: read_usernames,
                edit_shared_with_users: edit_usernames,
                access: edit_usernames.length > 0 ? "R & W" : "R"
            };
            this.sharedItemsList.push(entry);
        },
        isSharedTest: function(sharedWithState, file, path) {
            if (sharedWithState == null) {
                return;
            }
            let filename = file.getName();
            let isShared = sharedWithState.isShared(filename);
            if (isShared){
                this.addSharedItem(sharedWithState, file, path);
            }
        },
        findShared: function() {
            var that = this;
            let path = '/' + this.context.username + '/';
            this.sharedItemsList = [];
            this.walkCounter = 0;
            this.context.getByPath(path).thenApply(function(dir){
                that.walk(dir.get(), path, null);
            }).exceptionally(function(throwable) {
                that.showSpinner = false;
                let searchButton = document.getElementById("submit-search");
                searchButton.disabled = false;
                throwable.printStackTrace();
            });

        },
        showMessage: function(isError, title, body) {
            let bodyContents = body == null ? '' : ' ' + body;
            if (isError) {
                toast.error(title + bodyContents, {timeout:false});
            } else {
                toast(title + bodyContents)
            }
        },
        showErrorMessage(errMsg) {
            console.log(errMsg);
            this.showMessage(true, "", errMsg);
            this.showSpinner = false;
        },
        findFile: function(filePath) {
            let that = this;
            var future = peergos.shared.util.Futures.incomplete();
            this.context.getByPath(filePath).thenApply(function(fileOpt){
                if (fileOpt.ref == null) {
                    future.complete(null);
                } else {
                    let file = fileOpt.get();
                    const props = file.getFileProperties();
                    if (props.isHidden) {
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
        view: function (event, entry) {
            if (entry.name.length == 0 || entry.missing) {
                return;
            }
            let that = this;
            let fullPath = entry.path + (entry.isDirectory ? "" : '/' + entry.name);
            this.findFile(fullPath).thenApply(file => {
                if (file != null) {
                    let userApps = this.availableAppsForFile(file);
                    let inbuiltApps = this.getInbuiltApps(file);
                    if (userApps.length == 0) {
                        if (inbuiltApps.length == 1) {
                            if (inbuiltApps[0].name == 'hex') {
                                that.openFileOrDir("Drive", entry.path, {filename:""});
                            } else {
                                this.openFileOrDir(inbuiltApps[0].name, entry.path, {filename:file.isDirectory() ? "" : file.getName()})
                            }
                        } else {
                            this.showAppContextMenu(event, inbuiltApps, userApps, entry.path, file);
                        }
                    } else {
                        this.showAppContextMenu(event, inbuiltApps, userApps, entry.path, file);
                    }
                }
            });
        },
        showAppContextMenu(event, inbuiltApps, userApps, path, file) {
            let appOptions = [];
            for(var i = 0; i < userApps.length; i++) {
                let app = userApps[i];
                let option = {'name': app.name, 'path': path, 'file': file, 'contextMenuText': app.contextMenuText};
                appOptions.push(option);
            }
            for(var i = 0; i < inbuiltApps.length; i++) {
                let app = inbuiltApps[i];
                let option = {'name': app.name, 'path': path, 'file': file, 'contextMenuText': app.contextMenuText};
                appOptions.push(option);
            }
            this.availableApps = appOptions;
            var pos = this.getPosition(event);
            Vue.nextTick(function() {
                var top = pos.y;
                var left = pos.x;
                this.menutop = top + 'px';
                this.menuleft = left + 'px';
            }.bind(this));
            this.showAppMenu = true;
            event.stopPropagation();
        },
        getPosition: function(e) {
            var posx = 0;
            var posy = 0;

            if (!e) var e = window.event;
            if (e.clientX || e.clientY) {
                posx = e.clientX - 100; //todo remove arbitrary offset
                posy = e.clientY - 100;
            }
            return {
                x: posx,
                y: posy
            }
        },
        navigateTo: function (entry) {
            if (entry.missing) {
                return;
            }
            this.openFileOrDir("Drive", entry.path, {filename:""});
        },
        setSharedSortBy: function(prop) {
            if (this.sortBy == prop)
                this.normalSortOrder = !this.normalSortOrder;
            this.sortBy = prop;
        },
        setShortcutsSortBy: function(prop) {
            if (this.shortcutsSortBy == prop)
                this.shortcutsNormalSortOrder = !this.shortcutsNormalSortOrder;
            this.shortcutsSortBy = prop;
        },
        setAppsSortBy: function(prop) {
            if (this.appsSortBy == prop)
                this.appsNormalSortOrder = !this.appsNormalSortOrder;
            this.appsSortBy = prop;
        },
        formatDateTime: function(dateTime) {
            if (dateTime.length == 0) {
                return dateTime;
            }
            let date = new Date(dateTime.toString() + "+00:00");//adding UTC TZ in ISO_OFFSET_DATE_TIME ie 2021-12-03T10:25:30+00:00
            return this.formatJSDate(date);
        },
        formatJSDate: function(date) {
            let formatted = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate()
                + ' ' + (date.getHours() < 10 ? '0' : '') + date.getHours()
                + ':' + (date.getMinutes() < 10 ? '0' : '') + date.getMinutes()
                + ':' + (date.getSeconds() < 10 ? '0' : '') + date.getSeconds();
            return formatted;
        },
        closeShare: function() {
            this.showShare = false;
        },
        sharingChangesMade: function() {
            let that = this;
            let index = this.sharedItemsList.findIndex(v => v.path === this.currentEntry.path &&
                         v.name === this.currentEntry.name);
            let directoryPath = peergos.client.PathUtils.directoryToPath(this.pathToFile);
            this.context.getDirectorySharingState(directoryPath).thenApply(function (sharedWithState) {
                let isShared = sharedWithState.isShared(that.currentEntry.name);
                if (isShared){
                    let fullPath = that.currentEntry.path + '/' + that.currentEntry.name;
                    that.context.getByPath(fullPath).thenApply(function(fileOpt){
                        that.sharedItemsList.splice(index, 1);
                        that.addSharedItem(sharedWithState, fileOpt.ref, fullPath);
                        that.currentEntry = null;
                    });
                } else {
                    that.sharedItemsList.splice(index, 1);
                }
            });
        },
        share: function(entry) {
            this.currentEntry = entry;
            this.filesToShare = [entry.file];
            this.pathToFile = entry.path.split('/').filter(n => n.length > 0);
            this.sharedWithData = {read_shared_with_users:entry.read_shared_with_users,
                edit_shared_with_users: entry.edit_shared_with_users};
            this.fromApp = false;
            this.displayName = entry.name;
            this.allowReadWriteSharing = true;
            this.allowCreateSecretLink = true;
            this.showShare = true;
        }
    }
}
</script>

<style>
.deleted-entry {
    text-decoration: line-through;
}
</style>
