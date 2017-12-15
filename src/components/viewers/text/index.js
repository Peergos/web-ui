module.exports = {
    template: require('text.html'),
    data: function() {
        return {
            showSpinner: false,
            fileData: null
        };
    },
    props: ['show', 'file', 'context'],
    created: function() {
        console.debug('Text viewer created!');
        this.updateCurrentFileData();
    },

    methods: {
        close: function() {
            this.show = false;
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

	bytesToString: function(arr, start, end) {
	    if (end - start > 64*1024)
		throw "Can't convert array longer than 64k to string!";
	    return String.fromCharCode.apply(null, arr.slice(start, end));
	}
    },
    computed: {
	text: function() {
	    var data = this.fileData;
	    if (data == null)
		return [];
	    var res = "";
	    for (var i=0; i < data.length; i += 64*1024)
		res += this.bytesToString(data, i, Math.min(i + 64*1024, data.length))
	    return res;
	}
    }
};
