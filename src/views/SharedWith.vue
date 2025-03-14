<template>
<Article class="app-view launcher-view">
	<AppHeader>
	</AppHeader>
        <div class="modal-body">
            <Spinner v-if="showSpinner"></Spinner>
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
                <li id='open-in-app' style="padding-bottom: 5px;color: black;" v-for="app in availableApps" v-on:keyup.enter="appOpen($event, app.name, app.path, app.file)" v-on:click="appOpen($event, app.name, app.path, app.file)">{{app.contextMenuText}}</li>
            </ul>
            <div>
                <h3>{{ translate("SHAREDWITH.TITLE") }}</h3>
                <div v-if="sharedItemsList!=0" class="table-responsive">
                    <table class="table">
                        <thead>
                        <tr  v-if="sharedItemsList!=0" style="cursor:pointer;">
                            <th @click="setSharedSortBy('name')">Name <span v-if="sortBy=='name'" v-bind:class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setSharedSortBy('path')">Folder <span v-if="sortBy=='path'" v-bind:class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
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
const AppHeader = require("../components/AppHeader.vue");
const Share = require("../components/drive/DriveShare.vue");
const Spinner = require("../components/spinner/Spinner.vue");
const i18n = require("../i18n/index.js");
const routerMixins = require("../mixins/router/index.js");
const sandboxMixin = require("../mixins/sandbox/index.js");
module.exports = {
    components: {
        AppHeader,
		Share,
		Spinner,
    },
    data: function() {
        return {
            showSpinner: false,
            walkCounter: 0,
            sharedItemsList: [],
            sortBy: "modified",
            normalSortOrder: false,
            showShare: false,
            currentEntry: null,
            availableApps: [],
            showAppMenu: false,
            menutop:"",
            menuleft:"",
        }
    },
    props: [],
    mixins:[routerMixins, sandboxMixin, i18n],
	watch: {
    },
    computed: {
        ...Vuex.mapState([
            'context',
        ]),
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
                        return bVal.localeCompare(aVal);
                    } else {
                        return aVal.localeCompare(bVal);
                    }
                });
            }
        }
    },
    created: function() {
        this.findShared();
    },
    methods: {
        addSharedItem: function(fileSharingState, file, path) {
            let props = file.getFileProperties();
            let name = props.name;
            let pathStr = path.substring(0, path.lastIndexOf("/"));
            let read_usernames = fileSharingState.readAccess.toArray([]);
            let edit_usernames = fileSharingState.writeAccess.toArray([]);
            let secretLinks = fileSharingState.links.toArray([]);
            let writableSecretLinks = secretLinks.filter(link => link.isLinkWritable);
            let navName = props.isDirectory ? "" : props.name;
            let navPathStr = props.isDirectory ? path : path.substring(0, path.lastIndexOf("/"));

            let entry = {
                path: pathStr,
                name: name,
                navPath: navPathStr,
                navName: navName,
                lastModified: props.modified,
                created: props.created,
                isDirectory: props.isDirectory,
                type: props.getType(),
                file: file,
                read_shared_with_users: read_usernames,
                edit_shared_with_users: edit_usernames,
                access: edit_usernames.length > 0 || writableSecretLinks.length > 0 ? "R & W" : "R"
            };
            this.sharedItemsList.push(entry);
        },
        findShared: function() {
            var that = this;
            // merge from https://stackoverflow.com/questions/1584370/how-to-merge-two-arrays-in-javascript-and-de-duplicate-items#1584377
            const merge = (a, b, predicate = (a, b) => a === b) => {
                const c = [...a]; // copy to avoid side effects
                // add all items from B to copy C if they're not already present
                b.forEach((bItem) => (c.some((cItem) => predicate(bItem, cItem)) ? null : c.push(bItem)))
                return c;
            }
            this.context.processShared({accept_2: (path, sharedWithState) => {
                if (!( path.startsWith("/.messaging/")
                    || path.startsWith("/.shared/")
                    || path.startsWith("/.apps/")
                    || path.startsWith("/.posts/" ))) {
                    let writeShares = sharedWithState.writeShares.keySet().toArray([]);
                    let readShares = sharedWithState.readShares.keySet().toArray([]);
                    let secretLinks = sharedWithState.links_0.keySet().toArray([]);
                    var combined = merge(writeShares, readShares);
                    combined = merge(combined, secretLinks);
                    combined.forEach(name => {
                        let completePath = that.context.username + path + "/" + name;
                        let fileSharingState = sharedWithState.get(name);
                        that.context.getByPath(completePath).thenApply(fileOpt => {
                            if (fileOpt.ref != null) {
                                let fileProperties = fileOpt.ref.getFileProperties();
                                if (!fileProperties.isHidden) {
                                    that.addSharedItem(fileSharingState, fileOpt.ref, completePath);
                                }
                            }
                        });
                    });
                }
            }}).thenApply(res => {
                that.showSpinner = false;
                let searchButton = document.getElementById("submit-search");
                searchButton.disabled = false;
            }).exceptionally(function(throwable) {
                that.showSpinner = false;
                let searchButton = document.getElementById("submit-search");
                searchButton.disabled = false;
                throwable.printStackTrace();
            });
        },
        view: function (event, entry) {
            if (entry.navName.length == 0) {
                return;
            }
            let that = this;
            let fullPath = entry.navPath + (entry.isDirectory ? "" : '/' + entry.navName);
            this.findFile(fullPath).thenApply(file => {
                if (file != null) {
                    let userApps = this.availableAppsForFile(file);
                    let inbuiltApps = this.getInbuiltApps(file);
                    if (userApps.length == 0) {
                        if (inbuiltApps.length == 1) {
                            if (inbuiltApps[0].name == 'hex') {
                                that.openFileOrDir("Drive", entry.navPath, {filename:""});
                            } else {
                                this.openFileOrDir(inbuiltApps[0].name, entry.navPath, {filename:file.isDirectory() ? "" : file.getName()})
                            }
                        } else {
                            this.showAppContextMenu(event, inbuiltApps, userApps, entry.navPath, file);
                        }
                    } else {
                        this.showAppContextMenu(event, inbuiltApps, userApps, entry.navPath, file);
                    }
                }
            });
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
        appOpen(event, appName, path, file) {
            this.showAppMenu = false;
            event.stopPropagation();
            this.availableApps = [];
            this.openFileOrDir(appName, path, {filename:file.isDirectory() ? "" : file.getName()})
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
                posx = Math.max(0, e.clientX - 100); //todo remove arbitrary offset
                posy = Math.max(0, e.clientY - 100);
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
            this.openFileOrDir("Drive", entry.navPath, {filename:""});
        },
        setSharedSortBy: function(prop) {
            if (this.sortBy == prop)
                this.normalSortOrder = !this.normalSortOrder;
            this.sortBy = prop;
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
                let isShared = sharedWithState.isShared(that.currentEntry.name) || sharedWithState.hasLink(that.currentEntry.name);
                if (isShared){
                    let fullPath = that.currentEntry.path + '/' + that.currentEntry.name;
                    that.context.getByPath(fullPath).thenApply(function(fileOpt){
                        if (fileOpt.ref != null) {
                            that.sharedItemsList.splice(index, 1);
                            let fileSharingState = sharedWithState.get(that.currentEntry.name);
                            that.addSharedItem(fileSharingState, fileOpt.ref, fullPath);
                        }
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
</style>
