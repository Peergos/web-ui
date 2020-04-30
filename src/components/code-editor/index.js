module.exports = {
    template: require('code-editor.html'),
    data: function() {
        return {
            showSpinner: false,
	        expectingSave: false,
	        saving: false,
	        showReplace: false,
            replace_message: "",
            replace_body: "",
            replace_consumer_cancel_func: () => {},
            replace_consumer_func: () => {},
            currentFile: null,
            currentParent: null
        }
    },
    props: ['context', 'file', 'parent'],
    created: function() {
        console.log("kev- in created");
        this.currentFile = this.file;
        this.currentParent = this.parent;
        this.startListener();
    },
    methods: {
	startListener: function() {
	    var iframe = document.getElementById("editor");
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
		if (e.origin === "null" && e.source === iframe.contentWindow) {
		    if (that.expectingSave) {
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
	    var readOnly = ! this.currentFile.isWritable();

	    this.currentFile.getInputStream(this.context.network, this.context.crypto, props.sizeHigh(), props.sizeLow(), function(read){})
	        .thenCompose(function(reader) {
                var size = that.getFileSize(props);
                var data = convertToByteArray(new Int8Array(size));
                return reader.readIntoArray(data, 0, data.length)
                    .thenApply(function(read){
                        iframe.contentWindow.postMessage({modes:modes, mime:mimeType, readOnly:readOnly, text:new TextDecoder().decode(data)}, '*');
                    });
	    });
	},

	getAndSave: function() {
	    var iframe = document.getElementById("editor");
	    this.expectingSave = true;
	    iframe.contentWindow.postMessage({type:"save"}, '*');
	},

    save: function(text) {
	    this.saving = true;
	    const that = this;
	    this.currentFile.isLatest(this.context.network).thenApply(function(isLatest) {
	        if(isLatest) {
	            that.saveTextFile(text);
	        } else {
                that.confirmReplaceFile(that.currentFile.getName(),() => {
                    that.saving = false;
                 },() => {
                    that.saveTextFile(text);
                 }
                );
	        }
	    });
	},
    saveTextFile: function (text) {
	    var bytes = convertToByteArray(new TextEncoder().encode(text));
	    var java_reader = peergos.shared.user.fs.AsyncReader.build(bytes);
	    const file = this.currentFile;
	    const context = this.context;
	    const size = text.length;
	    const that = this;
        this.currentParent.uploadFileJS(file.getName(), java_reader, (size - (size % Math.pow(2, 32)))/Math.pow(2, 32), size,
                true, true, context.network, context.crypto, len => {}, context.getTransactionService())
        .thenApply(function(updated) {
            that.currentParent.getLatest(context.network).thenApply(function(updatedParent) {
                that.currentFile = updated;
                that.currentParent = updatedParent;
                that.saving = false;
            });
        }).exceptionally(function(throwable) {
            console.log('Error uploading file: ' + file.getName());
            console.log(throwable.getMessage());
            throwable.printStackTrace();
            that.saving = false;
        });
    },
    confirmReplaceFile: function(fileName, cancelFn, replaceFn) {
        this.showSpinner = false;
        this.replace_message='The file: "' + fileName + '" has been updated by another user. Do you wish to replace?';
        this.replace_body='';
        this.replace_consumer_cancel_func = cancelFn;
        this.replace_consumer_func = replaceFn;
        this.showReplace = true;
    },
    close: function () {
        this.$emit("hide-code-editor");
    }
    },
    computed: {
        isWritable: function() {
	        return this.currentFile.isWritable();
	    }
    }
}
