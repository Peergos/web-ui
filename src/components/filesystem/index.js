module.exports = {
    template: require('filesystem.html'),
    data: function() {
        return {
	    context: null,
            path: [],
	    grid: true,
	    sortBy: "name",
	    normalSortOrder: true,
	    clipboard:{},
	    url:null,
	    viewMenu:false,
	    top:"0px",
	    left:"0px",
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
	    this.currentDir.mkdir(name, this.context, false)
                .thenApply(x => this.currentDirChanged());
	},

	askForFile: function() {
	    console.log("ask for file");
	    document.getElementById('uploadInput').click();
	},

        uploadFiles: function(evt) {
	    console.log("upload files");
	    var files = evt.target.files || evt.dataTransfer.files;
            //for(var j = 0; j < files.length; j++) {
            //    uploadFragmentTotal = uploadFragmentTotal + 60 * Math.ceil(files[j].size/Chunk.MAX_SIZE);
            //}
            for (var i = 0; i < files.length; i++) {
                var file = files[i];
		console.log("uploading " + name);
		var reader = new browserio.JSFileReader(file);
		var java_reader = new peergos.shared.user.fs.BrowserFileReader(reader);
		this.currentDir.uploadFile(file.name, java_reader, 0, file.size, this.context, l => {})
                    .thenApply(x => this.currentDirChanged());
	    }
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

	navigateOrDownload: function(file) {
	    if (file.isDirectory())
		this.navigateToSubdir(file.getFileProperties().name);
	    else
		this.downloadFile(file);
	},

        navigateToSubdir: function(name) {
	    this.changePath(this.getPath() + name);
	},

        downloadFile: function(file) {
	    console.log("downloading " + file.getFileProperties().name);
	    var props = file.getFileProperties();
	    var that = this;
	    file.getInputStream(this.context, props.sizeHigh(), props.sizeLow(), read => {})
		.thenCompose(reader => {
		    var data = peergos.shared.util.Serialize.newByteArray(props.sizeLow());
		    return reader.readIntoArray(data, 0, data.length)
			.thenApply(read => that.openItem(props.name, data));
		});
	},

	openItem: function(name, data) {
	    console.log("saving data of length " + data.length + " to " + name);
	    if(this.url != null){
		window.URL.revokeObjectURL(this.url);
	    }
	    
	    var blob =  new Blob([new Uint8Array(data)], {type: "octet/stream"});		
	    this.url = window.URL.createObjectURL(blob);
	    var link = document.getElementById("downloadAnchor");
	    link.href = this.url;
	    link.download = name;
	    link.click();
	},
	
        getPath: function() {
            return '/'+this.path.join('/') + (this.path.length > 0 ? "/" : "");
        },

	dragStart: function(ev, treeNode) {
	    console.log("dragstart");
	    
	    ev.dataTransfer.effectAllowed='move';
            var id = ev.target.id;
            ev.dataTransfer.setData("text/plain", id);
            var owner = treeNode.getOwner();
            var me = this.username;
            if (owner === me) {
		console.log("cut");
                this.clipboard = {
		    parent: this.currentDir,
                    fileTreeNode: treeNode,
                    op: "cut"
                };
            } else {
		console.log("copy");
                ev.dataTransfer.effectAllowed='copy';
                this.clipboard = {
                    fileTreeNode: treeNode,
                    op: "copy"
                };
            }
	},

	// DragEvent, FileTreeNode => boolean
	drop: function(ev, target) {
	    console.log("drop");
	    ev.preventDefault();
            var moveId = ev.dataTransfer.getData("text");
            var id = ev.target.id;
	    var that = this;
            if(id != moveId && target.isDirectory()) {
                const clipboard = this.clipboard;
                if (typeof(clipboard) ==  undefined || typeof(clipboard.op) == "undefined")
                    return;
                if (clipboard.op == "cut") {
		    console.log("drop-cut "+clipboard.fileTreeNode.getFileProperties().name + " -> "+target.getFileProperties().name);
                    clipboard.fileTreeNode.copyTo(target, this.context).thenCompose(function() {
                        return clipboard.fileTreeNode.remove(that.context, clipboard.parent);
                    }).thenApply(function() {
                        that.forceUpdate++;
                    });
                } else if (clipboard.op == "copy") {
		    console.log("drop-copy");
                    clipboard.fileTreeNode.copyTo(target, this.context);
		}
            }
	},

	openMenu: function(e, file) {
	    console.log("right clicked: " + file.getFileProperties().name);
	    this.viewMenu = true;

            Vue.nextTick(function() {
                document.getElementById("right-click-menu").focus();
                this.setMenu(e.y, e.x)
            }.bind(this));
            e.preventDefault();
	},

	setMenu: function(top, left) {
	    console.log("open menu");
	    var menu = document.getElementById("right-click-menu");
	    var largestHeight = window.innerHeight - menu.offsetHeight - 25;
            var largestWidth = window.innerWidth - menu.offsetWidth - 25;

            if (top > largestHeight) top = largestHeight;

            if (left > largestWidth) left = largestWidth;

            this.top = top + 'px';
            this.left = left + 'px';
	},
	
	closeMenu: function() {
	    this.viewMenu = false;
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
		    aVal = a.getFileProperties().name;
		    bVal = b.getFileProperties().name;
		} else if (sortBy == "size") {
		    aVal = a.getFileProperties().sizeLow();
		    bVal = b.getFileProperties().sizeLow();
		} else if (sortBy == "modified") {
		    aVal = a.getFileProperties().modified;
		    bVal = b.getFileProperties().modified;
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
	    return this.currentDir.isWritable();
	}
    },
    asyncComputed: {
	currentDir: function() {
	    if (this.context == null)
		return Promise.resolve(null);
	    var x = this.forceUpdate;
	    var that = this;
	    return new Promise(function(resolve, reject) {
		that.context.getByPath(that.getPath()).thenApply(file => resolve(file.get()));
	    });
	},
	files: function() {
            var current = this.currentDir;
	    if (current == null)
		return Promise.resolve([]);
	    var that = this;
	    return new Promise(function(resolve, reject) {
		current.getChildren(that.context).thenApply(function(children){
		    var arr = children.toArray();
		    resolve(arr.filter(function(f){
			return !f.getFileProperties().isHidden;
		    }));
		});
	    });
        },
	username: function() {
	    var context = this.context;
	    if (context == null)
		return Promise.resolve("");
	    return Promise.resolve(context.username);
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
