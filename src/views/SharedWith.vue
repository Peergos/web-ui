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
            <div>
                <h3>Shared Items</h3>
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
const AppHeader = require("../components/AppHeader.vue");
const Share = require("../components/drive/DriveShare.vue");
const Spinner = require("../components/spinner/Spinner.vue");
const i18n = require("../i18n/index.js");
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
            sortBy: "name",
            normalSortOrder: true,
            showShare: false,
            currentEntry: null,
        }
    },
    props: [],
    mixins:[i18n],
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
            let secretLinks = fileSharingState.links.toArray([]);
            let writableSecretLinks = secretLinks.filter(link => link.isLinkWritable);
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
                access: edit_usernames.length > 0 || writableSecretLinks.length > 0 ? "R & W" : "R"
            };
            this.sharedItemsList.push(entry);
        },
        isSharedTest: function(sharedWithState, file, path) {
            if (sharedWithState == null) {
                return;
            }
            let filename = file.getName();
            let isShared = sharedWithState.isShared(filename) || sharedWithState.hasLink(filename);
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
</style>
