<template>
<article class="app-view tasks-view" style="display:flex; flex-direction: column;">
    <AppHeader>
	<template #tools>
            <div class="">
	        <span style="">
	            <span v-if="isWritable && unsavedChanges" @click="saveTodoBoard" tabindex="0" v-on:keyup.enter="saveTodoBoard" style="color:black;font-size:2.5em;font-weight:bold;cursor:pointer;margin:.3em;" v-bind:class="['fas', saving ? 'fa-hourglass' : 'fa-save']" title="Save"></span>
	        </span>
            </div>
	</template>
    </AppHeader>
    <main style="display:flex; flex-grow: 1;">
        <div class="" style="padding:0;display:flex;flex-grow:1;">
	    <iframe id="editor" :src="frameUrl()" style="width:100%;height:100%;" frameBorder="0"></iframe>
        </div>
	<spinner v-if="showSpinner" :message="spinnerMessage"></spinner>
	<select-create
            v-if="showSelect"
            v-on:hide-select="closeSelect"
            :select_message= "select_message"
            :select_placeholder="select_placeholder"
            :select_items="select_items"
            :select_consumer_func="select_consumer_func">
        </select-create>
        <warning
	    v-if="showWarning"
	    v-on:hide-warning="showWarning = false"
	    :warning_message='warning_message'
	    :warning_body="warning_body"
	    :consumer_func="warning_consumer_func">
	</warning>
	<prompt
	    v-if="showPrompt"
	    v-on:hide-prompt="showPrompt = false"
	    :prompt_message='prompt_message'
	    :placeholder="prompt_placeholder"
	    :max_input_size="prompt_max_input_size"
	    :value="prompt_value"
	    :consumer_func="prompt_consumer_func">
	</prompt>
    </main>
</article>
</template>

<script>
const downloader = require("../mixins/downloader/index.js");
const routerMixins = require("../mixins/router/index.js");
const AppHeader = require("../components/AppHeader.vue");

