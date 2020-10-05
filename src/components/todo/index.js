module.exports = {
    template: require('todo.html'),
    data: function() {
        return {
            showSpinner: false,
	        expectingSave: false,
	        saving: false,
	        deleting: false,
	        isWritable : false,
	        isOwner : false,
	        readyToShare : false,
	        warning_message: "",
	        warning_body: "",
            warning_consumer_func: () => {},
            showWarning: false,
            unsavedChanges: false,
            showPrompt: false,
            prompt_message: '',
            prompt_placeholder: '',
            prompt_value: '',
            prompt_consumer_func: () => {}
        }
    },
    props: ['context', 'messages', 'todoBoardName', 'todoBoardOwner', 'isNewTodoBoard', 'shareWith'],
    created: function() {
        this.startListener();
    },
    methods: {
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
            if (e.origin === "null" && e.source === iframe.contentWindow) {
                if (e.data.action == 'save') {
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
        this.isOwner = this.todoBoardOwner == this.context.username;
        if (this.isNewTodoBoard) {
                let empty = [];
                that.isWritable = true;
                setTimeout(function(){
                    iframe.contentWindow.postMessage({title: that.todoBoardName, isWritable: that.isWritable, text: empty}, '*');
                });
        } else {
            this.readyToShare = true;
            let todoApp = this.context.getTodoApp();
            todoApp.getTodoBoard(this.todoBoardOwner, this.todoBoardName).thenCompose(function(todoBoard) {
                let lists = todoBoard.left.getTodoLists().toArray([]);
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
                let title = that.isOwner ? that.todoBoardName : that.todoBoardName + " (shared by: " + that.todoBoardOwner + ")";
                that.isWritable = todoBoard.right;
                setTimeout(function(){
                    iframe.contentWindow.postMessage({title: title, isWritable: that.isWritable, text: allLists}, '*');
                });
            });
        }
	},
    isShareable: function() {
        return this.isOwner && this.isWritable && this.readyToShare;
    },
    isDeletable: function() {
        return this.readyToShare && this.isOwner && this.isWritable;
    },
	saveTodoBoard: function() {
        if (! this.isWritable) {
            return;
        }
        if(this.deleting) {
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
    deleteTodoBoard: function() {
        let that = this;
        this.confirmationWarning('Are you sure you want to delete ' + this.todoBoardName +'?', '',
            () => that.delete());
    },
    delete: function() {
        const that = this;
        that.deleting = true;
        let todoApp = this.context.getTodoApp();
        todoApp.deleteTodoBoard(this.todoBoardOwner, this.todoBoardName).thenApply(function(res) {
            that.deleting = false;
            that.close();
        }).exceptionally(function(throwable) {
            that.showMessage("Unexpected error", throwable.detailMessage);
            console.log(throwable.getMessage());
            that.deleting = false;
        });
    },
    shareTodoBoard: function(text) {
        if (! this.isWritable) {
            return;
        }
        this.shareWith('todo', this.todoBoardName);
    },
    save: function(lists) {
        if (! this.isWritable) {
            return;
        }
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
        let todoApp = this.context.getTodoApp();
        todoApp.updateTodoBoard(this.todoBoardOwner, todoBoard).thenApply(function(res) {
            that.saving = false;
            that.readyToShare = true;
            that.unsavedChanges = false;
        }).exceptionally(function(throwable) {
            that.showMessage("Unexpected error", throwable.detailMessage);
            console.log(throwable.getMessage());
            that.saving = false;
        });
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
