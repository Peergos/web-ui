<template>
<article class="app-view pg-view shared-view">
	<AppHeader>
		<template #primary>
			<h1>{{ translate("APPNAV.SHAREDWITH") }}</h1>
		</template>
	</AppHeader>
        <main>
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
            <ul id="appMenu" v-if="showAppMenu" class="pg-menu" v-bind:style="{top:menutop, left:menuleft}" style="display:block;">
                <li id='open-in-app' v-for="app in availableApps" v-on:keyup.enter="appOpen($event, app.name, app.path, app.file)" v-on:click="appOpen($event, app.name, app.path, app.file)">{{app.contextMenuText}}</li>
            </ul>
            <div class="shared-list">
                <div class="table-responsive">
                    <table class="shared-table pg-table">
                        <thead>
                        <tr>
                            <th class="shared-table__glyph"/>
                            <th v-for="col in columns" :key="col.key" :class="[col.cls, {sorted: sortBy==col.key}]"
                                :aria-sort="ariaSortOf(sortBy, col.key, normalSortOrder)" @click="setSharedSortBy(col.key)">{{ translate(col.label) }}<AppIcon
                                v-if="sortBy==col.key" class="sort-caret" :class="{'sort-caret--asc': normalSortOrder}" icon="chevron-down"/></th>
                            <th class="shared-table__action"/>
                        </tr>
                        </thead>
                        <tbody>
                        <tr v-for="match in sortedSharedItems">
                            <td class="shared-table__glyph">
                                <AppIcon class="card__icon" :icon="fileIcon(match.type)"/>
                            </td>
                            <td class="shared-table__name" :title="match.name" v-on:click="view($event, match)">{{ match.name }}</td>
                            <td class="shared-table__path" :title="match.path" v-on:click="navigateTo(match)">
                                {{ match.path }}
                            </td>
                            <td class="shared-table__date shared-table__modified">
                                {{ formatDateTime(match.lastModified) }}
                            </td>
                            <td class="shared-table__date shared-table__created">
                                {{ formatDateTime(match.created) }}
                            </td>
                            <td class="shared-table__access">
                                <span class="access-mark" :class="{'access-mark--write': match.access != 'R'}">{{ match.access }}</span>
                            </td>
                            <td class="shared-table__action">
                                <button class="pg-btn pg-btn--onTone shared-table__share" @click="share(match)">{{ translate("DRIVE.SHARE") }}</button>
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </div>
                <!-- under the heads the drive keeps too: what would be here, rather than
                     a table that stops at its own header -->
                <section v-if="sharedItemsList == 0" class="pg-empty">
                    <span class="pg-empty__mark" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a4 4 0 0 0 5.66 0l3-3A4 4 0 0 0 13 4.34l-1.5 1.5"/><path d="M14 11a4 4 0 0 0-5.66 0l-3 3A4 4 0 0 0 11 19.66l1.5-1.5"/></svg>
                    </span>
                    <h2>{{ translate("SHAREDWITH.EMPTY.TITLE") }}</h2>
                    <p>{{ translate("SHAREDWITH.EMPTY.BODY") }}</p>
                </section>
            </div>
        </main>
</article>
</template>

<script>
const AppHeader = require("../components/AppHeader.vue");
const AppIcon = require("../components/AppIcon.vue");
const Share = require("../components/drive/DriveShare.vue");
const Spinner = require("../components/spinner/Spinner.vue");
const i18n = require("../i18n/index.js");
const fileIcon = require("../mixins/fileicon/index.js");
const sortColumn = require("../mixins/sortcolumn/index.js");
const routerMixins = require("../mixins/router/index.js");
const sandboxMixin = require("../mixins/sandbox/index.js");
module.exports = {
    components: {
        AppHeader,
		AppIcon,
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
            columns: [
                {key: "name", cls: "shared-table__name", label: "DRIVE.NAME"},
                {key: "path", cls: "shared-table__path", label: "SHAREDWITH.FOLDER"},
                {key: "modified", cls: "shared-table__date", label: "DRIVE.MODIFIED"},
                {key: "created", cls: "shared-table__date", label: "DRIVE.CREATED"},
                {key: "access", cls: "shared-table__access", label: "SHAREDWITH.ACCESS"},
            ],
            showShare: false,
            currentEntry: null,
            availableApps: [],
            showAppMenu: false,
            menutop:"",
            menuleft:"",
        }
    },
    props: [],
    mixins:[routerMixins, sandboxMixin, i18n, fileIcon, sortColumn],
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
/* What has been shared out, on the surfaces the drive and the status cards use: the
   list wears .pg-table, the menu .pg-menu, and the row's action .pg-btn. Only the
   look changes - the walk that fills the list, the sorting and the share dialog are
   the ones this view always had. */
/* the page shell centres a 1040px column, which suits a page of cards; a list reads
   better the way the drive's does, across the whole window */
.shared-view main {
	max-width: none;
	padding: 0;
	gap: 0;
}

.shared-list {
	display: flex;
	flex-direction: column;
	min-width: 0;
}

/* what a row is - a folder or a file - said with the glyph the drive uses */
.shared-table th.shared-table__glyph,
.shared-table td.shared-table__glyph {
	width: 52px;
	padding: 0 8px 0 32px;
	cursor: default;
}

.shared-table td.shared-table__glyph .card__icon {
	display: block;
	width: 26px;
	height: 26px;
	color: var(--pg-muted);
}

