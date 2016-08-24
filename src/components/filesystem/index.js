module.exports = {
    template: require('filesystem.html'),
    data: function() {
        return {
	    grid: true,
            path: [],
            files: [],
	    context: null
        };
    },
    props: {
    },
    created: function() {
        console.debug('Filesystem module created!');
        
        this.getFiles();
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

        getFiles: function() {
	    const that = this;
	    if (this.context == null)
		return;
	    this.context.getByPath(this.getPath()).then(
                function(dir) {
		    dir.getChildren(that.context).then(function(children){
			children.toArray().then(function(arr) {
			    var futures = [];
			    for (var i=0; i < arr.length; i++) {
				futures[i] = convertToJSFile(arr[i]);
			    }
			    Promise.all(futures).then(function(wrappedChildren) {
				that.files = wrappedChildren;
			    });
			});
		    });
                }
            );
        },

        changePath: function(path) {
            console.debug('Changing to path:'+ path);
	    if (path.startsWith("/"))
		path = path.substring(1);
            this.path = path ? path.split('/') : [];
            this.getFiles();
        },

	navigateToSubdir: function(name) {
	    this.changePath(this.getPath() + name);
	},

        getPath: function() {
            return '/'+this.path.join('/') + (this.path.length > 0 ? "/" : "");
        }
    },
    computed: {
        fullRepoUrl: function() {
            return this.username + '/' + this.repo;
        },
        sortedFiles: function() {
	    console.log(this.files);
            return this.files.slice(0).sort(function(a, b) {
                if (a.type !== b.type) {
                    if (a.type === 'dir') {
                        return -1;
                    } else {
                        return 1;
                    }
                } else {
                    if (a.name < b.name) {
                        return -1;
                    } else {
                        return 1;
                    }
                }
            });
        }
    },
    events: {
	'parent-msg': function (msg) {
	    // `this` in event callbacks are automatically bound
	    // to the instance that registered it
	    this.context = msg.context;
	    this.getFiles();
	}
    }
};
