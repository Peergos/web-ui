module.exports = {
    template: require('gallery.html'),
    data: function() {
        return {
	    showSpinner: false,
	    fileIndex: 0,
	    imageData: null
        };
    },
    props: ['show', 'files', 'context'],
    created: function() {
	console.debug('Gallery module created!');
	window.addEventListener('keyup', this.keyup)
	this.updateImageData();
    },

    watch: {
	files: function(newFiles) {
	    this.files = newFiles;
	    this.updateImageData();
	}
    },
    
    methods: {
	close: function() {
	    this.show = false;
	},

	keyup: function(e) {
	    if (e.keyCode == 37)
		this.previous();
	    else if (e.keyCode == 39)
		this.next();
	},
	
	start: function() {
	    this.fileIndex = 0;
	    this.updateImageData();
	},

	end: function() {
	    if (this.imageFiles == null || this.imageFiles.length == 0)
		this.fileIndex = 0;
	    else
		this.fileIndex = this.imageFiles.length - 1;
	    this.updateImageData();
	},

	next: function() {
	    if (this.imageFiles == null || this.imageFiles.length == 0)
		this.fileIndex = 0;
	    else if (this.fileIndex < this.imageFiles.length - 1)
		this.fileIndex++;
	    this.updateImageData();
	},

	previous: function() {
	    if (this.imageFiles == null || this.imageFiles.length == 0 || this.fileIndex == 0)
		this.fileIndex = 0;
	    else
		this.fileIndex--;
	    this.updateImageData();
	},

	updateImageData: function() {
	    var file = this.current;
	    if (file == null)
		return;
	    if (file.isDirectory())
		return;
	    console.log("downloading " + file.getFileProperties().name);
	    var props = file.getFileProperties();
	    var that = this;
	    var resultingSize = props.sizeLow();
	    this.showSpinner = true;
	    file.getInputStream(this.context, props.sizeHigh(), props.sizeLow(), function(read) {})
		.thenCompose(function(reader) {
		    var data = convertToByteArray(new Int8Array(props.sizeLow()));
		    data.length = props.sizeLow();
		    return reader.readIntoArray(data, 0, data.length)
			.thenApply(function(read){
			    that.imageData = data;
			    that.showSpinner = false;
			    console.log("Finished retrieving image of size " + data.length);
			});
		});
	}
    },
    computed: {
	current: function() {
	    if (this.imageFiles == null || this.imageFiles.length == 0)
		return null;
	    return this.imageFiles[this.fileIndex];
	},

	imageFiles: function() {
	    if (this.files == null)
		return null;
	    return this.files.filter(function(file){return file.getFileProperties().thumbnail.isPresent();});
	},
	
	imageURL: function() {
	    console.log("Getting image url");
	    if (this.imageData == null)
		return null;
	    var blob =  new Blob([this.imageData], {type: "octet/stream"});		
	    var imageUrl = window.URL.createObjectURL(blob);
	    console.log("Setting image url to " + imageUrl);
	    return imageUrl;
	}
    }
};
