<template>
<Article class="app-view launcher-view">
	<AppHeader>
	</AppHeader>
        <div class="modal-body">
            <div v-bind:class="errorClass">
                <label v-if="isError">{{ error }}</label>
            </div>
            <spinner v-if="showSpinner"></spinner>
            <div>
                <h3>Shortcuts</h3>
                <div v-if="shortcutList.length ==0" class="table-responsive">
                    Entries can be added via file/Folder context menu item 'Add to Launcher'
                </div>
                <div v-if="shortcutList!=0" class="table-responsive">
                    <table class="table">
                        <thead>
                        <tr  v-if="shortcutList.length!=0" style="cursor:pointer;">
                            <th @click="setShortCutsSortBy('name')">Name <span v-if="shortCutsSortBy=='name'" v-bind:class="['fas', shortCutsNormalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setShortCutsSortBy('path')">Directory <span v-if="shortCutsSortBy=='path'" v-bind:class="['fas', shortCutsNormalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                        </tr>
                        </thead>
                        <tbody>
                        <tr v-for="shortcut in sortedShortCuts">
                            <td v-on:click="view(shortcut, true)" style="cursor:pointer;">{{ shortcut.name }}</td>
                            <td v-on:click="navigateTo(shortcut)" style="cursor:pointer;">
                                {{ shortcut.path }}
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
                <div v-if="sharedItemsList.length ==0" class="table-responsive">
                    No Items to display
                </div>
                <div v-if="sharedItemsList!=0" class="table-responsive">
                    <table class="table">
                        <thead>
                        <tr  v-if="sharedItemsList!=0" style="cursor:pointer;">
                            <th @click="setSharedSortBy('name')">Name <span v-if="sortBy=='name'" v-bind:class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setSharedSortBy('path')">Directory <span v-if="sortBy=='path'" v-bind:class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setSharedSortBy('size')">Size <span v-if="sortBy=='size'" v-bind:class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setSharedSortBy('modified')">Modified <span v-if="sortBy=='modified'" v-bind:class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
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
const routerMixins = require("../mixins/router/index.js");
const mixins = require("../mixins/mixins.js");
const launcherMixin = require("../mixins/launcher/index.js");
module.exports = {
    components: {
		AppHeader
    },
    data: function() {
        return {
            showSpinner: false,
            walkCounter: 0,
            sharedItemsList: [],
            error: "",
            isError:false,
            errorClass: "",
            sortBy: "name",
            normalSortOrder: true,
            cancelSearch: false,
	        showCancel: false,
            showEmbeddedGallery: false,
            filesToViewInGallery: [],
            launcherApp: null,
            shortcutList: [],
            shortCutsSortBy: "name",
            shortCutsNormalSortOrder: true
        }
    },
    props: [],
    mixins:[routerMixins, mixins, launcherMixin],
    computed: {
        ...Vuex.mapState([
            'context',
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
            that.loadLauncherShortcutsFile(launcher).thenApply(contents => {
                that.showSpinner = false;
                let shortcuts = [];
                contents.shortcuts.forEach(entry => {
                    var isDirectory = false;
                    var name = '';
                    if (entry.link.endsWith('/')) {
                        isDirectory = true;
                    } else {
                        name = entry.link.substring(entry.link.lastIndexOf('/') + 1);
                    }
                    let path = entry.link.substring(0, entry.link.lastIndexOf('/'));
                    shortcuts.push({name: name, path: path, isDirectory : isDirectory});
                });
                that.shortcutList = shortcuts;
            })
        });
    },
    methods: {
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
                                that.showCancel = false;
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
                                    that.showCancel = false;
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
            this.showCancel = true;
            this.cancelSearch = false;
            this.isError = false;
            this.error = "";
            this.errorClass = "";

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
                    if (props.isHidden || props.isDirectory) {
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
            //this.openFileOrDir("Drive", entry.path, entry.isDirectory ? "" : entry.name);
            let that = this;
            let fullPath = entry.path + (entry.isDirectory ? "" : '/' + entry.name);
            this.findFile(fullPath).thenApply(file => {
                if (file != null) {
                    let app = that.getApp(file, entry.path);
                    if (app == 'hex') {
                        that.openFileOrDir("Drive", entry.path, {filename:""});
                    } else {
                        that.openFileOrDir(app, entry.path, {filename:entry.name});
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
        formatDateTime: function(dateTime) {
            let date = new Date(dateTime.toString() + "+00:00");//adding UTC TZ in ISO_OFFSET_DATE_TIME ie 2021-12-03T10:25:30+00:00
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
