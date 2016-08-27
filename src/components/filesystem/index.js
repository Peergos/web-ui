module.exports = {
    template: require('filesystem.html'),
    data: function() {
        return {
	    context: null,
            path: [],
	    grid: true,
	    sortBy: "name",
	    normalSortOrder: true,
	    forceUpdate:0
        };
    },
    props: {
    },
    created: function() {
        console.debug('Filesystem module created!');
        
    },
    methods: {
        goBackToLevel: function(level) {
            // By default let's jump to the root.
            var newLevel = level || 0,
                path = this.path.slice(0, newLevel).join('/');

            if (newLevel < this.path.length) {
                this.changePath(path);
            }
        },

	goHome: function() {
	    this.changePath("/" + this.username);
	},

	askMkdir: function() {
	    const newFolderName = prompt("Enter new folder name");
            if (newFolderName == null)
                return;
            
            console.log("creating new sub-dir "+ newFolderName);
            this.mkdir(newFolderName);
	},

	switchView: function() {
	    this.grid = !this.grid;
	},

	currentDirChanged: function() {
	    // force reload of computed properties
	    this.forceUpdate++;
	},

	mkdir: function(name) {
	    this.currentDir.props.java.mkdir(name, this.context.jcontext, false)
                .then(x => this.currentDirChanged());
	},

	askForFile: function() {
	    //TODO
	},

        uploadFile: function(name, fileStream, length, monitor) {
	    this.currentDir.props.java.uploadFile(name, fileStream, length, this.context.jcontext, monitor)
                .then(x => this.currentDirChanged());
	},

        showSocial: function(name) {
	    //TODO
	},

	setSortBy: function(prop) {
	    if (this.sortBy == prop)
		this.normalSortOrder = !this.normalSortOrder;
	    this.sortBy = prop;
	},

        changePath: function(path) {
            console.debug('Changing to path:'+ path);
	    if (path.startsWith("/"))
		path = path.substring(1);
            this.path = path ? path.split('/') : [];
        },

	navigateOrDownload: function(name) {
	    var files = this.files;
	    var file;
	    for (var i=0; i < files.length; i++)
		if (files[i].props.name == name)
		    file = files[i];
	    if (file.type == 'file') 
		this.downloadFile(file);
	    else
		this.navigateToSubdir(name);
	},

        navigateToSubdir: function(name) {
	    this.changePath(this.getPath() + name);
	},

        downloadFile: function(file) {
	    //TODO
	},

        getPath: function() {
            return '/'+this.path.join('/') + (this.path.length > 0 ? "/" : "");
        }
    },
    computed: {
        sortedFiles: function() {
	    if (this.files == null)
		return [];
	    var sortBy = this.sortBy;
	    var reverseOrder = ! this.normalSortOrder;
            return this.files.slice(0).sort(function(a, b) {
		var aVal, bVal;
		if (sortBy == null)
		    return 0;
		if (sortBy == "name") {
		    aVal = a.props.name;
		    bVal = b.props.name;
		} else if (sortBy == "size") {
		    aVal = a.props.size;
		    bVal = b.props.size;
		} else if (sortBy == "modified") {
		    aVal = a.props.modified;
		    bVal = b.props.modified;
		} else if (sortBy == "type") {
		    aVal = a.type;
		    bVal = b.type;
		} else
		    throw "Unknown sort type " + sortBy;
		    
                if (a.type !== b.type) {
                    if (a.type === 'dir') {
                        return reverseOrder ? 1 : -1;
                    } else {
                        return reverseOrder ? -1 : 1;
                    }
                } else {
                    if (aVal < bVal) {
                        return reverseOrder ? 1 : -1;
                    } else if (aVal == bVal) {
                        return 0;
                    } else {
                        return reverseOrder ? -1 : 1;
                    }
                }
            });
        },
	isWritable: function() {
	    if (this.currentDir == null)
		return false;
	    return this.currentDir.props.isWritable;
	}
    },
    asyncComputed: {
	currentDir: function() {
	    if (this.context == null)
		return Promise.resolve(null);
	    var x = this.forceUpdate;
	    return this.context.getByPath(this.getPath());
	},
	files: function() {
            var current = this.currentDir;
	    if (current == null)
		return Promise.resolve([]);
	    return current.getChildren(this.context).then(function(children){
		return children.toArray().then(function(arr) {
		    var futures = [];
		    for (var i=0; i < arr.length; i++) {
			futures[i] = convertToJSFile(arr[i]);
		    }
		    return Promise.all(futures).then(function(jsarr){
			return Promise.resolve(jsarr.filter(function(f){
			    return !f.props.isHidden;
			}));
		    });
		});
	    });
        },
	username: function() {
	    var context = this.context;
	    if (context == null)
		return Promise.resolve("");
	    return context.jcontext.username;
	}
    },
    events: {
	'parent-msg': function (msg) {
	    // `this` in event callbacks are automatically bound
	    // to the instance that registered it
	    this.context = msg.context;
	}
    }
};
