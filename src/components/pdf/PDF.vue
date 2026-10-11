<template>
<transition name="modal">
<div class="pg-viewer__mask" @click="close">
    <section class="pg-viewer" role="dialog" aria-modal="true" :aria-label="file.getName()" @click.stop>
        <header class="pg-viewer__bar">
            <span class="pg-viewer__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
            </span>
            <h2 class="pg-viewer__title">{{ file.getName() }}</h2>
            <DialogClose @close="close"/>
        </header>
        <div class="pg-viewer__body">
            <iframe id="pdf" :src="frameUrl()" frameBorder="0"></iframe>
        </div>
    </section>
</div>
</transition>
</template>

<script>
const DialogClose = require("../dialog/DialogClose.vue");

module.exports = {
    components: {
        DialogClose
    },
    data: function() {
        return {
            showSpinner: false,
            isIframeInitialised: false,
            saving: false,
            currentFile: null,
            isFileWritable: false
        }
    },
    props: ['context', 'file'],
    created: function() {
        this.currentFile = this.file;
        this.isFileWritable = this.file.isWritable();
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
            } else if (e.data.action == 'save') {
                that.saveToFile(e.data.bytes);
            } else {
    		    console.log('Message from Iframe: ' + e.data);
            }
		}
	    });
	    // Note that we're sending the message to "*", rather than some specific
            // origin. Sandboxed iframes which lack the 'allow-same-origin' header
            // don't have an origin which you can target: you'll have to send to any
            // origin, which might alow some esoteric attacks. Validate your output!
	    const props = this.currentFile.getFileProperties();
	    const name = this.currentFile.getName();
	    const writable = this.isFileWritable;
	    this.currentFile.getInputStream(this.context.network, this.context.crypto, props.sizeHigh(), props.sizeLow(), function(read){}).thenCompose(function(reader) {
		var size = that.getFileSize(props);
		var data = convertToByteArray(new Int8Array(size));
		return reader.readIntoArray(data, 0, data.length)
		    .thenApply(function(read){
                let func = function() {
    			    iframe.contentWindow.postMessage({name:name,bytes:data,writable:writable}, '*');
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
        saveToFile: function(uint8Bytes) {
            if (this.saving) return;
            if (!this.currentFile.isWritable()) {
                this.$toast.error("You don't have write access to this file");
                return;
            }
            this.saving = true;
            this.showSpinner = true;
            const that = this;
            const context = this.context;
            const bytes = convertToByteArray(uint8Bytes);
            const java_reader = peergos.shared.user.fs.AsyncReader.build(bytes);
            const sizeHi = (bytes.length - (bytes.length % Math.pow(2, 32))) / Math.pow(2, 32);
            this.currentFile.overwriteFileJS(java_reader, sizeHi, bytes.length,
                context.network, context.crypto, len => {})
                .thenApply(function(updatedFile) {
                    that.currentFile = updatedFile;
                    that.saving = false;
                    that.showSpinner = false;
                    that.$emit("update-refresh");
                    that.$toast.success("PDF saved");
                }).exceptionally(function(throwable) {
                    that.saving = false;
                    that.showSpinner = false;
                    that.$toast.error("Save failed: " + throwable.detailMessage);
                    return null;
                });
        },
        close: function () {
            this.$emit("hide-pdf-viewer");
        }
    },
}
</script>
<style>
</style>