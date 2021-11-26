<template>
<transition name="modal">
<div class="modal-mask" @click="close"> 
    <div class="modal-container search full-height" @click.stop style="overflow-y:auto">
      <span @click="close" tabindex="0" v-on:keyup.enter="close" aria-label="close" class="close">&times;</span>
        <div class="modal-header">
            <h2>Search</h2>
        </div>
        <div class="modal-body">
            <div v-bind:class="errorClass">
                <label v-if="isError">{{ error }}</label>
            </div>
            <spinner v-if="showSpinner"></spinner>
                <div class="flex-container">
                    <div class="flex-item search" style="margin: 10px;">
                        <select v-model="selectedSearchType">
                            <option value="contains">Filename contains</option>
                            <option value="modifiedAfter">File modified after</option>
                            <option value="modifiedBefore">File modified before</option>
                            <option value="createdAfter">File created after</option>
                            <option value="createdBefore">File created before</option>
                            <option value="fileSizeGreaterThan">File size greater than</option>
                            <option value="fileSizeLessThan">File size less than</option>
                            <option value="mimeType">File type</option>
                        </select>
                    </div>
                    <div class="flex-item" v-if="selectedSearchType=='modifiedAfter' || selectedSearchType=='modifiedBefore' || selectedSearchType=='createdAfter' || selectedSearchType=='createdBefore'" style="margin: 10px;">
                        <input v-model="selectedDate" type="date" min="1900-01-01" max="3000-01-01" maxlength="12" ></input>
                    </div>
                    <div class="flex-item" v-if="selectedSearchType=='contains'" style="margin: 10px;">
                        <input v-focus v-if="selectedSearchType=='contains'" v-on:keyup.enter="search" v-model="searchFilenameContains" placeholder=""type="text" maxlength="60" style="width: 200px;" ></input>
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
                            <option value="audio">Audio</option>
                            <option value="image">Image</option>
                            <option value="application/pdf">PDF</option>
                            <option value="text/plain">Text</option>
                            <option value="video">Video</option>
                        </select>
                    </div>
                    <div class="flex-item" style="margin: 10px;">
                        <button id='submit-search' class="btn btn-success" @click="search()">Search</button>
                    </div>
                </div>
            </div>

            <div>
                <h3>Results: {{ matches.length }}</h3>
                <div v-if="showCancel" style="margin: 10px;">
                    <button class="btn btn-danger" @click="stopSearch()">Cancel Search</button>
                </div>
                <div v-if="matches!=0" class="table-responsive">
                    <table class="table">
                        <thead>
                        <tr  v-if="matches!=0" style="cursor:pointer;">
                            <th @click="setSortBy('name')">Name <span v-if="sortBy=='name'" v-bind:class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setSortBy('path')">Directory <span v-if="sortBy=='path'" v-bind:class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setSortBy('size')">Size <span v-if="sortBy=='size'" v-bind:class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setSortBy('modified')">Modified <span v-if="sortBy=='modified'" v-bind:class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>

                        </tr>
                        </thead>
                        <tbody>
                        <tr v-for="match in sortedItems">
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
    </div>
</div>
</transition>
</template>

<script>
module.exports = {
    data: function() {
        return {
            searchFilenameContains: "",
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
	    showCancel: false
        }
    },
    props: ['path', 'context', 'navigateToAction', 'viewAction'],
    created: function() {
        this.selectedDate = new Date().toISOString().split('T')[0];
    },
    methods: {
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
            let path = this.path;
            this.matches = [];
            this.walkCounter = 0;
            let filterFunction = null;
	        let searchTerm = null;
            if(this.selectedSearchType == "contains") {
	            searchTerm = this.searchFilenameContains.trim().toLowerCase();
                if (searchTerm.length == 0) {
                    this.isError = true;
                    this.error = "Missing text!";
                    this.errorClass = "has-error has-feedback alert alert-danger";
                    return;
                }
                filterFunction = this.containsTest;
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
        view: function (entry) {
            if (entry.isDirectory) {
                this.close();
                this.navigateToAction(entry.path + "/" + entry.name);
            } else {
                this.viewAction(entry.path, entry.name);
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
