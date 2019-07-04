module.exports = {
    template: require('hex.html'),
    data: function() {
        return {
            showSpinner: false,
            fileData: { // immutable
                data: null, // a 5 MiB chunk or less
                offsetHigh: 0,
                offsetLow: 0 // must be multiple of 16
            },
            offsetLow: 0, // must be multiple of 16
            offsetHigh:0,
            maxOffsetLow: 0,
            bytesPerPage: 16 * 32,
            errorTitle:'',
            errorBody:'',
            showError:false
        };
    },
    props: ['file', 'context'],
    created: function() {
        console.debug('Hex viewer created!');
        window.addEventListener('keyup', this.keyup);
        this.updateCurrentFileData();
    },

    methods: {
        getContext: function() {
            return this.context;
        },
        downloadCurrentFile: function() {
            this.downloadFile(this.file);
        },
        close: function() {
            this.$emit("hide-hex-viewer");
        },

        keyup: function(e) {
            if (e.keyCode == 38) // up arrow
                this.addToOffset(-16);
            else if (e.keyCode == 40)  // down arrow
                this.addToOffset(16);
	    else if (e.keyCode == 33)  // page-up
                this.addToOffset(-16 * 32);
	    else if (e.keyCode == 34) // page-down
                this.addToOffset(16 * 32);
	    else if (e.keyCode == 36) // home
                this.addToOffset(-this.offsetLow);
	    else if (e.keyCode == 35) // end
                this.addToOffset(this.maxOffsetLow-this.offsetLow);
        },

        updateCurrentFileData: function() {
            if (this.file == null)
                return;
            if (this.file.isDirectory())
                return;
            var props = this.file.getFileProperties();
            var that = this;
            this.showSpinner = true;
            var section = this.fileData;
            var seekOffset = this.offsetLow - (this.offsetLow % (5*1024*1024));
            var requestedOffset = this.offsetLow;
            this.maxOffsetLow = props.sizeLow() - (props.sizeLow() % this.bytesPerPage);
            this.file.getInputStream(this.context.network, this.context.crypto.random, 
                props.sizeHigh(), props.sizeLow(), 
                function(read) {})
                .thenCompose(function(startReader) {
                    return startReader
                        .seekJS(section.offsetHigh, seekOffset).thenCompose(function(reader) {

                            var sizeToRead = Math.min(5*1024*1024, props.sizeLow() - seekOffset);
                            var data = convertToByteArray(new Int8Array(sizeToRead));
                            data.length = sizeToRead;
                            return reader.readIntoArray(data, 0, data.length)
                                .thenApply(function(read){
                                    that.fileData = {data:data, offsetHigh: section.offsetHigh, offsetLow: requestedOffset};
                                    that.showSpinner = false;
                                    console.log("Finished retrieving file section of size " + data.length + " from offset " + requestedOffset);
                                });
                        });
                });
        },

        addToOffset: function(diff) {
            if (this.offsetLow + diff < 0) {
                this.offSetLow = 0;
                return;
            }
            var CHUNK = 5*1024*1024;
            var oldLow = this.offsetLow;
            var newLow = this.offsetLow + diff;
            var oldChunk = (oldLow / CHUNK)|0;
            var newChunk = (newLow / CHUNK)|0;
            if (oldChunk != newChunk) {
                // need to retrieve the next chunk
                this.offsetLow = newLow;
                this.updateCurrentFileData();
            } else {
                // can just update pointer
                var existing = this.fileData;
                this.fileData = {data: existing.data, offsetLow: newLow, offsetHigh: existing.offsetHigh};
                this.offsetLow = newLow;
            }
        },

        byteToHex: function(b) {
            var lookup = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
            return  lookup[(b >> 4) & 0xf] + lookup[b & 0xf];
        },

        intToHex: function(i) {
            return this.byteToHex(i >> 24) + this.byteToHex(i >> 16) + this.byteToHex(i >> 8) + this.byteToHex(i);
        }
    },
    computed: {
        lines: function() {
            var section = this.fileData;
            var data = section.data;
            if (data == null)
                return [];

            var res = [];
            var size = data.length;
            var dataOffset = section.offsetLow % (5 * 1024 * 1024);
            var maxlines = ((size - dataOffset + 15)/16)|0;
            var nlines = Math.min(maxlines, this.bytesPerPage / 16);

            for (var i=0; i < nlines; i++) {
                var hex = [];
                var ascii = [];
                for (var x = 0; x < 16 && dataOffset + 16*i + x < size; x++) {
                    hex[x] = this.byteToHex(data[dataOffset + 16*i + x]);
                    ascii[x] = String.fromCharCode(data[dataOffset + 16*i + x]);
                }
                res[i] = {hex:hex, ascii:ascii, start:this.intToHex(i*16 + section.offsetLow)};
            }
            return res;
        }
    }
};
