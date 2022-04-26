<template>
<Article class="app-view launcher-view">
	<AppHeader>
	</AppHeader>
        <div class="modal-body">
            <spinner v-if="showSpinner"></spinner>
            <AppSandbox
                v-if="showAppSandbox"
                v-on:hide-app-sandbox="closeAppSandbox"
                :sandboxAppName="sandboxAppName"
                :currentFile=null>
            </AppSandbox>
            <confirm
                    v-if="showConfirm"
                    v-on:hide-confirm="showConfirm = false"
                    :confirm_message='confirm_message'
                    :confirm_body="confirm_body"
                    :consumer_cancel_func="confirm_consumer_cancel_func"
                    :consumer_func="confirm_consumer_func">
            </confirm>
            <AppDetails
                v-if="showAppDetails"
                v-on:hide-app-details="closeAppDetails"
                :appPropsFile=currentAppPropertiesFile>
            </AppDetails>
            <div>
                <h3>Shortcuts</h3>
                <div v-if="shortcutList.length ==0" class="table-responsive">
                    Entries can be added via context menu item 'Add to Launcher'
                </div>
                <div v-if="shortcutList!=0" class="table-responsive">
                    <table class="table">
                        <thead>
                        <tr  v-if="shortcutList.length!=0" style="cursor:pointer;">
                            <th @click="setShortCutsSortBy('added')">Added <span v-if="shortCutsSortBy=='added'" v-bind:class="['fas', shortCutsNormalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setShortCutsSortBy('name')">Name <span v-if="shortCutsSortBy=='name'" v-bind:class="['fas', shortCutsNormalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setShortCutsSortBy('path')">Directory <span v-if="shortCutsSortBy=='path'" v-bind:class="['fas', shortCutsNormalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setShortCutsSortBy('modified')">Modified <span v-if="shortCutsSortBy=='modified'" v-bind:class="['fas', shortCutsNormalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setShortCutsSortBy('created')">Created <span v-if="shortCutsSortBy=='created'" v-bind:class="['fas', shortCutsNormalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th></th>
                        </tr>
                        </thead>
                        <tbody>
                        <tr v-for="shortcut in sortedShortCuts">
                            <td>
                                {{ formatJSDate(shortcut.added) }}
                            </td>
                            <td v-on:click="view(shortcut, true)" style="cursor:pointer;">{{ shortcut.name }}</td>
                            <td v-on:click="navigateTo(shortcut)" style="cursor:pointer;">
                                {{ shortcut.path }}
                            </td>
                            <td>
                                {{ formatDateTime(shortcut.lastModified) }}
                            </td>
                            <td>
                                {{ formatJSDate(shortcut.created) }}
                            </td>
                            <td> <button class="btn btn-danger" @click="removeShortcut(shortcut)">Delete</button>
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <div>
                <h3>Apps</h3>
                <div v-if="appsList.length ==0" class="table-responsive">
                    No Apps currently installed
                </div>
                <div v-if="appsList!=0" class="table-responsive">
                    <table class="table">
                        <thead>
                        <tr  v-if="appsList.length!=0" style="cursor:pointer;">
                            <th @click="setAppsSortBy('name')">Name <span v-if="appsSortBy=='name'" v-bind:class="['fas', appsNormalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th></th>
                            <th>Delete</th>
                        </tr>
                        </thead>
                        <tbody>
                        <tr v-for="app in sortedApps">
                            <td v-if="app.launchable"><button class="btn btn-info" @click="launchApp(app.name)">{{ app.displayName }}</button></td>
                            <td v-if="!app.launchable">{{ app.displayName }}</td>
                            <td> <button class="btn btn-success" @click="displayAppDetails(app)">Details</button>
                            </td>
                            <td> <button class="btn btn-danger" @click="removeApp(app)">Remove</button>
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </div>
            </div>
            <div>
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
                            <th @click="setSharedSortBy('size')">Size <span v-if="sortBy=='size'" v-bind:class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setSharedSortBy('modified')">Modified <span v-if="sortBy=='modified'" v-bind:class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setSharedSortBy('created')">Created <span v-if="sortBy=='created'" v-bind:class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                        </tr>
                        </thead>
                        <tbody>
                        <tr v-for="match in sortedSharedItems">
                            <td v-on:click="view(match, true)" style="cursor:pointer;">{{ match.name }}</td>
                            <td v-on:click="navigateTo(match)" style="cursor:pointer;">
                                {{ match.path }}
                            </td>
                            <td>
                                {{ match.size }}
                            </td>
                            <td>
                                {{ formatDateTime(match.lastModified) }}
                            </td>
                            <td>
                                {{ formatDateTime(match.created) }}
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
const AppHeader = require("../components/AppHeader.vue");
const AppDetails = require("../components/sandbox/AppDetails.vue");
const AppSandbox = require("../components/sandbox/AppSandbox.vue");
const routerMixins = require("../mixins/router/index.js");
const mixins = require("../mixins/mixins.js");
const launcherMixin = require("../mixins/launcher/index.js");
const sandboxMixin = require("../mixins/sandbox/index.js");
module.exports = {
    components: {
		AppHeader,
		AppDetails,
		AppSandbox
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
            shortCutsSortBy: "name",
            shortCutsNormalSortOrder: true,
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
            sandboxAppName: ''
        }
    },
    props: [],
    mixins:[routerMixins, mixins, launcherMixin, sandboxMixin],
    computed: {
        ...Vuex.mapState([
            'context',
            "shortcuts"
        ]),
        sortedShortCuts(){
            var sortBy = this.shortCutsSortBy;
            var reverseOrder = ! this.shortCutsNormalSortOrder;
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
        sortedApps(){
            var sortBy = this.appsSortBy;
            var reverseOrder = ! this.appsNormalSortOrder;
            if(sortBy == "name") {
                return this.appsList.sort(function (a, b) {
                    if (reverseOrder) {
                        return ('' + b.name).localeCompare(a.name);
                    } else {
                        return ('' + a.name).localeCompare(b.name);
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
            } else if(sortBy == "size") {
                return this.sharedItemsList.sort(function (a, b) {
                    let aVal = reverseOrder ? b.size : a.size;
                    let bVal = reverseOrder ? a.size : b.size;
                    if (aVal > bVal) {
                        return 1;
                    } else if (aVal == bVal) {
                        return 0;
                    } else {
                        return -1;
                    }
                });
            }
        }
    },
    created: function() {
        let that = this;
        peergos.shared.user.App.init(that.context, "launcher").thenCompose(launcher => {
            that.launcherApp = launcher;
            that.showSpinner = true;
            that.setShortcutList(new Map(that.shortcuts.shortcutsMap));
            that.appsList = this.sandboxedApps.appsInstalled.slice();
            that.showSpinner = false;
        });
    },
    methods: {
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
                let shortcut = {name: name, path: path, isDirectory : isDirectory, lastModified: '',
                    created: new Date(value.created), added: new Date(value.added)};
                that.populateShortcut(shortcut);
                allShortcuts.push(shortcut);
            });
            that.shortcutList = allShortcuts;
        },
        launchApp: function(appName) {
            this.showAppSandbox = true;
            this.sandboxAppName = appName;
        },
        closeAppSandbox() {
            this.showAppSandbox = false;
        },
        displayAppDetails: function(app) {
            console.log('displayAppDetails');
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
        removeApp: function(app) {
            let that = this;
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
                let appIndex = appsList.findIndex(v => v.name === app.name);
                if (appIndex > -1) {
                    appsList.splice(appIndex, 1);
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
            console.log('removeShortcut');
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
            this.loadLauncherShortcutsFile(this.launcherApp).thenApply(shortcutsMap => {
                if (shortcutsMap.get(link) != null) {
                    shortcutsMap.delete(link)
                    that.updateLauncherShortcutsFile(that.launcherApp, shortcutsMap).thenApply(res => {
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
                    file.getChildren(that.context.crypto.hasher, that.context.network).thenCompose(function(children) {
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
        addSharedItem: function(props, path) {
            let pathStr = props.isDirectory ? path.substring(0, path.lastIndexOf("/")): path;
            let entry = {
                path: pathStr,
                name: props.name,
                size: props.isDirectory ? "" : this.getFileSize(props),
                lastModified: props.modified,
                created: props.created,
                isDirectory: props.isDirectory,
                type: props.getType()
            };
            this.sharedItemsList.push(entry);
        },
        isSharedTest: function(sharedWithState, file, path) {
            if (sharedWithState == null) {
                return;
            }
            let props = file.getFileProperties();
            let filename = props.name;
            let isShared = sharedWithState.isShared(filename);
            if (isShared){
                this.addSharedItem(props, path);
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
        findFile: function(filePath) {
            let that = this;
            var future = peergos.shared.util.Futures.incomplete();
            this.context.getByPath(filePath).thenApply(function(fileOpt){
                if (fileOpt.ref == null) {
                    that.showErrorMessage("path not found!: " + filePath);
                    future.complete(null);
                } else {
                    let file = fileOpt.get();
                    const props = file.getFileProperties();
                    if (props.isHidden) {
                        that.showErrorMessage("file not accessible: " + filePath);
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
        view: function (entry) {
            if (entry.name.length == 0) {
                return;
            }
            let that = this;
            let fullPath = entry.path + (entry.isDirectory ? "" : '/' + entry.name);
            this.findFile(fullPath).thenApply(file => {
                if (file != null) {
                    let app = that.getApp(file, entry.path, file.isWritable());
                    if (app == 'hex') {
                        that.openFileOrDir("Drive", entry.path, {filename:""});
                    } else {
                        if (app == 'editor') {
                            let mimeType = file.getFileProperties().mimeType;
                            if (mimeType.startsWith("text/x-markdown") ||
                                ( mimeType.startsWith("text/") && entry.name.endsWith('.md'))) {
                                that.openFileOrDir("markdown", entry.path, {filename:entry.name});
                            } else {
                                that.openFileOrDir("editor", entry.path, {filename:entry.name});
                            }
                        } else {
                            that.openFileOrDir(app, entry.path, {filename:entry.name});
                        }
                    }
                }
            });
        },
        navigateTo: function (entry) {
            this.openFileOrDir("Drive", entry.path, {filename:""});
        },
        setSharedSortBy: function(prop) {
            if (this.sortBy == prop)
                this.normalSortOrder = !this.normalSortOrder;
            this.sortBy = prop;
        },
        setShortCutsSortBy: function(prop) {
            if (this.shortCutsSortBy == prop)
                this.shortCutsNormalSortOrder = !this.shortCutsNormalSortOrder;
            this.shortCutsSortBy = prop;
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
        }
    }
}
</script>

<style>
.search {
    color: var(--color);
    background-color: var(--bg);
}
.search select {
    color: var(--color);
    background-color: var(--bg);
}
</style>
