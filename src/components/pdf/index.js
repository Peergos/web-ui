module.exports = {
    template: require('pdf.html'),
    data: function() {
        return {
            showSpinner: false,
            isIframeInitialised: false
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
        var that = this;
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
            if (e.data.action == 'pong') {
                that.isIframeInitialised = true;
            } else if (e.data == "sw-registration-failure" ) {
                console.log("failed to register service worker for PDF viewer")
                } else {
    		    console.log('Message from Iframe: ' + e.data);
            }
		}
	    });
	    // Note that we're sending the message to "*", rather than some specific
            // origin. Sandboxed iframes which lack the 'allow-same-origin' header
            // don't have an origin which you can target: you'll have to send to any
            // origin, which might alow some esoteric attacks. Validate your output!
	    const props = this.file.getFileProperties();
	    const name = this.file.getName();
	    this.file.getInputStream(this.context.network, this.context.crypto, props.sizeHigh(), props.sizeLow(), function(read){}).thenCompose(function(reader) {
		var size = that.getFileSize(props);
		var data = convertToByteArray(new Int8Array(size));
		return reader.readIntoArray(data, 0, data.length)
		    .thenApply(function(read){
                let func = function() {
    			    iframe.contentWindow.postMessage({name:name,bytes:data}, '*');
                };
                that.setupIFrameMessaging(iframe, func);
		    });
	    });
            setTimeout(() => {
                if (!that.isIframeInitialised)
                    that.$toast.error("Unable to register service worker. PDF viewer will not work offline. \nTo enable offline usage, allow 3rd party cookies for " + window.location.protocol + "//[*]." + window.location.host + "\n Note: this is not tracking", {timeout:false});
            }, 5000)
	},
        setupIFrameMessaging: function(iframe, func) {
            if (this.isIframeInitialised) {
                func();
            } else {
                iframe.contentWindow.postMessage({type: 'ping'}, '*');
                let that = this;
                window.setTimeout(function() {that.setupIFrameMessaging(iframe, func);}, 20);
            }
        },
        close: function () {
            this.$emit("hide-pdf-viewer");
        }
    },
}
