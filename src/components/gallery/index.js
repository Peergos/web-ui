module.exports = {
    template: require('gallery.html'),
    data: function() {
        return {
            showSpinner: false,
            fileIndex: 0,
            imageData: null,
            videoUrl: null
        };
    },
    props: ['show', 'files', 'context', 'initialFileName'],
    created: function() {
        console.debug('Gallery module created!');
	var showable = this.showableFiles;
	for (var i=0; i < showable.length; i++)
	    if (showable[i].getFileProperties().name == this.initialFileName)
		this.fileIndex = i;
	console.log("Set initial gallery index to " + this.fileIndex);
        window.addEventListener('keyup', this.keyup)
            this.updateCurrentFileData();
    },

    watch: {
        files: function(newFiles) {
            this.files = newFiles;
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
            this.updateCurrentFileData();
        },

        end: function() {
            if (this.showableFiles == null || this.showableFiles.length == 0)
                this.fileIndex = 0;
            else
                this.fileIndex = this.showableFiles.length - 1;
            this.updateCurrentFileData();
        },

        next: function() {
            if (this.showableFiles == null || this.showableFiles.length == 0)
                this.fileIndex = 0;
            else if (this.fileIndex < this.showableFiles.length - 1)
                this.fileIndex++;
            this.updateCurrentFileData();
        },

        previous: function() {
            if (this.showableFiles == null || this.showableFiles.length == 0 || this.fileIndex == 0)
                this.fileIndex = 0;
            else
                this.fileIndex--;
            this.updateCurrentFileData();
        },

        updateCurrentFileData: function() {
            var file = this.current;
            if (file == null)
                return;
            if (file.isDirectory())
                return;
            var props = file.getFileProperties();
            var that = this;
            this.showSpinner = true;
            if(that.supportsStreaming()) {
                
                file.getInputStream(this.context.network, this.context.crypto.random, props.sizeHigh(), props.sizeLow(), function(read) {}).thenCompose(function(reader) {
                                                   
                var size = props.sizeLow();
                var maxBlockSize = 1024 * 1024;
                var blockSize = size > maxBlockSize ? maxBlockSize : size;
                
                console.log("streaming data of length " + size);
                let fileStream = streamSaver.createWriteStream("media-" + props.name, function(url){
                    that.videoUrl = url;
                    that.showSpinner = false;
                })
                let writer = fileStream.getWriter()
                let pump = () => {
                    if(blockSize == 0) {
                        writer.close()
                    } else {
                        var data = convertToByteArray(new Uint8Array(blockSize));
                        data.length = blockSize;
                        reader.readIntoArray(data, 0, blockSize)
                        .thenApply(function(read){
                                   size = size - read;
                                   blockSize = size > maxBlockSize ? maxBlockSize : size;
                                   writer.write(data).then(()=>{setTimeout(pump)})
                                   });
                    }
                }
                pump()
                });
            } else {
            file.getInputStream(this.context.network, this.context.crypto.random, 
                    props.sizeHigh(), props.sizeLow(), 
                    function(read) {})
                .thenCompose(function(reader) {
                    var data = convertToByteArray(new Int8Array(props.sizeLow()));
                    data.length = props.sizeLow();
                    return reader.readIntoArray(data, 0, data.length)
                        .thenApply(function(read){
                            that.imageData = data;
                            that.showSpinner = false;
                            console.log("Finished retrieving media of size " + data.length);
                        });
                });
            }
        },
        supportsStreaming: function() {
            try {
                return 'serviceWorker' in navigator && !!new ReadableStream() && !!new WritableStream()
            } catch(err) {
                return false;
            }
        },
        isImage: function(file) {
            if (file == null)
                return false;
            var mimeType = file.getFileProperties().mimeType;
            return mimeType.startsWith("image");
        },
        isVideo: function(file) {
            if (file == null)
                return false;
            var mimeType = file.getFileProperties().mimeType;
            return mimeType.startsWith("video");
        },
        isAudio: function(file) {
            if (file == null)
                return false;
            var mimeType = file.getFileProperties().mimeType;
            return mimeType.startsWith("audio");
        }
    },
    computed: {

        current: function() {
            if (this.showableFiles == null || this.showableFiles.length == 0)
                return null;
            var file =  this.showableFiles[this.fileIndex];
            return file;
        },
        dataURL: function() {
            console.log("Getting data url");
            
            if (this.videoUrl != null) {
                var url = this.videoUrl;
                this.videoUrl = null;
                return url;
            }
            if (this.imageData == null) {
                console.log("No URL for null imageData");
                return null;
            }
            var blob =  new Blob([this.imageData], {type: "octet/stream"});		
            var dataURL = window.URL.createObjectURL(blob);
            console.log("Setting data url to " + dataURL);
            return dataURL;
        },
        currentIsVideo: function() {
            return this.isVideo(this.current);
        },
        currentIsImage: function() {
            return this.isImage(this.current);
        },
        currentIsAudio: function() {
            return this.isAudio(this.current);
        },
	currentIsVideoOrAudio: function() {
	    return this.isVideo(this.current) || this.isAudio(this.current);
	},
        showableFiles: function() {
            if (this.files == null)
                return null;
            var that = this; 
            return this.files.filter(function(file) {
                var is_image = that.isImage(file);
                var is_video = that.isVideo(file);
                var is_audio = that.isAudio(file); 
                console.log("is_image "+ is_image+ ", is_video "+ is_video +", is_audio " + is_audio);
                return is_image || is_video || is_audio; 
            });
        }
    }
};
