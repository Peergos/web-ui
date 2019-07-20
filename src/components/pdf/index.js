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
		if (e.origin === "null" && e.source === iframe.contentWindow) {
		    alert('Result: ' + e.data);
		}
	    });
	    // Note that we're sending the message to "*", rather than some specific
            // origin. Sandboxed iframes which lack the 'allow-same-origin' header
            // don't have an origin which you can target: you'll have to send to any
            // origin, which might alow some esoteric attacks. Validate your output!
            iframe.contentWindow.postMessage("Hey", '*');
	},

        close: function () {
            this.$emit("hide-pdf-viewer");
        }
    },
}
