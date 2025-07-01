<template>
<transition name="modal">
<div class="modal-mask" @click="close">
    <div class="modal-container full-height" @click.stop style="width:100%;overflow-y:auto;padding:0;display:flex;flex-flow:column;">
        <div class="modal-header" style="padding:0">
            <center><h2>{{ getFilename }}</h2></center>
	  <span style="position:absolute;top:0;right:0.2em;">
	    <span v-if="isWritable()" @click="getAndSave" tabindex="0" v-on:keyup.enter="getAndSave"  style="color:black;font-size:2.5em;font-weight:bold;cursor:pointer;margin:.3em;" v-bind:class="['fas', saving ? 'fa-hourglass' : 'fa-save']" title="Save file"></span>
	    <span @click="close" tabindex="0" v-on:keyup.enter="close" style="color:black;font-size:3em;font-weight:bold;cursor:pointer;font-family:'Cambria Math'">&times;</span>
	  </span>
        </div>
        <SaveConflict
            v-if="showSaveConflictPrompt"
            :currentContentsBytes="currentSaveConflictBytes"
            :consumer_save_func="save_conflict_consumer_func"
            :consumer_close_func="close_conflict_consumer_func"
            :consumer_cancel_func="cancel_conflict_consumer_func"
        />
        <NewFilePicker
            v-if="showNewFilePicker"
            @hide-prompt="closeNewFilePicker()"
            :pickerFileExtension="newFileExtension"
            :initialFilename="initialNewFilename"
            :consumer_func="file_picker_consumer_func"
        />
        <Spinner v-if="showSpinner" :message="spinnerMessage"></Spinner>
        <div class="modal-body" style="margin:0;padding:0;display:flex;flex-grow:1;">
	  <iframe id="editor" :src="frameUrl()" style="width:100%;height:100%;" frameBorder="0"></iframe>
        </div>
    </div>
</div>
</transition>
</template>

