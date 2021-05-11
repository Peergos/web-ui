module.exports = {
    template: require('pdf.html'),
    data: function() {
        return {
            showSpinner: false,
        }
    },
    props: ['context', 'file'],
    created: function() {
        this.startListener();
    },
    methods: {
	frameUrl: function() {
            return this.frameDomain() + "/apps/pdf/index.html";
        },
        frameDomain: function() {
            return window.location.protocol + "//pdf." + window.location.host;
        },
        startListener: function() {
	    var iframe = document.getElementById("pdf");
	    if (iframe == null) {
		setTimeout(this.startListener, 500);
		return;
	    }
	    // Listen for response messages from the frames.
	    window.addEventListener('message', function (e) {
		// Normally, you should verify that the origin of the message's sender
		// was the origin and source you expected. This is easily done for the
		// unsandboxed frame. The sandboxed frame, on the other hand is more
		// difficult. Sandboxed iframes which lack the 'allow-same-origin'
		// header have "null" rather than a valid origin. This means you still
		// have to be careful about accepting data via the messaging API you
		// create. Check that source, and validate those inputs!
		if ((e.origin === "null" || e.origin === that.frameDomain()) && e.source === iframe.contentWindow) {
		    console.log('Message from Iframe: ' + e.data);
		}
	    });
	    // Note that we're sending the message to "*", rather than some specific
            // origin. Sandboxed iframes which lack the 'allow-same-origin' header
            // don't have an origin which you can target: you'll have to send to any
            // origin, which might alow some esoteric attacks. Validate your output!
	    const props = this.file.getFileProperties();
	    const name = this.file.getName();
	    var that = this;
	    this.file.getInputStream(this.context.network, this.context.crypto, props.sizeHigh(), props.sizeLow(), function(read){}).thenCompose(function(reader) {
		var size = that.getFileSize(props);
		var data = convertToByteArray(new Int8Array(size));
		return reader.readIntoArray(data, 0, data.length)
		    .thenApply(function(read){
			iframe.contentWindow.postMessage({name:name,bytes:data}, '*');
		    });
	    });
	},

        close: function () {
            this.$emit("hide-pdf-viewer");
        }
    },
}
