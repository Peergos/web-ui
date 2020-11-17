module.exports = {
    template: require('search.html'),
    data: function() {
        return {
            searchFilenameContains: "",
            showSpinner: false,
            walkCounter: 0,
            matches: [],
            selectedSearchType: "contains",
            searchFileSizeLessThanMB : "",
            searchFileSizeGreaterThanMB : "",
            searchFileModifiedBefore: "",
            searchFileModifiedAfter: "",
        }
    },
    props: ['path', 'context', 'navigateToAction', 'viewAction'],
    created: function() {
    },
    methods: {

	walk: function(file, path, searchTerm, searchTest) {
        let fileProperties = file.getFileProperties();
        if (fileProperties.isHidden)
            return;
        let that = this;
        if (fileProperties.isDirectory) {
            file.getChildren(this.context.crypto.hasher, this.context.network).thenCompose(function(children) {
            	that.walkCounter++;
                if (that.walkCounter == 1) {
                    that.showSpinner = true;
                }
                let arr = children.toArray();
                let size = arr.length;
                arr.forEach(function(child, index){
                    let newPath = child.getFileProperties().isDirectory ? path + "/" + child.getFileProperties().name : path;
                    that.walk(child, newPath, searchTerm, searchTest);
                    if (index == size - 1) {
                        that.walkCounter--;
                        if (that.walkCounter == 0) {
                            that.showSpinner = false;
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
        if (jsDate.getTime() > searchTerm.getTime()) {
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
    extractDate: function(searchTerm) {
        if (searchTerm.length == 0) {
                return;
        }
        return new Date(Date.parse(searchTerm));
    },
    extractFileSizeInMB: function(searchTerm) {
        if (searchTerm.length == 0) {
                return;
        }
        return Number(searchTerm) * 1000;
    },
	search: function() {

            var that = this;
            console.log("searching");
            that.showSpinner = true;
            let path = this.path;
            this.matches = [];
            this.walkCounter = 0;
            let filterFunction = null;
	        let searchTerm = null;
            if(this.selectedSearchType == "contains") {
	            searchTerm = this.searchFilenameContains.trim().toLowerCase();
                if (searchTerm.length == 0) {
                    return;
                }
                filterFunction = this.containsTest;
            } else if(this.selectedSearchType == "modifiedAfter") {
                filterFunction = this.modifiedAfterTest;
                searchTerm = this.extractDate(this.searchFileModifiedAfter.trim());
            } else if(this.selectedSearchType == "modifiedBefore") {
                filterFunction = this.modifiedBeforeTest;
                searchTerm = this.extractDate(this.searchFileModifiedBefore.trim());
            } else if(this.selectedSearchType == "fileSizeGreaterThanMB") {
                filterFunction = this.fileSizeGreaterThanTest;
                searchTerm = this.extractFileSizeInMB(this.searchFileSizeGreaterThanMB.trim());
            } else if(this.selectedSearchType == "fileSizeLessThanMB") {
                filterFunction = this.fileSizeLessThanTest;
                searchTerm = this.extractFileSizeInMB(this.searchFileSizeLessThanMB.trim());
            }
            this.context.getByPath(path).thenApply(function(dir){
                that.walk(dir.get(), path, searchTerm, filterFunction);
            }).exceptionally(function(throwable) {
                that.showSpinner = false;
                throwable.printStackTrace();
            });

        },
        view: function (entry) {
            this.viewAction(entry.path, entry.name);
        },
        navigateTo: function (entry, includeFile) {
            this.close();
            this.navigateToAction(entry.path);
        },
        close: function () {
            this.$emit("hide-search");
        }
    },
    computed:{
        sortedItems(){
            if(this.selectedSearchType == "contains") {
                return this.matches.sort(function (a, b) { return ('' + a.name).localeCompare(b.name);});
            } else if(this.selectedSearchType == "modifiedAfter" || this.selectedSearchType == "modifiedBefore") {
                return this.matches.sort(function (a, b) {
                    let aVal = a.lastModified;
                    let bVal = b.lastModified;
                    return bVal.compareTo(aVal);
                });
            } else if(this.selectedSearchType == "fileSizeGreaterThanMB" || this.selectedSearchType == "fileSizeLessThanMB") {
                return this.matches.sort(function (a, b) {
                    let aVal = a.size;
                    let bVal = b.size;
                    if (aVal > bVal) {
                        return -1;
                    } else if (aVal == bVal) {
                        return 0;
                    } else {
                        return 1;
                    }
                });
            }
        }
    }
}
