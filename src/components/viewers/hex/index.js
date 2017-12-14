module.exports = {
    template: require('hex.html'),
    data: function() {
        return {
            showSpinner: false,
            fileData: null
        };
    },
    props: ['show', 'file', 'context'],
    created: function() {
        console.debug('Hex viewer created!');
        window.addEventListener('keyup', this.keyup)
        this.updateCurrentFileData();
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

        updateCurrentFileData: function() {
            if (this.file == null)
                return;
            if (this.file.isDirectory())
                return;
            var props = this.file.getFileProperties();
            var that = this;
            this.showSpinner = true;

            this.file.getInputStream(this.context.network, this.context.crypto.random, 
                    props.sizeHigh(), props.sizeLow(), 
                    function(read) {})
                .thenCompose(function(reader) {
                    var data = convertToByteArray(new Int8Array(props.sizeLow()));
                    data.length = props.sizeLow();
                    return reader.readIntoArray(data, 0, data.length)
                        .thenApply(function(read){
                            that.fileData = data;
                            that.showSpinner = false;
                            console.log("Finished retrieving media of size " + data.length);
                        });
                });
        },

	byteToHex: function(b) {
	    var lookup = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
	    return lookup[b & 0xf] + lookup[(b >> 4) & 0xf];
	}
    },
    computed: {
	lines: function() {
	    var data = this.fileData;
	    if (data == null)
		return [];
	    var res = [];
	    var size = data.length;
	    var nlines = ((size + 15)/16)|0;
	    for (var i=0; i < nlines; i++) {
		var hex = [];
		var ascii = [];
		for (var x = 0; x < 16 && 16*i + x < size; x++) {
		    hex[x] = this.byteToHex(data[16*i + x]);
		    ascii[x] = String.fromCharCode(data[16*i + x]);
		}
		res[i] = {hex:hex,ascii:ascii};
	    }
	    return res;
	}
    }
};
