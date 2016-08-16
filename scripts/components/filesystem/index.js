module.exports = {
    template: require('../../../views/filesystem.html'),
    data: function() {
        return {
	    grid: true,
            path: [],
            files: []
        };
    },
    props: {
        username: {
            type: String
        },
        repo: {
            type: String
        }
    },
    created: function() {
        console.debug('Filesystem module created!');
        // Is the user logged in?
        if (!this.username || !this.repo) {
            this.username = 'Peergos';
            this.repo = 'Peergos';
        }
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
	    window.context.getByPath(this.getPath()).then(
                function(dir) {
		    dir.getChildren().then(function(children){
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
            this.path = path? path.split('/') : [];
            this.getFiles();
        },

        getPath: function() {
            return '/'+this.path.join('/');
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
    }
};