<script>
const NewFilePicker = require("../picker/NewFilePicker.vue");
const SaveConflict = require("../prompt/SaveConflict.vue");
const Spinner = require("../spinner/Spinner.vue");
const UriDecoder = require('../../mixins/uridecoder/index.js');
module.exports = {
    components: {
        NewFilePicker,
        SaveConflict,
        Spinner,
    },
    data: function() {
        return {
            showSpinner: false,
            spinnerMessage: '',
	        expectingSave: false,
	        saving: false,
	        currentFile: null,
	        currentFilename: null,
	        isFileWritable: false,
	        isIframeInitialised: false,
            showSaveConflictPrompt: false,
            save_conflict_consumer_func: (bytes) => { },
            currentSaveConflictBytes: null,
            showNewFilePicker: false,
            file_picker_consumer_func: () => { },
            initialNewFilename: '',
            newFileExtension: '',
        }
    },
    props: ['context', 'file', 'folder'],
    created: function() {
        this.currentFile = this.file;
        this.currentFilename = this.file.getName();
        this.isFileWritable = this.file.isWritable();
        this.startListener();
    },
    mixins:[UriDecoder],
    computed: {
        getFilename: function() {
            return this.currentFilename;
        },
    },
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
	    this.showSpinner = true;
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
            that.showSpinner = false;
        }).exceptionally(function(throwable) {
            let msg = that.uriDecode(throwable.detailMessage);
            if (msg.includes('Concurrent modification of a file or directory!')) {
                that.currentSaveConflictBytes = bytes;
                that.save_conflict_consumer_func = function (bytes) {
                    that.continueSaveConflictPrompt(bytes);
                };
                that.close_conflict_consumer_func = function (bytes) {
                    that.showSaveConflictPrompt = false;
                    that.showMessage(false, "Changes not saved!");
                    that.saving = false;
                };
                that.cancel_conflict_consumer_func = function (bytes) {
                    that.showSaveConflictPrompt = false;
                    that.showMessage(false, "Changes not saved!");
                    that.saving = false;
                };
                that.showSaveConflictPrompt = true;
            } else {
                that.saving = false;
                that.showMessage(true, "Unexpected error", throwable.detailMessage);
                console.log('Error saving file');
                console.log(throwable.getMessage());
            }
            that.showSpinner = false;
        });
    },
    continueSaveConflictPrompt(data) {
        let that = this;
        that.showSaveConflictPrompt = false;
        Vue.nextTick(function() {
            let extension = that.currentFilename.substring(that.currentFilename.lastIndexOf('.'));
            that.newFileExtension = extension.substring(1);
            let filenameWithoutExtension = that.currentFilename.substring(0, that.currentFilename.lastIndexOf('.'));
            that.initialNewFilename = filenameWithoutExtension + '(1)' + extension;
            that.file_picker_consumer_func = function (prompt_result, folder) {
                if (prompt_result == null) {
                    return;
                }
                let filename = prompt_result.trim();
                if (!filename.endsWith(extension)) {
                    that.showMessage(true, "Incorrect file extension!");
                    return;
                }
                if (filename === '' || prompt_result == that.currentFilename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
                    that.showMessage(true, "Invalid filename!");
                    return;
                }
                let folderPath = folder.endsWith("/") ? folder : folder + "/";
                let fullPathToNewFile = folderPath + filename;
                that.findFileByPath(fullPathToNewFile, false).thenApply(file => {
                    if (file != null) {
                        that.showMessage(true, "File already exists. File not saved!");
                    } else {
                        let filePath = peergos.client.PathUtils.directoryToPath(fullPathToNewFile.split('/').filter(n => n.length > 0));
                        that.writeNewFile(filePath, data);
                    }
                });
            };
            that.showNewFilePicker = true;
        });
    },
    closeNewFilePicker() {
        this.showNewFilePicker = false;
        this.saving = false;
    },
    writeNewFile: function(path, data) {
        this.saving = true;
        this.showSpinner = true;
        let that = this;
        let pathNameCount = peergos.client.PathUtils.getNameCount(path);
        let pathWithoutFilename = peergos.client.PathUtils.subpath(path, 0, pathNameCount -1);
        this.context.getByPath(pathWithoutFilename.toString()).thenApply(dirOpt => {
            let dir = dirOpt.get();
            if(!dir.isWritable()) {
                that.showMessage(true, "You do not have write access to folder!");
                that.saving = false;
                that.showSpinner = false;
            } else {
                dir.uploadOrReplaceFile(peergos.client.PathUtils.getFileName(path).toString(),
                        new peergos.shared.user.fs.AsyncReader.build(data),
                        0, data.length, that.context.network, that.context.crypto, x => {})
                            .thenApply(function(updatedFolder) {
                                that.context.getByPath(path.toString()).thenApply(fileOpt => {
                                    that.saving = false;
                                    that.currentFile = fileOpt.ref;
                                    that.currentFilename = that.currentFile.getName();
                                    that.isFileWritable = that.currentFile.isWritable();
                                    that.$emit("update-refresh");
                                    that.showSpinner = false;
                                });
                            }).exceptionally(function(throwable) {
                                let msg = that.uriDecode(throwable.detailMessage);
                                that.showMessage(true, "Unexpected error", throwable.detailMessage);
                                console.log(throwable.getMessage());
                                that.saving = false;
                                that.showSpinner = false;
                            })
            }
        });
    },
    findFileByPath: function(filePath) {
        var future = peergos.shared.util.Futures.incomplete();
        let that = this;
        this.context.getByPath(filePath).thenApply(function(fileOpt){
            if (fileOpt.ref == null) {
                future.complete(null);
            } else {
                let file = fileOpt.get();
                future.complete(file);
            }
        }).exceptionally(function(throwable) {
            console.log(throwable.getMessage());
            future.complete(null);
        });
        return future;
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
        this.$emit("update-refresh");
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