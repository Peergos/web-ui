<template>
<transition name="modal">
<div class="modal-mask" @click="close">
    <div class="modal-container full-height" @click.stop style="width:100%;overflow-y:auto;padding:0;display:flex;flex-flow:column;">
        <div class="modal-header" style="padding:0">
            <center><h2>{{ getFilename() }}</h2></center>
	  <span style="position:absolute;top:0;right:0.2em;">
	    <span v-if="isWritable()" @click="getAndSave" tabindex="0" v-on:keyup.enter="getAndSave"  style="color:black;font-size:2.5em;font-weight:bold;cursor:pointer;margin:.3em;" v-bind:class="['fas', saving ? 'fa-hourglass' : 'fa-save']" title="Save file"></span>
	    <span @click="close" tabindex="0" v-on:keyup.enter="close" style="color:black;font-size:3em;font-weight:bold;cursor:pointer;">&times;</span>
	  </span>
        </div>

        <div class="modal-body" style="margin:0;padding:0;display:flex;flex-grow:1;">
	  <iframe id="editor" :src="frameUrl()" style="width:100%;height:100%;" frameBorder="0"></iframe>
        </div>
    </div>
</div>
</transition>
</template>

<script>
const UriDecoder = require('../../mixins/uridecoder/index.js');
module.exports = {
    data: function() {
        return {
            showSpinner: false,
	        expectingSave: false,
	        saving: false,
	        currentFile: null,
	        currentFilename: null,
	        isFileWritable: false,
	        isIframeInitialised: false
        }
    },
    props: ['context', 'file'],
    created: function() {
        this.currentFile = this.file;
        this.currentFilename = this.file.getName();
        this.isFileWritable = this.file.isWritable();
        this.startListener();
    },
    mixins:[UriDecoder],
    methods: {
	frameUrl: function() {
            return this.frameDomain() + "/apps/code-editor/index.html";
        },
        frameDomain: function() {
            return window.location.protocol + "//code-editor." + window.location.host;
        },
        startListener: function() {
	    var that = this;
	    var iframe = document.getElementById("editor");
	    if (iframe == null) {
    		setTimeout(that.startListener, 1000);
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
                if (e.data.action == 'pong') {
                    that.isIframeInitialised = true;
                } else if (e.data == "sw-registration-failure" ) {
                    console.log("failed to register service worker for editor")
                } else if (that.expectingSave) {
                    that.expectingSave = false;
                    that.save(e.data.text);
                }
            }
        });
	    // Note that we're sending the message to "*", rather than some specific
            // origin. Sandboxed iframes which lack the 'allow-same-origin' header
            // don't have an origin which you can target: you'll have to send to any
            // origin, which might alow some esoteric attacks. Validate your output!
	    const props = this.currentFile.getFileProperties();
	    const name = this.currentFile.getName();
	    var mimeType = "text/x-markdown";
	    var modes = ["markdown"]; // default to markdown for plain text
	    if (name.endsWith(".java")) {
		    modes = ["clike"];
		    mimeType = "text/x-java";
	    } else if (name.endsWith(".scala")) {
		    modes = ["clike"];
		    mimeType = "text/x-scala";
	    } else if (name.endsWith(".kt")) {
		    modes = ["clike"];
		    mimeType = "text/x-kotlin";
	    } else if (name.endsWith(".c")) {
		    modes = ["clike"];
		    mimeType = "text/x-csrc";
	    } else if (name.endsWith(".cpp")) {
		    modes = ["clike"];
		    mimeType = "text/x-c++src";
	    } else if (name.endsWith(".clj")) {
		    modes = ["clojure"];
		    mimeType = "text/x-clojure";
	    } else if (name.endsWith(".css")) {
		    modes = ["css"];
		    mimeType = "text/css";
	    } else if (name.endsWith(".diff")) {
		    modes = ["diff"];
		    mimeType = "text/x-diff";
	    } else if (name.endsWith(".go")) {
		    modes = ["go"];
		    mimeType = "text/x-go";
	    } else if (name.endsWith(".html")) {
		    modes = ["xml", "javascript", "css", "htmlmixed"];
		    mimeType = "text/html";
	    } else if (name.endsWith(".js")) {
		    modes = ["javascript"];
		    mimeType = "text/javascript";
	    } else if (name.endsWith(".json")) {
		    modes = ["javascript"];
		    mimeType = "application/json";
	    } else if (name.endsWith(".py")) {
		    modes = ["python"];
		    mimeType = "text/x-python";
	    } else if (name.endsWith(".rs")) {
		    modes = ["rust"];
		    mimeType = "text/x-rustsrc";
	    } else if (name.endsWith(".r")) {
		    modes = ["r"];
		    mimeType = "text/x-rsrc";
	    } else if (name.endsWith(".rb")) {
		    modes = ["ruby"];
		    mimeType = "text/x-ruby";
	    } else if (name.endsWith(".sh")) {
		    modes = ["shell"];
		    mimeType = "text/x-sh";
	    } else if (name.endsWith(".tex")) {
		    modes = ["stex"];
		    mimeType = "text/x-stex";
	    } else if (name.endsWith(".xml")) {
		    modes = ["xml"];
		    mimeType = "application/xml";
	    } else if (name.endsWith(".yaml")) {
		    modes = ["yaml"];
		    mimeType = "text/x-yaml";
	    }
	    var readOnly = ! this.isFileWritable;

	    this.currentFile.getInputStream(this.context.network, this.context.crypto, props.sizeHigh(), props.sizeLow(), function(read){})
	        .thenCompose(function(reader) {
                var size = that.getFileSize(props);
                var data = convertToByteArray(new Int8Array(size));
                return reader.readIntoArray(data, 0, data.length)
                    .thenApply(function(read){
                        let func = function() {
                            iframe.contentWindow.postMessage({modes:modes, mime:mimeType, readOnly:readOnly, text:new TextDecoder().decode(data)}, '*');
                        };
                        that.setupIFrameMessaging(iframe, func);
                    });
        }).exceptionally(function(throwable) {
            that.showMessage(true, "Unexpected error", throwable.detailMessage);
            console.log('Error loading file: ' + that.file.getName());
            console.log(throwable.getMessage());
        });
            setTimeout(() => {
                if (!that.isIframeInitialised)
                    that.$toast.error("Unable to register service worker. Editor will not work offline. \nTo enable offline usage, allow 3rd party cookies for " + window.location.protocol + "//[*]." + window.location.host + "\n Note: this is not tracking", {timeout:false});
            }, 2500)
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

	getAndSave: function() {
	    if(this.saving) {
	        return;
	    }
	    var iframe = document.getElementById("editor");
	    this.expectingSave = true;
	    iframe.contentWindow.postMessage({type:"save"}, '*');
	},

    save: function(text) {
	    this.saving = true;
	    var bytes = convertToByteArray(new TextEncoder().encode(text));
	    var java_reader = peergos.shared.user.fs.AsyncReader.build(bytes);
	    const context = this.context;
	    const that = this;
	    const sizeHi = (bytes.length - (bytes.length % Math.pow(2, 32)))/Math.pow(2, 32);
        this.currentFile.overwriteFileJS(java_reader, sizeHi, bytes.length,
            context.network, context.crypto, len => {})
        .thenApply(function(updatedFile) {
            that.saving = false;
            that.currentFile = updatedFile;
            that.$emit("update-refresh");
        }).exceptionally(function(throwable) {
            let msg = that.uriDecode(throwable.detailMessage);
            if (msg.includes("CAS exception updating cryptree node.")) {
                that.showMessage(true, "Concurrent modification detected", "The file has been updated by another user. Your changes have not been saved.");
            } else {
                that.showMessage(true, "Unexpected error", throwable.detailMessage);
                console.log('Error uploading file: ' + that.file.getName());
                console.log(throwable.getMessage());
            }
            that.saving = false;
        });
    },
    getFilename: function() {
        return this.currentFilename;
    },
    showMessage: function(isError, title, body) {
        let bodyContents = body == null ? '' : ' ' + body;
        if (isError) {
            this.$toast.error(title + bodyContents, {timeout:false});
        } else {
            this.$toast(title + bodyContents)
        }
    },
    close: function () {
        this.$emit("hide-code-editor");
    },
    isWritable: function() {
        return this.isFileWritable;
    }
    }
}
</script>
<style>
</style>