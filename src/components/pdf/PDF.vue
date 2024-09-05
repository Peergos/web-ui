<template>
<transition name="modal">
<div class="modal-mask" @click="close">
    <div class="modal-container full-height" @click.stop style="width:100%;overflow-y:auto;padding:0;display:flex;flex-flow:column;">


        <div class="modal-header" style="padding:0">
            <center><h2>{{ file.getName() }}</h2></center><span @click="close" tabindex="0" v-on:keyup.enter="close" style="color:black;font-size:3em;font-weight:bold;position:absolute;top:0;right:0.2em;cursor:pointer;font-family:'Cambria Math'">&times;</span>
        </div>

        <div class="modal-body" style="margin:0;padding:0;display:flex;flex-grow:1;">
	  <iframe id="pdf" :src="frameUrl()" style="width:100%;height:100%;" frameBorder="0"></iframe>
        </div>
    </div>
</div>
</transition>
</template>

<script>
module.exports = {
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
            }, 1000 * 10)
	},
		getFileSize: function(props) {
                var low = props.sizeLow();
                if (low < 0) low = low + Math.pow(2, 32);
                return low + (props.sizeHigh() * Math.pow(2, 32));
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
</script>
<style>
</style>