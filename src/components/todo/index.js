module.exports = {
    template: require('todo.html'),
    data: function() {
        return {
            showSpinner: false,
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
            isIframeInitialised: false
        }
    },
    props: ['context', 'messages', 'currentTodoBoardName', 'file'],
    created: function() {
        this.showSpinner = true;
        this.startListener();
        this.currentFile = this.file;
        this.todoBoardName = this.currentFile == null ? this.currentTodoBoardName : this.extractTodoBoardName(this.currentFile.getName());
    },
    methods: {
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
                    var size = that.getFileSize(props);
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
                that.showMessage("Unexpected error", throwable.detailMessage);
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
                        that.showMessage("TodoBoard with same filename already exists! File have not been saved");
                    } else {
                        dir.uploadFileJS(filename, java_reader, sizeHi, bytes.length,
                            false, false, context.network, context.crypto, function(len){}, context.getTransactionService()
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
                if (throwable.detailMessage.includes("Couldn%27t+update+mutable+pointer%2C+cas+failed")
                    ||   throwable.detailMessage.includes("CAS exception updating cryptree node.")) {
                    that.showMessage("Concurrent modification detected", "The file: '" +
                    that.currentFile.getName() + "' has been updated by another user. Your changes have not been saved.");
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
        this.showMessage(publicMessage);
        console.log(logMessage);
        console.log(throwable.getMessage());
    },
    showMessage: function(title, body) {
        this.messages.push({
            title: title,
            body: body,
            show: true
        });
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
    close: function () {
        this.$emit("hide-todo-board");
    }
    }
}
