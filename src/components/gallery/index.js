module.exports = {
    template: require('gallery.html'),
    data: function() {
        return {
	    showSpinner: false,
	    fileIndex: 0
        };
    },
    props: ['show', 'files'],
    created: function() {
	console.debug('Gallery module created!');
    },
    
    methods: {
	close: function() {
	    this.show = false;
	},
	
	start: function() {
	    this.fileIndex = 0;
	},

	end: function() {
	    if (this.files == null || this.files.length == 0)
		this.fileIndex = 0;
	    else
		this.fileIndex = this.files.length - 1;
	},

	next: function() {
	    if (this.files == null || this.files.length == 0)
		this.fileIndex = 0;
	    else
		this.fileIndex++;
	},

	next: function() {
	    if (this.files == null || this.files.length == 0 || this.fileIndex == 0)
		this.fileIndex = 0;
	    else
		this.fileIndex--;
	},
    },
    computed: {
	current: function() {
	    if (this.files == null || this.files.length == 0)
		return null;
	    return this.files[this.fileIndex];
	},

	getImageURL: function(file) {
	    console.log("Getting image");
	}
    },
    asyncComputed: {
	network: function() {
	    return new Promise(function(resolve, reject) {
		peergos.shared.NetworkAccess.buildJS()
		    .thenApply(function(network){resolve(network)});
	    });
	}
    }
};