/* the outermost cells carry the page's margin, so the header strip and the rules
   between rows run the full width, as the drive's list does */
.shared-table th:first-child,
.shared-table td:first-child {
	padding-left: 32px;
}

.shared-table th:last-child,
.shared-table td:last-child {
	padding-right: 32px;
}

/* the wrapper is bootstrap's and brings a hard-coded #ddd box at phone widths, which
   ignores the theme. The rows carry their own hairlines, so it goes - from this list
   alone: the share dialog opens inside this view and keeps everything of its own */
.shared-list .table-responsive {
	border: 0;
}

/* the shared parts are .pg-table; these are this table's own cells */
.shared-table tbody tr {
	height: 48px;
}

.shared-table td {
	color: var(--pg-muted);
	font-size: 13px;
	white-space: nowrap;
}

.shared-table td.shared-table__name {
	font-size: 15px;
	color: var(--color);
	cursor: pointer;
	max-width: 420px;
	overflow: hidden;
	text-overflow: ellipsis;
}

.shared-table td.shared-table__path {
	color: var(--pg-link);
	cursor: pointer;
	max-width: 280px;
	overflow: hidden;
	text-overflow: ellipsis;
}

.shared-table td.shared-table__path:hover {
	text-decoration: underline;
}

.shared-table .shared-table__date {
	width: 180px;
	font-variant-numeric: tabular-nums;
}

.shared-table .shared-table__access {
	width: 110px;
}

/* read or write, said the way the status cards say a state rather than as bare
   letters in a column */
.access-mark {
	display: inline-flex;
	align-items: center;
	height: 24px;
	padding: 0 10px;
	font-size: var(--text-mini);
	font-weight: var(--bold);
	letter-spacing: .04em;
	color: var(--pg-muted);
	background-color: var(--pg-surface-2);
	border-radius: var(--radius-pill);
}

.access-mark--write {
	color: var(--pg-on-ok);
	background-color: var(--pg-tint-ok);
}

.shared-table th.shared-table__action,
.shared-table td.shared-table__action {
	width: 110px;
	text-align: right;
	cursor: default;
}

/* .pg-btn--onTone borders itself in the current colour, as the sync summary's own
   button does; here that colour is the tone the drive marks a share with */
.shared-table .shared-table__share {
	min-height: 32px;
	padding: 6px 14px;
	font-size: 13px;
	color: var(--pg-on-ok);
}

.shared-table .shared-table__share:hover {
	color: var(--pg-on-ok);
	background-color: var(--pg-tint-ok);
}

/* ---------- phone ---------- */

@media (max-width: 1024px) {

	/* a chip is as wide as its label; the widths above are the columns', and they
	   outrank the shared rule that would have freed them */
	.shared-table thead th.shared-table__name,
	.shared-table thead th.shared-table__path,
	.shared-table thead th.shared-table__date,
	.shared-table thead th.shared-table__access {
		width: auto;
	}

	.shared-table thead th.shared-table__action,
	.shared-table thead th.shared-table__glyph {
		display: none;
	}

	.shared-table tbody tr {
		display: grid;
		grid-template-columns: 34px auto 1fr auto auto;
		grid-template-areas:
			"glyph name name acc share"
			"glyph path mod  acc share";
		align-items: center;
		column-gap: 8px;
		row-gap: 2px;
		height: auto;
		padding: 10px 12px;
	}

	/* the row carries the margin on a phone, so its own cells sit flush inside it */
	.shared-table tbody td:first-child {
		padding-left: 0;
	}

	.shared-table tbody td:last-child {
		padding-right: 0;
	}

	/* a chip keeps the padding that makes it a chip: the margin belongs to the strip
	   around them, not to the first one's label */
	.shared-table thead th:first-child {
		padding-left: 12px;
	}

	.shared-table thead th:last-child {
		padding-right: 12px;
	}

	.shared-table td {
		padding: 0;
		max-width: none;
		white-space: normal;
		overflow-wrap: anywhere;
	}

	/* the folder, the date and the access read as one line about this file, with the
	   button that acts on it standing clear of them */
	.shared-table td.shared-table__glyph {
		grid-area: glyph;
		width: auto;
		padding: 0;
		align-self: center;
	}

	/* one line with an ellipsis, as the drive list and the sync rows do: the whole
	   name is in the title, and a row that wraps pushes the next one down the page */
	.shared-table td.shared-table__name {
		grid-area: name;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.shared-table td.shared-table__path { grid-area: path; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	/* width: 180px above is the column's, and a line is not a column */
	.shared-table td.shared-table__modified { grid-area: mod; width: auto; white-space: nowrap; }
	.shared-table td.shared-table__created { display: none; }

	/* a column of its own across both lines, so it stands level with the button
	   rather than hanging off the end of the detail line */
	.shared-table td.shared-table__access {
		grid-area: acc;
		width: auto;
		justify-self: center;
		align-self: center;
	}

	/* it spans both lines, so it says where it sits in them rather than being
	   stretched to their full height */
	.shared-table td.shared-table__action {
		grid-area: share;
		width: auto;
		align-self: center;
	}

	/* a finger needs more than a mouse, as .pg-btn already allows for. The cells above
	   may break a long path anywhere; a button's label is not a path, and breaking it
	   would squeeze the column to one letter per line */
	.shared-table .shared-table__share {
		min-height: 44px;
		padding: 6px 16px;
		white-space: nowrap;
		overflow-wrap: normal;
	}
}
</style>