module.exports = {
    components: {
	AppHeader,
    },
    mixins:[routerMixins],

    data: function() {
        return {
            showSpinner: false,
            showSelect: false,
            spinnerMessage: '',
            expectingSave: false,
            saving: false,
            isWritable : false,
            warning_message: "",
            warning_body: "",
            warning_consumer_func: () => {},
            showWarning: false,
            unsavedChanges: false,
            showPrompt: false,
            prompt_message: '',
            prompt_placeholder: '',
            prompt_max_input_size: null,
            prompt_value: '',
            prompt_consumer_func: () => {},
            todoBoardName: null,
            todoExtension: ".todo",
            currentFile: null,
            isIframeInitialised: false,
            taskSelected: false
        }
    },
    
    computed: {
	...Vuex.mapState([
	    'context',
	    'mirrorBatId',
	]),
	...Vuex.mapGetters([
	    'isSecretLink',
	    'getPath',
	    'currentFilename',
	]),
    },

    mounted(){
    },

    created: function() {
        this.showSpinner = true;
        this.init()
    },
    methods: {
        init: function() {
            // if we have a file selected and it is a todo list, open it,
            // otherwise list todo files in home dir and give choice of creating a new one or opening one of them
            const props = this.getPropsFromUrl();
            if (props.secretLink) {
                let path = this.getPath;
                let filepath = path + (path.endsWith("/") ? "" : "/") + this.currentFilename;
                this.loadPath(filepath)
            } else {
                const path = props == null ? null : props.path;
	        const filename = props == null ? null : props.filename;
                let that = this;
                if (filename == null || filename === "") {
                    this.selectOrCreateModal();
                    return;
                }
                
                this.loadFile(path, filename);
            }
        },
        
        loadFile: function(path, filename) {
            if (!path.endsWith("/"))
                path = path + "/";
            this.loadPath(path + filename);
        },
        loadPath: function(path) {
            let that = this;
            that.context.getByPath(path).thenApply(fileOpt => {
                if (! fileOpt.isPresent()) {
                    that.$toast.error("Couldn't load file: " + path, {timeout:false})
                    return;
                }
                let file = fileOpt.get();
                let mimetype = file.getFileProperties().mimeType;
                if (mimetype == "application/vnd.peergos-todo") {
                    that.currentFile = file;
                    that.todoBoardName = that.extractTodoBoardName(file.getName());
                    that.startListener();
                } else {
                    that.selectOrCreateModal();
                }
            });
        },
        
        selectOrCreateModal: function() {
            let that = this;
            this.select_placeholder='Todo Board';
            this.select_message='Create or open Todo Board';
            that.showSpinner = true;
            that.context.getByPath(that.context.username).thenApply(homeDir => {
                homeDir.get().getChildren(that.context.crypto.hasher, that.context.network).thenApply(function(children){
                    let childrenArray = children.toArray();
                    let todoBoards = childrenArray.filter(f => f.getName().endsWith('.todo') && f.getFileProperties().mimeType == "application/vnd.peergos-todo");
                    that.select_items= todoBoards.map(item => {
                        let name = item.getName();
                        return name.substring(0, name.length - 5);
                    }).sort(function(a, b) {
                      	return a.localeCompare(b);
                    });
                    that.select_consumer_func = function(select_result) {
                        if (select_result === null)
                            return;
                        that.todoBoardName = select_result.endsWith('.todo') ?
                            select_result.substring(0, select_result.length - 5) : select_result;
                        let foundIndex = todoBoards.findIndex(v => {
                            let name = v.getName();
                            return name.substring(0, name.length - 5) === that.todoBoardName;
                        });
                        that.taskSelected = true;
                        if (foundIndex != -1) {
                            that.loadFile(that.getPath, todoBoards[foundIndex].getName());
                        }
                        else
                            that.startListener();
                        that.updateHistory("Tasks", "/" + that.context.username + "/", {filename:select_result + ".todo"});
                    };
                    that.showSpinner = false;
                    that.showSelect = true;
                });
            });
        },
        closeSelect: function() {
            this.showSelect = false;
            if (!this.taskSelected) {
                this.openFileOrDir("Drive", "/", {filename:""})
            }
        },
        extractTodoBoardName: function(filename) {
            return filename.endsWith(this.todoExtension) ? filename.substring(0, filename.length - 5) : filename;
        },
	frameUrl: function() {
            return this.frameDomain() + "/apps/todo-board/index.html";
        },
        frameDomain: function() {
            return window.location.protocol + "//todo-board." + window.location.host;
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
                    } else if (e.data.action == 'save') {
                        if (that.expectingSave) {
                            that.expectingSave = false;
                            that.save(e.data.text);
                        }
                    } else if (e.data.action == 'requestRenameList') {
                        that.renameListRequest(e.data.index, e.data.currentName);
                    } else if (e.data.action == 'registerChange') {
                        that.unsavedChanges = true;
                    }
                }
            });
	    // Note that we're sending the message to "*", rather than some specific
            // origin. Sandboxed iframes which lack the 'allow-same-origin' header
            // don't have an origin which you can target: you'll have to send to any
            // origin, which might alow some esoteric attacks. Validate your output!
            if (this.currentFile == null) {
                that.isWritable = true;
                that.showSpinner = false;
                that.unsavedChanges = true;
                let func = function() {
                    iframe.contentWindow.postMessage({title: that.todoBoardName, isWritable: that.isWritable, text: []}, '*');
                };
                that.setupIFrameMessaging(iframe, func);
            } else {
                that.isWritable = that.currentFile.isWritable();
                const props = this.currentFile.getFileProperties();
                this.currentFile.getInputStream(this.context.network, this.context.crypto, props.sizeHigh(), props.sizeLow(), function(read){})
                    .thenCompose(function(reader) {
                        var size = downloader.methods.getFileSize(props);
                        var data = convertToByteArray(new Int8Array(size));
                        return reader.readIntoArray(data, 0, data.length).thenApply(function(read){
                            let allLists = that.loadTodoBoard(peergos.shared.user.TodoBoard.fromByteArray(data));
                            let title = that.todoBoardName;
                            that.showSpinner = false;
                            let func = function() {
                                iframe.contentWindow.postMessage({title: title, isWritable: that.isWritable, text: allLists}, '*');
                            };
                            that.setupIFrameMessaging(iframe, func);
                        });
                    }).exceptionally(function(throwable) {
                        that.showSpinner = false;
                        that.$toast.error("Unexpected error: " + throwable.detailMessage, {timeout:false})
                        console.log('Error loading file: ' + that.currentFile.getName());
                        console.log(throwable.getMessage());
                    });
            }
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
        loadTodoBoard: function(todoBoard) {
            let lists = todoBoard.getTodoLists().toArray([]);
            let allLists = [];
            for(var i = 0; i < lists.length; i++) {
                let list = lists[i];
                let items = list.getTodoItems().toArray([]);
                let allItems = [];
                for(var j = 0; j < items.length; j++) {
                    let item = items[j];
                    let milliseconds = item.getCreatedAsMillisecondsString();
                    let entry = {id: item.Id, created: milliseconds, text: item.text, checked: item.checked};
                    allItems.push(entry);
                }
            allLists.push({id: list.getId(), name: list.getName(), items: allItems});
            }
            return allLists;
        },
	saveTodoBoard: function() {
            if (! this.isWritable) {
                return;
            }
	    if(this.saving) {
	        return;
	    }
            
	    var iframe = document.getElementById("editor");
	    this.expectingSave = true;
	    iframe.contentWindow.postMessage({type:"save"}, '*');
	},
        confirmationWarning: function(msg, body, deleteFn) {
            this.warning_message=msg;
            this.warning_body=body;
            this.warning_consumer_func = deleteFn;
            this.showWarning = true;
        },
        save: function(lists) {
            if (! this.isWritable) {
                return;
            }
            this.showSpinner = true;
	    const that = this;
	    that.saving = true;
            
	    let todoLists = [];
	    for(var i = 0; i < lists.length; i++) {
	        let list = lists[i];
    	        let listItems = [];
    	        for(var j = 0; j < list.items.length; j++) {
    	            let item = list.items[j];
    	            let entry = peergos.shared.user.TodoListItem.build(item.id, item.created, item.text, item.checked);
                    listItems.push(entry);
	        }
    	        let todoList = peergos.shared.user.TodoList.buildFromJs(list.name, list.id, listItems);
    	        todoLists.push(todoList);
	    }
            
	    let todoBoard = peergos.shared.user.TodoBoard.buildFromJs(this.todoBoardName, todoLists);
            let bytes = todoBoard.toByteArray();
            let java_reader = peergos.shared.user.fs.AsyncReader.build(bytes);
            const context = this.context;
            const sizeHi = (bytes.length - (bytes.length % Math.pow(2, 32)))/Math.pow(2, 32);
            if(this.currentFile == null) {
                let pathToFile = "/" + context.username;
                this.context.getByPath(pathToFile).thenApply(function(dirOpt){
                    let filename = that.todoBoardName + that.todoExtension;
                    const sizeHi = (bytes.length - (bytes.length % Math.pow(2, 32)))/Math.pow(2, 32);
                    let dir = dirOpt.get();
                    dir.hasChild(filename, context.crypto.hasher, context.network).thenApply(function(alreadyExists){
                        if(alreadyExists) {
                            that.showSpinner = false;
                            that.saving = false;
                            that.$toast.error("TodoBoard with same filename already exists! File has not been saved", {timeout:false})
                        } else {
                            dir.uploadFileJS(filename, java_reader, sizeHi, bytes.length,
                                             false, false, this.mirrorBatId, context.network, context.crypto, function(len){}, context.getTransactionService()
                                            ).thenApply(function(updatedDir) {
                                                updatedDir.getChild(filename, context.crypto.hasher, context.network).thenApply(function(fileOpt){
                                                    that.showSpinner = false;
                                                    that.unsavedChanges = false;
                                                    that.saving = false;
                                                    that.currentFile = fileOpt.get();
                                                    that.$emit("update-refresh");
                                                }).exceptionally(function(throwable) {
                                                    that.handleException(throwable, 'Error retrieving file', 'Error retrieving file: ' + pathToFile + "/" + filename);
                                                });
                                            }).exceptionally(function(throwable) {
                                                that.handleException(throwable, 'Error creating file', 'Error creating file: ' + pathToFile + "/" + filename);
                                            });
                        }
                    }).exceptionally(function(throwable) {
                        that.handleException(throwable, 'Error listing Directory', 'Error listing Directory: ' + pathToFile);
                    });
                }).exceptionally(function(throwable) {
                    that.handleException(throwable, 'Error navigating to directory', 'Error navigating to directory: ' + pathToFile);
                })
            } else {
                this.currentFile.overwriteFileJS(java_reader, sizeHi, bytes.length,
                                                 context.network, context.crypto, len => {})
                    .thenApply(function(updatedFile) {
                        that.showSpinner = false;
                        that.unsavedChanges = false;
                        that.saving = false;
                        that.currentFile = updatedFile;
                        that.$emit("update-refresh");
                    }).exceptionally(function(throwable) {
                        that.showSpinner = false;
                        if (throwable.detailMessage.includes("CAS exception updating cryptree node.")
                            ||   throwable.detailMessage.includes("Mutable pointer update failed! Concurrent Modification.")) {
                            that.showMessage("Concurrent modification detected", "The file has been updated by another user. Your changes have not been saved.");
                        } else {
                            that.handleException(throwable, "Unexpected error", 'Error uploading file: ' + that.currentFile.getName());
                        }
                        that.saving = false;
                    });
            }
    },
        handleException: function(throwable, publicMessage, logMessage) {
            this.showSpinner = false;
            this.saving = false;
            that.$toast.error(publicMessage, {timeout:false})
            console.log(logMessage);
            console.log(throwable.getMessage());
        },
        showMessage: function(title, detail) {
            this.$toast.error(title + " " + detail, {timeout:false});
        },
        closeTodoBoard: function () {
            let that = this;
            if (this.unsavedChanges) {
                this.confirmationWarning('Are you sure you want to close ' + this.todoBoardName +' without saving?', '',
                                         () => that.close());
            } else {
                this.close();
            }
        },
        renameListRequest: function(index, currentName) {
            this.prompt_placeholder = 'New name';
            this.prompt_value = currentName;
            this.prompt_message = 'Enter a new name';
            this.prompt_max_input_size = 20;
            var that = this;
            this.prompt_consumer_func = function(prompt_result) {
            if (prompt_result === null)
                return;
                if (prompt_result === currentName)
                    return;
                let newName = prompt_result.trim();
                if (newName === '')
                    return;
                if (newName === '.' || newName === '..')
                    return;
                setTimeout(function(){
                    var iframe = document.getElementById("editor");
                    iframe.contentWindow.postMessage({type: 'respondRenameList', index: index, newName: prompt_result}, '*');
                });
            };
            this.showPrompt =  true;
        },
    }
}
</script>

<style>
.app-view{
	min-height: 100vh;

	/* display: flex;
	align-items: center;
	justify-content: center;
	min-height: 100vh; */
}
.app-view  h1{
	font-size:16px;
	line-height: 14px;
}
</style>
