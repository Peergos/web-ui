<template>
<transition name="modal">
<div class="modal-mask" @click="close"> 
    <div class="modal-container search full-height" @click.stop style="overflow-y:auto">
      <span @click="close" tabindex="0" v-on:keyup.enter="close" aria-label="close" class="close">&times;</span>
        <div class="modal-header">
            <h2>{{ translate("SEARCH.SEARCH") }}: {{ path }}</h2>
        </div>
        <div class="modal-body">
            <div v-bind:class="errorClass">
                <label v-if="isError">{{ error }}</label>
            </div>
            <Spinner v-if="showSpinner"
            :absolutePosition="spinnerAbsolutePosition"></Spinner>
            <ul id="appMenu" v-if="showAppMenu" class="dropdown-menu" v-bind:style="{top:menutop, left:menuleft}" style="cursor:pointer;display:block;min-width:100px;padding: 10px;">
                <li id='open-in-app' style="padding-bottom: 5px;color: black;" v-for="app in availableApps" v-on:keyup.enter="appOpen($event, app.name, app.path, app.file)" v-on:click="appOpen($event, app.name, app.path, app.file)">{{app.contextMenuText}}</li>
            </ul>
                <div class="flex-container">
                    <div class="flex-item search" style="margin: 10px; border-width: 1px; border-style: solid;">
                        <select v-model="selectedSearchType">
                            <option value="contains">{{ translate("SEARCH.NAME.CONTAINS") }}</option>
                            <option value="textContents">{{ translate("SEARCH.TEXT.CONTAINS") }}</option>
                            <option value="modifiedAfter">{{ translate("SEARCH.MODIFIED.AFTER") }}</option>
                            <option value="modifiedBefore">{{ translate("SEARCH.MODIFIED.BEFORE") }}</option>
                            <option value="createdAfter">{{ translate("SEARCH.CREATED.AFTER") }}</option>
                            <option value="createdBefore">{{ translate("SEARCH.CREATED.BEFORE") }}</option>
                            <option value="fileSizeGreaterThan">{{ translate("SEARCH.SIZE.GREATER") }}</option>
                            <option value="fileSizeLessThan">{{ translate("SEARCH.SIZE.LESS") }}</option>
                            <option value="mimeType">{{ translate("SEARCH.TYPE") }}</option>
                        </select>
                    </div>
                    <div class="flex-item" v-if="selectedSearchType=='modifiedAfter' || selectedSearchType=='modifiedBefore' || selectedSearchType=='createdAfter' || selectedSearchType=='createdBefore'" style="margin: 10px;">
                        <input v-model="selectedDate" type="date" min="1900-01-01" max="3000-01-01" maxlength="12" ></input>
                    </div>
                    <div class="flex-item" v-if="selectedSearchType=='contains' || selectedSearchType=='textContents'" style="margin: 10px;">
                        <input v-focus v-on:keyup.enter="search" v-model="searchContains" placeholder=""type="text" maxlength="60" style="width: 200px;" ></input>
                    </div>
                    <div class="flex-item" v-if="selectedSearchType=='fileSizeGreaterThan' || selectedSearchType=='fileSizeLessThan'" style="margin: 10px;">
                        <input v-focus v-on:keyup.enter="search" v-model="searchFileSize" placeholder="1" type="number" min="1" style="width: 100px;" ></input>
                    </div>
                    <div class="flex-item" v-if="selectedSearchType=='fileSizeGreaterThan' || selectedSearchType=='fileSizeLessThan'" style="margin: 10px;">
                        <select v-model="selectedSizeUnit">
                            <option value="K">KiB</option>
                            <option value="M">MiB</option>
                            <option value="G">GiB</option>
                        </select>
                    </div>
                    <div class="flex-item" v-if="selectedSearchType=='mimeType'" style="margin: 10px;">
                        <select v-model="selectedMimeType">
                            <option value="audio">{{ translate("SEARCH.AUDIO") }}</option>
                            <option value="image">{{ translate("SEARCH.IMAGE") }}</option>
                            <option value="application/pdf">PDF</option>
                            <option value="text/plain">{{ translate("SEARCH.TEXT") }}</option>
                            <option value="video">{{ translate("SEARCH.VIDEO") }}</option>
                        </select>
                    </div>
                    <div class="flex-item" style="margin: 10px;">
                        <button id='submit-search' class="btn btn-success" @click="search()">{{ translate("SEARCH.SEARCH") }}</button>
                    </div>
                </div>
            </div>

            <div>
                <h3>{{ translate("SEARCH.RESULTS") }}: {{ matches.length }}</h3>
                <div v-if="showCancel" style="margin: 10px;">
                    <button class="btn btn-danger" @click="stopSearch()">Cancel Search</button>
                </div>
                <div v-if="matches!=0" class="table-responsive">
                    <table class="table">
                        <thead>
                        <tr  v-if="matches!=0" style="cursor:pointer;">
                            <th @click="setSortBy('name')">{{ translate("DRIVE.NAME") }}<span v-if="sortBy=='name'" v-bind:class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setSortBy('path')">{{ translate("SEARCH.DIR") }}<span v-if="sortBy=='path'" v-bind:class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setSortBy('size')">{{ translate("DRIVE.SIZE") }}<span v-if="sortBy=='size'" v-bind:class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setSortBy('modified')">{{ translate("DRIVE.MODIFIED") }} <span v-if="sortBy=='modified'" v-bind:class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setSortBy('created')">{{ translate("DRIVE.CREATED") }}<span v-if="sortBy=='created'" v-bind:class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>

                        </tr>
                        </thead>
                        <tbody>
                        <tr v-for="match in sortedItems">
                            <td v-on:click="view($event, match)" style="cursor:pointer;">{{ match.name }}</td>
                            <td v-on:click="navigateTo(match)" style="cursor:pointer;">
                                {{ match.path }}
                            </td>
                            <td>
                                {{ convertBytesToHumanReadable(match.size) }}
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
    </div>
