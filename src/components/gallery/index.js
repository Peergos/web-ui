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
    props: ['files', 'context', 'initialFileName'],
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
	    this.updateCurrentFileData();
        }
    },

    methods: {
        close: function() {
            this.$emit("hide-gallery");
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
            if (file == null) {
		console.log("null file in gallery");
                return;
	    }
            if (file.isDirectory())
                return;
            var props = file.getFileProperties();
            var that = this;
            this.showSpinner = true;
            var isLargeAudioFile = that.isAudio(file) && that.getFileSize(props) > 1024 * 1024 * 5;
            if(that.supportsStreaming() && ( that.isVideo(file) || isLargeAudioFile )) {
                var size = props.sizeLow();
                function Context(isCaptureFile, network, crypto, sizeHigh, sizeLow) {
                    this.maxBlockSize = 1024 * 1024 * 5;
                    this.writer = null;
                    this.network = network;
                    this.crypto = crypto;
                    this.sizeHigh = sizeHigh,
                    this.sizeLow = sizeLow;
                    this.counter = 0;
                    this.file = file;
                    this.isCaptureFile = isCaptureFile;
                    this.stream = function(file, seekHi, seekLo, length, sizeHigh, sizeLow) {
                        this.file = file;
                        this.sizeHigh = sizeHigh;
                        this.sizeLow = sizeLow;
                        this.counter++;
                        var work = function(thatRef, currentCount) {
                            var currentSize = length;
                            var blockSize = currentSize > this.maxBlockSize ? this.maxBlockSize : currentSize;
                            var pump = function(reader) {
                                if(blockSize > 0 && thatRef.counter == currentCount) {
                                    var data = convertToByteArray(new Uint8Array(blockSize));
                                    data.length = blockSize;
                                    return reader.readIntoArray(data, 0, blockSize).thenApply(function(read){

                                           //currentSize = currentSize - read;
                                           //blockSize = currentSize > thatRef.maxBlockSize ? thatRef.maxBlockSize : currentSize;
                                           //thatRef.writer.write(data);


                                            currentSize = currentSize - read;
                                            blockSize = currentSize > thatRef.maxBlockSize ? thatRef.maxBlockSize : currentSize;
                                            let chunk = new Uint8Array(4 + data.byteLength);
                                            let dataView = new DataView(chunk.buffer);
                                            dataView.setInt32(0, thatRef.sizeLow);
                                            chunk.set(data, 4);

                                            let fileSizeBytes = chunk.subarray(0, 4);
                                            let dataView2 = new DataView(fileSizeBytes.buffer);
                                            let fileSizeInt = dataView2.getInt32(0);
                                           thatRef.writer.write(chunk);

                                           return pump(reader);
                                    });
                                } else {
                                    var future = peergos.shared.util.Futures.incomplete();
                                    future.complete(true);
                                    return future;
                                }
                            }
                            file.getInputStream(network, crypto, sizeHigh, sizeLow, function(read) {}).thenCompose(function(reader) {
                                return reader.seekJS(seekHi, seekLo).thenApply(function(seekReader){
                                    return pump(seekReader);
                                })
                            });
                        }
                        var empty = convertToByteArray(new Uint8Array(0));
                        this.writer.write(empty);
                        return work(this, this.counter);
                    }
                }
                let isCaptureFile = this.isCaptureFile(props);
                let identifier = isCaptureFile ? props.name : "media-" + props.name;
                var context = new Context(isCaptureFile, this.context.network, this.context.crypto, props.sizeHigh(), props.sizeLow());
                console.log("streaming data of length " + size);
                let fileStream = streamSaver.createWriteStream(identifier, props.mimeType, function(url){
                    that.videoUrl = url;
                    that.showSpinner = false;
                }, function(seekHi, seekLo, seekLength){
                    if(context.isCaptureFile) {
                        let loop = function(counter) {
                            file.getLatest(context.network).thenApply(function(updatedFile){
                                var updatedProps = updatedFile.getFileProperties();
                                if (counter < 10) {
                                    if(seekLo + seekLength < updatedProps.sizeLow()) {
                                        context.stream(updatedFile, seekHi, seekLo, seekLength, props.sizeHigh(), props.sizeLow());
                                    }else if(props.sizeLow() == updatedProps.sizeLow() && seekLo == updatedProps.sizeLow()) {
                                        setTimeout(function(){loop(++counter);}, 1000);
                                    } else {
                                        let updatedSeekLength = Math.min(updatedProps.sizeLow() - seekLo, context.maxBlockSize);
                                        context.stream(updatedFile, seekHi, seekLo, updatedSeekLength, updatedProps.sizeHigh(), updatedProps.sizeLow());
                                    }
                                }
                            });
                        };
                        loop(1);
                    } else {
                        context.stream(file, seekHi, seekLo, seekLength, props.sizeHigh(), props.sizeLow());
                    }
                }, undefined, size)
                context.writer = fileStream.getWriter();
            } else {
                file.getInputStream(this.context.network, this.context.crypto,
                        props.sizeHigh(), props.sizeLow(),
                        function(read) {})
                    .thenCompose(function(reader) {
                        var size = that.getFileSize(props);
                        var data = convertToByteArray(new Int8Array(size));
                        return reader.readIntoArray(data, 0, data.length)
                            .thenApply(function(read){
                                that.imageData = data;
                                that.showSpinner = false;
                                console.log("Finished retrieving media of size " + data.length);
                            });
                    });
            }
        },
        isCaptureFile: function(props) {
            if(props.name.startsWith("capture-") && props.name.endsWith(".mov")
                && props.name.charAt(12) == '-'
                && props.name.charAt(15) == '-'
                && props.name.charAt(18) == 'T'
                && props.name.charAt(21) == '.'
                && props.name.charAt(24) == '.') {
                    return true;
            }
            return false;
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