</div>
</transition>
</template>

<script>
const routerMixins = require("../mixins/router/index.js");
const Spinner = require("./spinner/Spinner.vue");
const i18n = require("../i18n/index.js");

module.exports = {
	components: {
	    Spinner
	},
    mixins:[i18n, routerMixins],
    data: function() {
        return {
            searchContains: "",
            showSpinner: false,
            walkCounter: 0,
            matches: [],
            selectedSearchType: "contains",
            selectedSizeUnit: "M",
            selectedMimeType: "video",
            selectedDate: "",
            searchFileSize : "1",
            error: "",
            isError:false,
            errorClass: "",
            sortBy: "name",
            normalSortOrder: true,
            cancelSearch: false,
	        showCancel: false,
            availableApps: [],
            showAppMenu: false,
            menutop:"",
            menuleft:"",
            spinnerAbsolutePosition: true,
        }
    },
    props: ['path', 'navigateToAction'],
    created: function() {
        this.selectedDate = new Date().toISOString().split('T')[0];
    },
    methods: {
    convertBytesToHumanReadable:function(bytes) {
        if (bytes == "")
            return "0 Bytes";
        if (bytes < 1000)
            return bytes + " Bytes";
        if (bytes < 1000 * 1000)
            return this.roundToDisplay(bytes / 1000) + " KB";
        if (bytes < 1000 * 1000 * 1000)
            return this.roundToDisplay(bytes / 1000 / 1000) + " MB";
        return this.roundToDisplay(bytes / 1000 / 1000 / 1000) + " GB";
    },
    roundToDisplay:function(x) {
            return Math.round(x * 100) / 100;
    },
	walk: function(file, path, searchTerm, searchTest) {
        let searchButton = document.getElementById("submit-search");
        if (this.cancelSearch) {
            this.showSpinner = false;
            searchButton.disabled = false;
            return;
        }
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
            file.getChildren(this.context.crypto.hasher, this.context.network).thenCompose(function(children) {
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
                    let newPath = child.getFileProperties().isDirectory ? path + "/" + child.getFileProperties().name : path;
                    that.walk(child, newPath, searchTerm, searchTest);
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
        }
        searchTest(file, path, searchTerm); //could be file or dir
    },
    getFileSize: function(props) {
            var low = props.sizeLow();
            if (low < 0) low = low + Math.pow(2, 32);
            return low + (props.sizeHigh() * Math.pow(2, 32));
    },
    addMatch: function(props, path) {
        let pathStr = props.isDirectory ? path.substring(0, path.lastIndexOf("/")): path;
        let entry = {
            path: pathStr,
            name: props.name,
            size: props.isDirectory ? "" : this.getFileSize(props),
            lastModified: props.modified,
            created: props.created,
            isDirectory: props.isDirectory
        };
        this.matches.push(entry);
    },
    containsTest: function(file, path, searchTerm) {
        let props = file.getFileProperties();
        let filename = props.name;
        if (filename.toLowerCase().indexOf(searchTerm) > -1) {
            this.addMatch(props, path);
        }
    },
    textFileContainsTest: function(file, path, searchTerm) {
        let that = this;
        let props = file.getFileProperties();
        let mimeType = props.mimeType;
        if (mimeType.startsWith('text/')) {
            file.getInputStream(this.context.network,this.context.crypto,props.sizeHigh(),props.sizeLow(), r => {})
                .thenCompose(function (reader) {
                    let size = that.getFileSize(props)
                    let maxBlockSize = 1024 * 1024 * 1;
                    var blockSize = size > maxBlockSize ? maxBlockSize : size;
                    let pump = (previousBlockSnippet) => {
                        if (blockSize > 0) {
                            var data = convertToByteArray(new Uint8Array(blockSize))
                            reader.readIntoArray(data, 0, blockSize).thenApply(function (read) {
                                size = size - read.value_0;
                                blockSize = size > maxBlockSize ? maxBlockSize : size;
                                let textBlock = previousBlockSnippet + new TextDecoder().decode(data);
                                if(textBlock.search(new RegExp(searchTerm, "i")) != -1){
                                    that.addMatch(props, path);
                                } else {
                                    let limit = Math.max(0, textBlock.length - (searchTerm.length -1));
                                    setTimeout(() => { pump(textBlock.substring(limit));});
                                }
                            })
                        }
                    }
                    pump("");
                });
        }
    },
    modifiedAfterTest: function(file, path, searchTerm) {
        let props = file.getFileProperties();
        let modified = props.modified.date;
        let jsDate = new Date(modified.year, modified.month -1, modified.day, 0, 0, 0, 0);
        if (jsDate.getTime() > (searchTerm.getTime() + (1000 * 60 * 60 * 24) - 1)) {
            this.addMatch(props, path);
        }
    },
    modifiedBeforeTest: function(file, path, searchTerm) {
        let props = file.getFileProperties();
        let modified = props.modified.date;
        let jsDate = new Date(modified.year, modified.month -1, modified.day, 0, 0, 0, 0);
        if (jsDate.getTime() < searchTerm.getTime()) {
            this.addMatch(props, path);
        }
    },
    createdAfterTest: function(file, path, searchTerm) {
        let props = file.getFileProperties();
        let created = props.created.date;
        let jsDate = new Date(created.year, created.month -1, created.day, 0, 0, 0, 0);
        if (jsDate.getTime() > (searchTerm.getTime() + (1000 * 60 * 60 * 24) - 1)) {
            this.addMatch(props, path);
        }
    },
    createdBeforeTest: function(file, path, searchTerm) {
        let props = file.getFileProperties();
        let created = props.created.date;
        let jsDate = new Date(created.year, created.month -1, created.day, 0, 0, 0, 0);
        if (jsDate.getTime() < searchTerm.getTime()) {
            this.addMatch(props, path);
        }
    },
    fileSizeLessThanTest: function(file, path, searchTerm) {
        let props = file.getFileProperties();
        let size = this.getFileSize(props);
        if (size < searchTerm) {
            this.addMatch(props, path);
        }
    },
    fileSizeGreaterThanTest: function(file, path, searchTerm) {
        let props = file.getFileProperties();
        let size = this.getFileSize(props);
        if (size > searchTerm) {
            this.addMatch(props, path);
        }
    },
    mimeTypeTest: function(file, path, searchTerm) {
        let props = file.getFileProperties();
        let mimeType = props.mimeType;
        if (mimeType.startsWith(searchTerm)) {
            this.addMatch(props, path);
        }
    },
    extractDate: function(searchTerm) {
        if (searchTerm.length == 0) {
            this.isError = true;
            this.error = "Invalid date!";
            this.errorClass = "has-error has-feedback alert alert-danger";
            return;
        }
        let searchTermDate = new Date(Date.parse(searchTerm));
        let jsDate = new Date(searchTermDate.getFullYear(), searchTermDate.getMonth(), searchTermDate.getDate(),
            0, 0, 0, 0);
        return jsDate;
    },
    extractFileSize: function(searchTerm) {
        if (searchTerm.length == 0) {
            this.isError = true;
            this.error = "Missing file size!";
            this.errorClass = "has-error has-feedback alert alert-danger";
            return;
        }
        let num = parseInt(searchTerm);
        if (num.toString() == "NaN") {
            this.isError = true;
            this.error = "Invalid file size!";
            this.errorClass = "has-error has-feedback alert alert-danger";
            return;
        } else if (num < 0) {
            this.isError = true;
            this.error = "Negative file size!";
            this.errorClass = "has-error has-feedback alert alert-danger";
            return;
        }
        if (this.selectedSizeUnit == 'K')
            return Number(searchTerm) * 1024;
        if (this.selectedSizeUnit == 'M')
            return Number(searchTerm) * 1024 * 1024;
        if (this.selectedSizeUnit == 'G')
            return Number(searchTerm) * 1024 * 1024 * 1024;
    },
	search: function() {
	    this.showCancel = true;
            this.cancelSearch = false;
            this.isError = false;
            this.error = "";
            this.errorClass = "";

            var that = this;
            let path = this.path == '' ? '/' + this.context.username : this.path;
            this.matches = [];
            this.walkCounter = 0;
            let filterFunction = null;
	        let searchTerm = null;
            if(this.selectedSearchType == "contains") {
	            searchTerm = this.searchContains.trim().toLowerCase();
                if (searchTerm.length == 0) {
                    this.isError = true;
                    this.error = "Missing text!";
                    this.errorClass = "has-error has-feedback alert alert-danger";
                    return;
                }
                filterFunction = this.containsTest;
            } else if(this.selectedSearchType == "textContents") {
	            searchTerm = this.searchContains.trim().toLowerCase();
                if (searchTerm.length == 0) {
                    this.isError = true;
                    this.error = "Missing text!";
                    this.errorClass = "has-error has-feedback alert alert-danger";
                    return;
                }
                filterFunction = this.textFileContainsTest;
            } else if(this.selectedSearchType == "modifiedAfter") {
                filterFunction = this.modifiedAfterTest;
                searchTerm = this.extractDate(this.selectedDate.trim());
            } else if(this.selectedSearchType == "modifiedBefore") {
                filterFunction = this.modifiedBeforeTest;
                searchTerm = this.extractDate(this.selectedDate.trim());
            } else if(this.selectedSearchType == "createdAfter") {
                filterFunction = this.createdAfterTest;
                searchTerm = this.extractDate(this.selectedDate.trim());
            } else if(this.selectedSearchType == "createdBefore") {
                filterFunction = this.createdBeforeTest;
                searchTerm = this.extractDate(this.selectedDate.trim());
            } else if(this.selectedSearchType == "fileSizeGreaterThan") {
                filterFunction = this.fileSizeGreaterThanTest;
                searchTerm = this.extractFileSize(this.searchFileSize.trim());
            } else if(this.selectedSearchType == "fileSizeLessThan") {
                filterFunction = this.fileSizeLessThanTest;
                searchTerm = this.extractFileSize(this.searchFileSize.trim());
            } else if(this.selectedSearchType == "mimeType") {
                filterFunction = this.mimeTypeTest;
                searchTerm = this.selectedMimeType.trim();
            }
            if (searchTerm == null) {
                return;
            }
            this.context.getByPath(path).thenApply(function(dir){
                that.walk(dir.get(), path, searchTerm, filterFunction);
            }).exceptionally(function(throwable) {
                that.showSpinner = false;
                let searchButton = document.getElementById("submit-search");
                searchButton.disabled = false;
                throwable.printStackTrace();
            });

        },
        stopSearch: function () {
            this.cancelSearch = true;
	    this.showCancel = false;
        },
        view: function (event, entry) {
            if (entry.isDirectory) {
                this.close();
                this.navigateToAction(entry.path + "/" + entry.name);
            } else {
                this.viewAction(event, entry);
            }
        },
        viewAction: function (event, entry) {
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
                posy = Math.max(0, e.clientY - 150);
            }
            return {
                x: posx,
                y: posy
            }
        },
        navigateTo: function (entry) {
            this.close();
            this.navigateToAction(entry.path);
        },
        close: function () {
            this.$emit("hide-search");
        },
        setSortBy: function(prop) {
            if (this.sortBy == prop)
                this.normalSortOrder = !this.normalSortOrder;
            this.sortBy = prop;
        },
        formatDateTime: function(dateTime) {
            let date = new Date(dateTime.toString() + "+00:00");//adding UTC TZ in ISO_OFFSET_DATE_TIME ie 2021-12-03T10:25:30+00:00
            let formatted = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate()
                + ' ' + (date.getHours() < 10 ? '0' : '') + date.getHours()
                + ':' + (date.getMinutes() < 10 ? '0' : '') + date.getMinutes()
                + ':' + (date.getSeconds() < 10 ? '0' : '') + date.getSeconds();
            return formatted;
        }
    },
    computed:{
		...Vuex.mapState([
			'context',
            "sandboxedApps",
		]),
        sortedItems(){
            var sortBy = this.sortBy;
            var reverseOrder = ! this.normalSortOrder;
            if(sortBy == "name" || sortBy == "path") {
                return this.matches.sort(function (a, b) {
                    if (reverseOrder) {
                        return ('' + b.name).localeCompare(a.name);
                    } else {
                        return ('' + a.name).localeCompare(b.name);
                    }
                });
            } else if(this.sortBy == "modified") {
                return this.matches.sort(function (a, b) {
                    let aVal = a.lastModified;
                    let bVal = b.lastModified;
                    if (reverseOrder) {
                        return bVal.compareTo(aVal);
                    } else {
                        return aVal.compareTo(bVal);
                    }
                });
            } else if(this.sortBy == "created") {
                return this.matches.sort(function (a, b) {
                    let aVal = a.created;
                    let bVal = b.created;
                    if (reverseOrder) {
                        return bVal.compareTo(aVal);
                    } else {
                        return aVal.compareTo(bVal);
                    }
                });
            } else if(sortBy == "size") {
                return this.matches.sort(function (a, b) {
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
