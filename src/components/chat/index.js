module.exports = {
    template: require('chat.html'),
    data: function() {
        return {
            showSpinner: false,
            spinnerMessage: '',
            conversations: [],
            messageThread: [],
            statusMessages: [],
            selectedConversationId: null,
            newMessageText: "",
            newMessageMaxLength: 2000,
            allConversations: new Map(),
            allChatControllers: new Map(),
            allMessageThreads: new Map(),
            allThreadsHashToIndex: new Map(),
            chatTitle: "",
            pageStartIndex : 0,
            showConfirm: false,
            confirm_message: "",
            confirm_body: "",
            confirm_consumer_cancel_func: () => {},
            confirm_consumer_func: () => {},
            filterText: "",
            groupId: "",
            groupTitle: "",
            showGroupMembership: false,
            existingGroupMembers: [],
            existingAdmins: [],
            messages: [],
            progressMonitors: [],
            showEmbeddedGallery: false,
            filesToViewInGallery: [],
            replyToMessage: null,
            editMessage: null,
            attachmentList: [],
            emojiChooserBtn: null,
            emojiPicker: null,
            messenger: null,
            displayingMessages: false,
            commandQueue: [],
            executingCommands: false,
            draftMessages: [],
            selectedConversationIsReadOnly: true,
            closedChat: false,
            isInitialised: false,
            chatVisibilityWarningDisplayed: false
        }
    },
    props: ['context', 'closeChatViewer', 'friendnames', 'socialFeed', 'socialState', 'getFileIconFromFileAndType'
        , 'displayProfile', 'checkAvailableSpace', 'convertBytesToHumanReadable', 'importCalendarFile','viewAction'],
    created: function() {
        let that = this;
        this.messenger = new peergos.shared.messaging.Messenger(this.context);
        this.init(true, true);
        Vue.nextTick(function() {
            let element = document.getElementById('filter-conversations');
            element.addEventListener('keyup', function() {
                that.filterConversations();
            });

            window.addEventListener("resize", that.resizeHandler);
            that.resizeHandler();
            that.emojiChooserBtn = document.getElementById('emoji-chooser');
            const emojiPicker = new EmojiButton({
            	recentsCount: 16,
            	zIndex: 2000
            });
            emojiPicker.on('emoji', emoji => {
                that.newMessageText += emoji;
            });
            that.emojiPicker = emojiPicker;
        });
    },
    methods: {
        getContext: function() {
            return this.context;
        },
        checkMessageLength: function(e) {
            let newMessageValue = e.target.value;
            if (newMessageValue.length > this.newMessageMaxLength) {
                this.newMessageText = this.truncateText(newMessageValue, this.newMessageMaxLength);
                this.showMessage("Message has been truncated to " + this.newMessageMaxLength + " characters");
            }
        },
        getFileIcon: function(file, fileType) {
            if (file == null) {
                return 'fa-file';
            }
            return this.getFileIconFromFileAndType(file, fileType);
        },
        reduceCommands: function(future) {
            let that = this;
            let command = this.commandQueue.shift();
            if (command == null) {
                future.complete(true);
            } else {
                command().thenApply(function(res){
                    that.reduceCommands(future);
                });
            }
            return future;
        },
        drainCommandQueue: function(newCommand) {
            this.commandQueue.push(newCommand);
            let that = this;
            if (!that.executingCommands) {
                that.executingCommands = true;
                let future = peergos.shared.util.Futures.incomplete();
                that.reduceCommands(future);
                future.thenApply(res => {
                    that.executingCommands = false;
                });
            }
        },
        showMessage: function(title, message) {
            this.messages.push({
                title: title,
                body: message,
                show: true
            });
        },
        resizeHandler: function() {
            var left = document.getElementById("chat-left-panel");
            var right = document.getElementById("dnd-chat");

            var conversationsContainer = document.getElementById("conversations-container");
            conversationsContainer.style.height = window.innerHeight - 160 + 'px';
            var chatContainer = document.getElementById("message-scroll-area");
            chatContainer.style.height = window.innerHeight - 200 + 'px';

            let closeConversationEl = document.getElementById('chat-back-button');
            if (this.displayingMessages) {
                left.classList.remove("chat-full-width");
                right.classList.remove("chat-hide");
                if(window.innerWidth >= 900) {
                    left.classList.remove("chat-hide");
                    right.classList.remove("chat-full-width");
                    closeConversationEl.style.display = 'none';
                } else if(window.innerWidth <= 900) {
                    left.classList.add("chat-hide");
                    right.classList.add("chat-full-width");
                    closeConversationEl.style.display = '';
                }
            } else {
                right.classList.remove("chat-full-width");
                left.classList.remove("chat-hide");
                closeConversationEl.style.display = 'none';
                if(window.innerWidth >= 900) {
                    left.classList.remove("chat-full-width");
                    right.classList.remove("chat-hide");
                } else if(window.innerWidth <= 900) {
                    left.classList.add("chat-full-width");
                    right.classList.add("chat-hide");
                }
            }
        },
        closeConversation: function (conversation) {
            this.displayingMessages = false;
            this.resizeHandler();
        },
        selectConversation: function (conversation) {
            if (this.executingCommands) {
                return;
            }
            this.displayingMessages = true;
            this.resizeHandler();

            let that = this;
            that.buildMessageThread(conversation.id);
            that.updateScrollPane(true);

            let chatController = this.allChatControllers.get(conversation.id);
            if (chatController.pendingAttachmentRefs.length > 0) {
                this.loadAttachments(chatController).thenApply(attachmentMap => {
                    let currentMessageThread = that.allMessageThreads.get(conversation.id);
                    for(var i = 0; i < currentMessageThread.length; i++) {
                        let entry = currentMessageThread[i];
                        if (entry.mediaFilePaths != null && entry.mediaFilePaths.length > 0) {
                            let mediaFilePaths = entry.mediaFilePaths;
                            entry.mediaFiles = [];
                            for(var j = 0; j < mediaFilePaths.length; j++) {
                                let path = mediaFilePaths[j];
                                let mediaFile = attachmentMap.get(path);
                                if (mediaFile != null) {
                                    let fileType = mediaFile.getFileProperties().getType();
                                    let thumbnail = mediaFile.getFileProperties().thumbnail.ref != null ? mediaFile.getBase64Thumbnail() : "";
                                    entry.mediaFiles.push({path: path, file: mediaFile, fileType: fileType, thumbnail: thumbnail, hasThumbnail: thumbnail.length > 0});
                                }
                            }
                            entry.mediaFilePaths = [];
                        }
                    }
                });
            }
        },
        toBase64Image: function(data) {
            var str = "";
            for (let i = 0; i < data.length; i++) {
                str = str + String.fromCharCode(data[i] & 0xff);
            }
            if (data.byteLength > 0) {
                return "data:image/png;base64," + window.btoa(str);
            }
            return "";
        },
        reduceLoadAllConversationIcons: function(index, items) {
            let that = this;
            if (index < items.length) {
                let item = items[index];
                peergos.shared.user.ProfilePaths.getProfilePhoto(item.participants[0], this.context).thenApply(result => {
                    if (result.ref != null) {
                        Vue.nextTick(function() {
                            item.profileImage = that.toBase64Image(result.ref);
                        });
                    } else {
                        item.profileImageNA = true;
                    }
                    that.reduceLoadAllConversationIconsAsync(index+1, items);
                }).exceptionally(function(throwable) {
                    that.reduceLoadAllConversationIconsAsync(index+1, items);
                });
            }
        },
        reduceLoadAllConversationIconsAsync: function(index, items) {
            let that = this;
            let func = function(){
                that.reduceLoadAllConversationIcons(index, items);
            };
            Vue.nextTick(func);
        },
        loadConversationIcons: function(items) {
            //todo this.reduceLoadAllConversationIconsAsync(0, items);
        },
        launchEmojiPicker: function() {
            this.emojiPicker.togglePicker(this.emojiChooserBtn);
        },
        deleteAttachment: function(attachment) {
            let that = this;
            function command(attachment) {
                return that.executeDeleteAttachment(attachment);
            }
            this.drainCommandQueue(() => command(attachment));
        },
        executeDeleteAttachment: function(attachment) {
            let that = this;
            this.spinner(true);
            let future = peergos.shared.util.Futures.incomplete();
            this.deleteFile(attachment).thenApply(function(res){
                that.spinner(false);
                if (res) {
                    let idx = that.attachmentList.findIndex(v => v.mediaItem.path === attachment.mediaItem.path);
                    if (idx > -1) {
                        that.attachmentList.splice(idx, 1);
                    }
                }
                return future.complete(true);
            });
            return future;
        },
        deleteFile: function(attachment) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            if (attachment == null) {
                future.complete(true);
            } else {
                let filePathStr = attachment.mediaItem.path;
                let filePath = this.convertToPath(filePathStr);
                let parentPath = filePathStr.substring(0, filePathStr.lastIndexOf('/'));
                this.context.getByPath(parentPath).thenApply(function(optParent){
                    attachment.mediaFile.remove(optParent.get(), filePath, that.context).thenApply(function(b){
                        future.complete(true);
                    }).exceptionally(function(throwable) {
                        console.log(throwable);
                        that.showMessage("error deleting attachment");
                        future.complete(false);
                    });
                }).exceptionally(function(throwable) {
                    console.log(throwable);
                    that.showMessage("error finding attachment");
                    future.complete(false);
                });
            }
            return future;
        },
        deleteReply: function() {
            this.replyToMessage = null;
            this.newMessageText = "";
        },
        reply: function(message) {
            if (message.sendTime.length == 0) {
                return;
            }
            this.replyToMessage = message;
            this.editMessage = null;
            this.focus();
        },
        deleteEdit: function() {
            this.editMessage = null;
            this.newMessageText = "";
        },
        edit: function(message) {
            if (message.sendTime.length == 0) {
                return;
            }
            this.replyToMessage = null;
            this.editMessage = message;
            this.newMessageText = message.contents;
            this.focus();
        },
        focus: function(message) {
            Vue.nextTick(function() {
                document.getElementById("message-input").focus();
            });
        },
        profile: function(conversation) {
            this.displayProfile(conversation.participants[0], false);
        },
        launchUploadDialog: function() {
            document.getElementById('uploadInput').click();
        },
        dndChatDrop: function(evt) {
            evt.preventDefault();
            if (this.selectedConversationId == null) {
                this.showMessage("Select chat before adding media");
                return;
            }
            let entries = evt.dataTransfer.items;
            for(var i=0; i < entries.length; i++) {
                let entry = entries[i].webkitGetAsEntry();
                if (entry.isDirectory || !entry.isFile) {
                    this.showMessage("Only files can be dragged and dropped");
                    return;
                }
            }
            this.uploadAttachments(evt.dataTransfer.files, this.selectedConversationId);
        },
        isViewableMediaType: function(mediaItem) {
            if (mediaItem.fileType == 'image' || mediaItem.fileType == 'audio' || mediaItem.fileType == 'video') {
                return true;
            }
            return false;
        },
        view: function (message, mediaIndex) {
            let mediaList = message.mediaFiles;
            let currentMediaItem = mediaList[mediaIndex];
            if (this.isViewableMediaType(currentMediaItem)) {
                let files = [];
                for(var i = mediaIndex; i < mediaList.length; i++) {
                    if (this.isViewableMediaType(mediaList[i])) {
                        files.push(mediaList[i].file);
                    }
                }
                for(var j = 0; j < mediaIndex; j++) {
                    if (this.isViewableMediaType(mediaList[j])) {
                        files.push(mediaList[j].file);
                    }
                }
                this.filesToViewInGallery = files;
                this.showEmbeddedGallery = true;
            } else if(currentMediaItem.fileType == 'calendar'){
                this.importCalendarFile(false, currentMediaItem.file);
            } else {
                let slash = currentMediaItem.path.lastIndexOf('/');
                let dir = currentMediaItem.path.substring(0, slash);
                let filename = currentMediaItem.path.substring(slash +1);
                if(currentMediaItem.fileType == 'pdf' || currentMediaItem.fileType == 'text'){
                    this.viewAction(dir, filename);
                } else {
                    this.downloadFile(currentMediaItem.file);
                }
            }
        },
        uploadMedia: function(mediaFile, updateProgressBar, conversationId) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let reader = new browserio.JSFileReader(mediaFile);
            let java_reader = new peergos.shared.user.fs.BrowserFileReader(reader);
            if (mediaFile.size > 200 * 1024 * 1024) {
                that.showMessage("Media file greater than 200 MiB not currently supported!", "Instead, you can upload a larger file to your drive and share it with a secret link here");
                future.complete(null);
            } else {
                let fileExtension = "";
                let dotIndex = mediaFile.name.lastIndexOf('.');
                if (dotIndex > -1 && dotIndex <= mediaFile.name.length -1) {
                    fileExtension = mediaFile.name.substring(dotIndex + 1);
                }
                let postTime = peergos.client.JsUtil.now();
                let chatController = this.allChatControllers.get(conversationId);
                this.messenger.uploadMedia(chatController.controller, java_reader, fileExtension, mediaFile.size, postTime, updateProgressBar).thenApply(function(pair) {
                    var thumbnailAllocation = Math.min(100000, mediaFile.size / 10);
                    updateProgressBar({ value_0: thumbnailAllocation});
                    that.context.getByPath(pair.right.path).thenApply(function(fileOpt){
                        let file = fileOpt.ref;
                        future.complete({mediaItem: pair.right, mediaFile: file});
                    }).exceptionally(err => {
                        that.showMessage("unable to get uploaded media");
                        console.log(err);
                        future.complete(null);
                    });
                }).exceptionally(err => {
                    that.showMessage("unable to upload media");
                    console.log(err);
                    future.complete(null);
                });
            }
            return future;
        },
        uploadAllAttachments: function(files, conversationId) {
            let that = this;
            function command(files, conversationId) {
                return that.executeUploadAllAttachments(files, conversationId);
            }
            this.drainCommandQueue(() => command(files, conversationId));
        },
        executeUploadAllAttachments: function(files, conversationId) {
            let future = peergos.shared.util.Futures.incomplete();
            let progressBars = [];
            for(var i=0; i < files.length; i++) {
                let mediaFile = files[i];
                var thumbnailAllocation = Math.min(100000, mediaFile.size / 10);
                var resultingSize = mediaFile.size + thumbnailAllocation;
                var progress = {
                    show:true,
                    title:"Encrypting and uploading " + mediaFile.name,
                    done:0,
                    max:resultingSize
                };
                this.progressMonitors.push(progress);
                progressBars.push(progress);
            }
            this.reduceUploadAllAttachments(0, files, progressBars, future, conversationId);
            return future;
        },
        reduceUploadAllAttachments: function(index, files, progressBars, future, conversationId) {
            let that = this;
            if (index == files.length) {
                document.getElementById('uploadInput').value = "";
                future.complete(true);
            } else {
                let mediaFile = files[index];
                let progress = progressBars[index];
                this.uploadFile(mediaFile, progress, conversationId).thenApply(function(res){
                    if (res) {
                        that.reduceUploadAllAttachments(++index, files, progressBars, future, conversationId);
                    } else {
                        future.complete(false);
                    }
                });
            }
            return future;
        },
        addAttachments: function(evt) {
            if (this.selectedConversationId == null ) {
                return;
            }
            let files = evt.target.files || evt.dataTransfer.files;
            this.uploadAttachments(files, this.selectedConversationId);
        },
        uploadAttachments: function(files, conversationId) {
            let totalSize = 0;
            for(var i=0; i < files.length; i++) {
                totalSize += files[i].size;
            }
            let that = this;
            for(var i=0; i < that.attachmentList.length; i++) {
                totalSize += that.attachmentList[i].mediaFile.getFileProperties().sizeLow();
            }
            let spaceAfterOperation = this.checkAvailableSpace(totalSize);
            if (spaceAfterOperation < 0) {
                document.getElementById('uploadInput').value = "";
                that.showMessage("Attachment(s) exceeds available Space",
                    "Please free up " + this.convertBytesToHumanReadable('' + -spaceAfterOperation) + " and try again");
            } else {
                this.uploadAllAttachments(files, conversationId);
            }
        },
        uploadFile: function(mediaFile, progress, conversationId) {
            let future = peergos.shared.util.Futures.incomplete();
            let that = this;
            let updateProgressBar = function(len){
                progress.done += len.value_0;
                if (progress.done >= progress.max) {
                    progress.show = false;
                }
            };
            this.uploadMedia(mediaFile, updateProgressBar, conversationId).thenApply(function(mediaResponse) {
                if (mediaResponse == null) {
                    future.complete(false);
                } else {
                    that.attachmentList.push(mediaResponse);
                    let idx = that.progressMonitors.indexOf(progress);
                    if(idx >= 0) {
                        that.progressMonitors.splice(idx, 1);
                    }
                    future.complete(true);
                }
            });
            return future;
        },
        displayTitle: function(conversation) {
            return this.truncateText(conversation.title, 15);
        },
        filterConversations: function() {
            this.buildConversations();
        },
        updateMessageThreads: function (allChats) {
            for(var i = 0; i < allChats.length; i++) {
                let messagePairs = allChats[i].messagePairs;
                let attachmentMap = allChats[i].attachmentMap;
                this.updateMessageThread(allChats[i].conversationId, messagePairs, attachmentMap);
            }
        },
        isInList: function(list, value) {
            return list.findIndex(v => v == value) > -1;
        },
        updateMessageThread: function (conversationId, messagePairs, attachmentMap) {
            let messageThread = this.allMessageThreads.get(conversationId);
            var hashToIndex = this.allThreadsHashToIndex.get(conversationId);
            if (hashToIndex == null) {
                hashToIndex = new Map();
                this.allThreadsHashToIndex.set(conversationId, hashToIndex);
            }
            let chatController = this.allChatControllers.get(conversationId);
            let conversation = this.allConversations.get(conversationId);
            let currentAdmins = conversation.currentAdmins;
            let currentMembers = conversation.currentMembers;
            for(var j = 0; j < messagePairs.length; j++) {
                let chatEnvelope = messagePairs[j].message;
                let messageHash = messagePairs[j].hash;
                let payload = chatEnvelope.payload;
                let type = payload.type().toString();
                let author = chatController.controller.getUsername(chatEnvelope.author);
                if (!this.isInList(currentMembers, author)) {
                    break;
                }
                if (type == 'GroupState') {//type
                    if (!this.isInList(currentAdmins, author)) {
                        break;
                    }
                    if(payload.key == "title") {
                        messageThread.push(this.createStatusMessage(chatEnvelope.creationTime, "Chat name changed to " + payload.value));
                        let conversation = this.allConversations.get(conversationId);
                        conversation.title = payload.value;
                    } else if(payload.key == "admins") {
                        messageThread.push(this.createStatusMessage(chatEnvelope.creationTime, "Chat admins changed to " + payload.value));
                        let conversation = this.allConversations.get(conversationId);
                        currentAdmins = payload.value.split(",");
                    }
                } else if(type == 'Invite') {
                    let username = chatEnvelope.payload.username;
                    messageThread.push(this.createStatusMessage(chatEnvelope.creationTime, author + " invited " + username));
                    currentMembers.push(username);
                } else if(type == 'RemoveMember') {
                    let username = chatController.controller.getUsername(chatEnvelope.payload.memberToRemove);
                    messageThread.push(this.createStatusMessage(chatEnvelope.creationTime, author + " removed " + username));
                    currentMembers.splice(currentMembers.findIndex(v => v === username), 1);
                } else if(type == 'Join') {
                    let username = chatEnvelope.payload.username;
                    messageThread.push(this.createStatusMessage(chatEnvelope.creationTime, username + " joined the chat"));
                } else if(type == 'Application') {
                    let appMsg = this.createMessage(author, chatEnvelope, payload.body.toArray(), attachmentMap, null);
                    let appMsgKey = this.msgKey(appMsg);
                    let draftMessageIndex = this.draftMessages.findIndex(v => v.key == appMsgKey);
                    if (draftMessageIndex > -1) {
                        let messageThreadIndex = this.draftMessages[draftMessageIndex].index;
                        messageThread[messageThreadIndex] = appMsg;
                        this.draftMessages.splice(draftMessageIndex, 1);
                        hashToIndex.set(messageHash, messageThreadIndex);
                    } else {
                        hashToIndex.set(messageHash, messageThread.length);
                        messageThread.push(appMsg);
                    }
                } else if(type == 'Edit') {
                    let messageIndex = hashToIndex.get(payload.priorVersion.toString());
                    let message = messageThread[messageIndex];
                    if (author == message.sender) {
                        message.contents = payload.content.body.toArray()[0].inlineText();
                        message.edited = true;
                    }
                } else if(type == 'Delete') {
                    let messageIndex = hashToIndex.get(payload.target.toString());
                    let message = messageThread[messageIndex];
                    if (author == message.sender) {
                        message.contents = "[Message Deleted]";
                        message.deleted = true;
                        message.mediaFiles = [];
                        message.mediaFilePaths = [];
                        message.file = null;
                    }
                } else if(type == 'ReplyTo') {
                    let parentRef = payload.parent;
                    let messageIndex = hashToIndex.get(parentRef.toString());
                    let parentMessage = messageThread[messageIndex];
                    let appMsg = this.createMessage(author, chatEnvelope, payload.content.body.toArray(), attachmentMap, parentMessage);
                    let appMsgKey = this.msgKey(appMsg);
                    let draftMessageIndex = this.draftMessages.findIndex(v => v.key == appMsgKey);
                    if (draftMessageIndex > -1) {
                        let messageThreadIndex = this.draftMessages[draftMessageIndex].index;
                        messageThread[messageThreadIndex] = appMsg;
                        this.draftMessages.splice(draftMessageIndex, 1);
                        hashToIndex.set(messageHash, messageThreadIndex);
                    } else {
                        hashToIndex.set(messageHash, messageThread.length);
                        messageThread.push(appMsg);
                    }
                }
            }
        },
        decodeLatestMessage: function (message) {
            let chatEnvelope = message;
            let payload = chatEnvelope.payload;
            let type = payload.type().toString();
            let author = chatController.controller.getUsername(chatEnvelope.author);
            if (type == 'GroupState') {//type
                if(payload.key == "title") {
                    return "Chat name changed to " + payload.value;
                } else if(payload.key == "admins") {
                    return "Chat admins changed to " + payload.value;
                }
            } else if(type == 'Invite') {
                let username = chatEnvelope.payload.username;
                return author + " invited " + username;
            } else if(type == 'RemoveMember') {
                let username = chatController.controller.getUsername(chatEnvelope.payload.memberToRemove);
                return author + " removed " + username;
            } else if(type == 'Join') {
                let username = chatEnvelope.payload.username;
                return username + " joined the chat";
            } else if(type == 'Application') {
                return payload.body.toArray()[0].inlineText();
            } else if(type == 'Edit') {
                return payload.content.body.toArray()[0].inlineText();
            } else if(type == 'Delete') {
                return "[Message Deleted]";
            } else if(type == 'ReplyTo') {
                return payload.content.body.toArray()[0].inlineText();
            }
        },
        msgKey: function(msg) {
            if (msg == null) {
                return null;
            }
            let mediaPaths = [];
            for(var i = 0; i < msg.mediaFiles.length; i++) {
                mediaPaths.push(msg.mediaFiles[i].path);
            }
            let key = { mediaPaths: mediaPaths,
                        sender: msg.sender, contents: msg.contents
                        , parentMessage: this.msgKey(msg.parentMessage)};
            return JSON.stringify(key);
        },
        updateScrollPane: function(forceUpdate) {
           if (forceUpdate) {
               Vue.nextTick(function() {
                    let scrollArea = document.getElementById("message-scroll-area");
                    scrollArea.scrollTop = scrollArea.scrollHeight;
               });
           }
        },
        spinner: function(val) {
            this.showSpinner = val;
        },
        fullRefresh: function() {
            this.init(true, false);
        },
        init: function(updateSpinner, periodicInit) {
            let that = this;
            function command(updateSpinner, periodicInit) {
                return that.executeInit(updateSpinner, periodicInit);
            }
            this.drainCommandQueue(() => command(updateSpinner, periodicInit));
        },
        setupAutomaticRefresh: function() {
            if (this.closedChat) {
                return;
            }
            let that = this;
            let intervalFunc = function() {
                console.log("full refresh");
                that.init(false, true);
            };
            setTimeout(intervalFunc, 30 * 1000);
        },
        executeInit: function(updateSpinner, periodicInit) {
            let future = peergos.shared.util.Futures.incomplete();
            if (this.closedChat) {
                future.complete(false);
                return future;
            }
            var that = this;
            if (updateSpinner) {
                this.spinner(true);
            }

            this.messenger.listChats().thenApply(function(chats) {
                let allChats = chats.toArray();
                if (!that.isInitialised) {
                    that.isInitialised = true;
                    that.initialiseChats(allChats);
                    that.buildConversations();
                }
                if(that.selectedConversationId == null && that.conversations.length > 0){
                    that.selectedConversationId = that.conversations[0].id;
                }
                let conversationId = that.selectedConversationId;

                that.loadChatMessages(allChats).thenApply(function(allChats) {
                    that.updateMessageThreads(allChats);
                    that.buildConversations();
                    that.buildMessageThread(conversationId);
                    if (conversationId != null) {
                        that.updateScrollPane(updateSpinner);
                    }
                    if (updateSpinner) {
                        that.spinner(false);
                    }
                    if (periodicInit) {
                        that.setupAutomaticRefresh();
                    }
                    future.complete(true);
                });
            }).exceptionally(err => {
                if (updateSpinner) {
                    that.spinner(false);
                }
                if (that.messages.length == 0) {
                    that.showMessage("Unable to list chats. Lost network connectivity?");
                }
                console.log(err);
                if (periodicInit) {
                    that.setupAutomaticRefresh();
                }
                future.complete(false);
            });
            return future;
        },
        generateMessageHashes: function(chatController, messages) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let messagePairs = [];
            if (messages.length == 0) {
                future.complete(messagePairs);
            } else {
                messages.forEach(message => {
                    chatController.controller.generateHash(message).thenApply(messageRef => {
                        messagePairs.push({message: message, hash: messageRef.toString()});
                        if(messagePairs.length == messages.length) {
                            future.complete(messagePairs);
                        }
                    });
                });
            }
            return future;
        },
        checkChatState: function(conversation) {
            let chatOwner = this.extractChatOwner(conversation.id);
            if (chatOwner != this.context.username && !conversation.readonly && ! this.chatVisibilityWarningDisplayed) {
                let participants = conversation.participants;
                let friendsInChat = this.friendnames.filter(friend => participants.findIndex(v => v === friend) > -1);
                if (friendsInChat.length == 0) {
                    this.chatVisibilityWarningDisplayed = true;
                    this.showMessage("Chat no longer contains any of your friends. Your messages will not be seen by others");
                }
            }
        },
        refreshConversation: function(conversationId) {
            var that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let chatController = this.allChatControllers.get(conversationId);
            that.messenger.mergeAllUpdates(chatController.controller, this.socialState).thenApply(latestController => {
                chatController.controller = latestController;
                let origParticipants = latestController.getMemberNames().toArray();
                let participants = that.removeSelfFromParticipants(origParticipants);
                let conversation = that.allConversations.get(conversationId);
                conversation.participants = participants;
                conversation.readonly = origParticipants.length == participants.length;
                that.checkChatState(conversation);
                if (participants.length == 1) {
                    conversation.profileImageNA = false;
                }
                if (conversation.readonly) {
                    that.buildConversations();
                    that.buildMessageThread(conversationId);
                    future.complete(false);
                } else {
                    that.retrieveChatMessages(chatController, true).thenApply(messages => {
                        that.updateMessageThread(conversationId, messages.messagePairs, messages.attachmentMap);
                        that.buildConversations();
                        that.buildMessageThread(conversationId);
                        that.updateScrollPane(true);
                        future.complete(true);
                    });
                }
            }).exceptionally(function(throwable) {
                console.log(throwable.toString());
                future.complete(false);
            });
            return future;
        },
        removeConversation: function(conversationId) {
            let that = this;
            let conversation = this.allConversations.get(conversationId);
            let title = conversation.title;
            function command(conversationId) {
                return that.executeDeleteConversation(conversationId);
            }
            this.confirmDeleteConversation(title,
                () => { that.showConfirm = false;
                    that.drainCommandQueue(() => command(conversationId));
                },
                () => { that.showConfirm = false;}
            );
        },
        executeDeleteConversation: function(conversationId) {
            let that = this;
            this.spinner(true);
            let future = peergos.shared.util.Futures.incomplete();
            let chatController = this.allChatControllers.get(conversationId);
            this.messenger.deleteChat(chatController.controller).thenApply(res => {
                that.allMessageThreads.set(conversationId, []);
                that.allMessageThreads.delete(conversationId);
                that.allThreadsHashToIndex.delete(conversationId);
                that.allChatControllers.delete(conversationId);
                that.allConversations.delete(conversationId);
                if (conversationId == that.selectedConversationId) {
                    that.selectedConversationId = null;
                    that.buildMessageThread();
                    that.buildConversations();
                }
                that.spinner(false);
                future.complete(true);
            }).exceptionally(function(throwable) {
                console.log(throwable);
                that.showMessage("error deleting chat");
                future.complete(false);
            });
            return future;
        },
        confirmDeleteConversation: function(title, deleteConversationFunction, cancelFunction) {
            this.confirm_message='Are you sure you want to delete the Chat: ' + title + ' ?';
            this.confirm_body='';
            this.confirm_consumer_cancel_func = cancelFunction;
            this.confirm_consumer_func = deleteConversationFunction;
            this.showConfirm = true;
        },
        reduceGetAllMessages: function(chatController, messages, future) {
            let that = this;
            let startIndex = chatController.startIndex;
            chatController.controller.getMessages(startIndex, startIndex + 1000).thenApply(result => {
                let newMessages = result.toArray();
                chatController.startIndex += newMessages.length;
                if (newMessages.length < 1000) {
                    future.complete(messages.concat(newMessages));
                } else {
                    that.reduceGetAllMessages(chatController, messages.concat(newMessages), future);
                }
            }).exceptionally(err => {
                if(that.messages.length == 0) {
                    that.showMessage("Unable to retrieve messages. Lost network connectivity?");
                }
                console.log(err);
                future.complete(messages);
            });
        },
        getAllMessages: function(chatController) {
            let future = peergos.shared.util.Futures.incomplete();
            this.reduceGetAllMessages(chatController, [], future);
            return future;
        },
        close: function () {
            this.closedChat = true;
            if (this.emojiPicker != null) {
                try {
                this.emojiPicker.hidePicker();
                } catch(ex) {
                    //just means it is not open
                }
            }
            window.removeEventListener("resize", this.resizeHandler);
            this.closeChatViewer();
        },
        truncateText: function(text, length) {
            return  text.length > length ? text.substring(0,length -3) + '...' : text;
        },
        getExistingConversationTitles: function() {
            let existingGroups = [];
            this.conversations.forEach(conversation => {
                existingGroups.push(conversation.title);
            });
            return existingGroups;
        },
        extractAddedParticipants: function(origParticipants, updatedParticipants) {
            let addedParticipants = [];
            updatedParticipants.forEach(member => {
                let index = origParticipants.findIndex(v => v === member);
                if (index == -1) {
                    addedParticipants.push(member);
                }
            });
            return addedParticipants;
        },
        extractRemovedParticipants: function(origParticipants, updatedParticipants) {
            let removedParticipants = [];
            let copyOfOrigParticipants = origParticipants.slice();
            copyOfOrigParticipants.forEach(member => {
                let index = updatedParticipants.findIndex(v => v === member);
                if (index == -1) {
                    removedParticipants.push(member);
                }
            });
            return removedParticipants;
        },
        updatedGroupMembership: function(conversationId, updatedGroupTitle, updatedMembers, updatedAdmins, haveRemovedSelf) {
            let that = this;
            function command(conversationId, updatedGroupTitle, updatedMembers, updatedAdmins, haveRemovedSelf) {
                return that.executeUpdatedGroupMembership(conversationId, updatedGroupTitle, updatedMembers, updatedAdmins, haveRemovedSelf);
            }
            this.drainCommandQueue(() => command(conversationId, updatedGroupTitle, updatedMembers, updatedAdmins, haveRemovedSelf));
        },
        executeUpdatedGroupMembership: function(conversationId, updatedGroupTitle, updatedMembers, updatedAdmins, haveRemovedSelf) {
            let that = this;
            let conversation = this.allConversations.get(conversationId);
            this.spinner(true);
            let future = peergos.shared.util.Futures.incomplete();
            if (conversation == null) {
                this.spinnerMessage = "Creating new chat";
                this.messenger.createChat().thenApply(function(controller){
                    let conversationId = controller.chatUuid;
                    that.allChatControllers.set(controller.chatUuid,
                        {controller: controller, owner: that.context.username, startIndex: 0, pendingAttachmentRefs: []});
                    let item = {id: conversationId, title: updatedGroupTitle, participants: updatedMembers
                        , readonly: false, currentAdmins: [that.context.username], currentMembers: [that.context.username]
                        , hasUnreadMessages: false};
                    if (updatedMembers.length == 1) {
                        item.profileImageNA = false;
                    }
                    that.allConversations.set(conversationId, item);
                    that.allMessageThreads.set(conversationId, []);

                    let addedAdmins = that.extractAddedParticipants(controller.getAdmins().toArray(), updatedAdmins);

                    that.changeTitle(conversationId, updatedGroupTitle).thenApply(function(res1) {
                        that.inviteNewParticipants(conversationId, updatedMembers).thenApply(function(res2) {
                            that.inviteNewAdmins(conversationId, addedAdmins).thenApply(function(res3) {
                                that.spinnerMessage = "";
                                that.initialConversation(conversationId).thenApply(function(res4) {
                                    that.spinner(false);
                                    future.complete(true);
                                });
                            });
                        });
                    });
                }).exceptionally(err => {
                    that.showMessage("Unable to create chat");
                    that.spinner(false);
                    console.log(err);
                    future.complete(false);
                });
            } else {
                if (updatedMembers.length == 1) {
                    conversation.profileImageNA = false;
                }
                let added = this.extractAddedParticipants(conversation.participants, updatedMembers);
                let removed = this.extractRemovedParticipants(conversation.participants, updatedMembers);
                if (haveRemovedSelf) {
                    removed.push(this.context.username);
                }
                let chatController = this.allChatControllers.get(conversationId);
                let existingAdmins = chatController.controller.getAdmins().toArray();
                let addedAdmins = this.extractAddedParticipants(existingAdmins, updatedAdmins);
                let removedAdmins = this.extractRemovedParticipants(existingAdmins, updatedAdmins);


                conversation.participants = updatedMembers.slice();
                that.inviteNewParticipants(conversationId, added).thenApply(function(res1) {
                    that.unInviteParticipants(conversationId, removed).thenApply(function(res2) {
                        that.inviteNewAdmins(conversationId, addedAdmins).thenApply(function(res3) {
                            that.removeAdmins(conversationId, removedAdmins).thenApply(function(res4) {
                                that.spinnerMessage = "";
                                if (conversation.title != updatedGroupTitle) {
                                    conversation.title = updatedGroupTitle;
                                    that.changeTitle(conversationId, updatedGroupTitle).thenApply(function(res5) {
                                        that.refreshConversation(conversationId).thenApply(function(res6) {
                                            that.spinner(false);
                                            future.complete(true);
                                        });
                                    });
                                } else {
                                    that.refreshConversation(conversationId).thenApply(function(res3) {
                                        that.spinner(false);
                                        future.complete(true);
                                    });
                                }
                            });
                        });
                    });
                });
            }
            return future;
        },
        initialConversation: function(conversationId) {
            var that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let chatController = this.allChatControllers.get(conversationId);
            this.retrieveChatMessages(chatController, false).thenApply(messages => {
                that.updateMessageThread(conversationId, messages.messagePairs, messages.attachmentMap);
                that.buildConversations();
                that.buildMessageThread(conversationId);
                that.updateScrollPane(true);
                future.complete(true);
            });
            return future;
        },
        newConversation: function() {
            let that = this;
            that.groupId = "";
            that.groupTitle = "New Chat";
            that.friendNames = that.friendnames;
            that.messages = that.messages;
            that.existingGroups = that.getExistingConversationTitles();
            this.existingGroupMembers = [];
            this.existingAdmins = [this.context.username];
            that.showGroupMembership = true;
        },
        editCurrentConversation: function() {
            if (this.selectedConversationId == null) {
                return;
            }
            let conversation = this.allConversations.get(this.selectedConversationId);
            if (conversation != null) {
                this.groupId = this.selectedConversationId;
                this.groupTitle = conversation.title;
                this.friendNames = this.friendnames;
                this.messages = this.messages;
                this.existingGroups = this.getExistingConversationTitles();
                this.existingGroupMembers = conversation.participants.slice();
                let chatController = this.allChatControllers.get(this.selectedConversationId);
                this.existingAdmins = chatController.controller.getAdmins().toArray();
                this.showGroupMembership = true;
            }
        },
        confirmDeleteMessage: function(deleteMessageFunction, cancelFunction) {
            this.confirm_message='Are you sure you want to delete the message?';
            this.confirm_body='';
            this.confirm_consumer_cancel_func = cancelFunction;
            this.confirm_consumer_func = deleteMessageFunction;
            this.showConfirm = true;
        },
        deleteMessage: function(message) {
            if (message.sendTime.length == 0) {
                return;
            }
            let that = this;
            if (message.sender != this.context.username) {
                return;
            }
            let conversationId = this.selectedConversationId;
            this.confirmDeleteMessage(
                () => { that.showConfirm = false;
                    that.deleteChatMessage(message, conversationId);
                },
                () => { that.showConfirm = false;}
            );
        },
        convertToPath: function(dir) {
            let dirWithoutLeadingSlash = dir.startsWith("/") ? dir.substring(1) : dir;
            return peergos.client.PathUtils.directoryToPath(dirWithoutLeadingSlash.split('/'));
        },
        isConversationSelected: function (conversation) {
            return this.selectedConversationId == conversation.id;
        },
        getFileSize: function(props) {
                var low = props.sizeLow();
                if (low < 0) low = low + Math.pow(2, 32);
                return low + (props.sizeHigh() * Math.pow(2, 32));
        },
        getPublicKeyHashes: function(usernames) {
            let that = this;
            const usernameToPKH = new Map();
            let future = peergos.shared.util.Futures.incomplete();
            usernames.forEach(username => {
                that.context.getPublicKeys(username).thenApply(pkOpt => {
                    usernameToPKH.set(username, pkOpt.get().left);
                    if(usernameToPKH.size == usernames.length) {
                        let pkhs = [];
                        usernames.forEach(user => {
                            pkhs.push(usernameToPKH.get(user));
                        });
                        future.complete(peergos.client.JsUtil.asList(pkhs));
                    }
                });
            });
            return future;
        },
        inviteNewParticipants: function(conversationId, updatedMembers) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            if (updatedMembers.length == 0) {
                future.complete(true);
            } else {
                let chatController = this.allChatControllers.get(conversationId);
                let usernames = peergos.client.JsUtil.asList(updatedMembers);
                this.spinnerMessage = "adding participant(s) to chat";
                this.getPublicKeyHashes(updatedMembers).thenApply(pkhList => {
                    that.messenger.invite(chatController.controller, usernames, pkhList).thenApply(updatedController => {
                        chatController.controller = updatedController;
                        future.complete(true);
                    }).exceptionally(err => {
                        that.showMessage("Unable to add members to chat");
                        console.log(err);
                        future.complete(false);
                    });
                });
            }
            return future;
        },
        reduceRemovingInvitations: function(conversationId, membersToRemove, index, future) {
            let that = this;
            if (index == membersToRemove.length) {
                future.complete(true);
            } else {
                let username = membersToRemove[index];
                let chatController = this.allChatControllers.get(conversationId);
                this.spinnerMessage = "removing " + username + " from chat";
                this.messenger.removeMember(chatController.controller, username).thenApply(updatedController => {
                    that.spinnerMessage = "";
                    chatController.controller = updatedController;
                    that.reduceRemovingInvitations(conversationId, membersToRemove, ++index, future);
                }).exceptionally(function(throwable) {
                    that.spinnerMessage = "";
                    console.log(throwable);
                    that.showMessage("Unable to remove " + username + " from chat");
                    that.reduceRemovingInvitations(conversationId, membersToRemove, ++index, future);
                });
            }
            return future;
        },
        unInviteParticipants: function(conversationId, membersToRemove) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            this.reduceRemovingInvitations(conversationId, membersToRemove, 0, future);

            let future2 = peergos.shared.util.Futures.incomplete();
            future.thenApply(done => {
                future2.complete(true);
            });
            return future2;
        },
        reduceAddingAdmins: function(conversationId, adminsToAdd, index, future) {
            let that = this;
            if (index == adminsToAdd.length) {
                future.complete(true);
            } else {
                let username = adminsToAdd[index];
                let chatController = this.allChatControllers.get(conversationId);
                this.spinnerMessage = "adding " + username + " as chat admin";
                chatController.controller.addAdmin(username).thenApply(updatedController => {
                    that.spinnerMessage = "";
                    chatController.controller = updatedController;
                    that.reduceAddingAdmins(conversationId, adminsToAdd, ++index, future);
                }).exceptionally(function(throwable) {
                    that.spinnerMessage = "";
                    console.log(throwable);
                    that.showMessage("Unable to add " + username + " as chat admin");
                    that.reduceAddingAdmins(conversationId, adminsToAdd, ++index, future);
                });
            }
            return future;
        },
        inviteNewAdmins: function(conversationId, adminsToAdd) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            this.reduceAddingAdmins(conversationId, adminsToAdd, 0, future);

            let future2 = peergos.shared.util.Futures.incomplete();
            future.thenApply(done => {
                future2.complete(true);
            });
            return future2;
        },
        reduceRemovingAdmins: function(conversationId, adminsToRemove, index, future) {
            let that = this;
            if (index == adminsToRemove.length) {
                future.complete(true);
            } else {
                let username = adminsToRemove[index];
                let chatController = this.allChatControllers.get(conversationId);
                this.spinnerMessage = "removing " + username + " as chat admin";
                chatController.controller.removeAdmin(username).thenApply(updatedController => {
                    that.spinnerMessage = "";
                    chatController.controller = updatedController;
                    that.reduceRemovingAdmins(conversationId, adminsToRemove, ++index, future);
                }).exceptionally(function(throwable) {
                    that.spinnerMessage = "";
                    console.log(throwable);
                    that.showMessage("Unable to remove " + username + " as chat admin");
                    that.reduceRemovingAdmins(conversationId, adminsToRemove, ++index, future);
                });
            }
            return future;
        },
        removeAdmins: function(conversationId, adminsToRemove) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            this.reduceRemovingAdmins(conversationId, adminsToRemove, 0, future);

            let future2 = peergos.shared.util.Futures.incomplete();
            future.thenApply(done => {
                future2.complete(true);
            });
            return future2;
        },
        removeSelfFromParticipants: function(participants) {
            let copyOfParticipants = participants.slice();
            let selfIndex = copyOfParticipants.findIndex(v => v === this.context.username);
            if (selfIndex > -1) {
                copyOfParticipants.splice(selfIndex, 1);
            }
            return copyOfParticipants;
        },
        extractChatOwner: function(chatUuid) {
            let withoutPrefix = chatUuid.substring(5);//chat:
            return withoutPrefix.substring(0,withoutPrefix.indexOf(":"));
        },
        initialiseChats: function(controllers) {
            let that = this;
            controllers.forEach(controller => {
                let chatOwner = this.extractChatOwner(controller.chatUuid);
                chatController = {controller:controller, startIndex: 0, owner: chatOwner, pendingAttachmentRefs: []};
                that.allChatControllers.set(controller.chatUuid, chatController);
                that.allMessageThreads.set(controller.chatUuid, []);
                let origParticipants = controller.getMemberNames().toArray();
                let participants = that.removeSelfFromParticipants(origParticipants);

                let conversation = {id: controller.chatUuid, participants: participants, readonly: origParticipants.length == participants.length
                    , title: controller.getTitle(), currentAdmins: [chatOwner], currentMembers: [chatOwner], hasUnreadMessages: false};
                if (participants.length == 1) {
                    conversation.profileImageNA = false;
                }
                let recentMessages = controller.getRecent().toArray();
                let latestMessage = recentMessages.length == 0 ? null : recentMessages[recentMessages.length-1];
                if (latestMessage != null) {
                    conversation.blurb = that.decodeLatestMessage(latestMessage);
                    conversation.lastModified = that.fromUTCtoLocal(latestMessage.creationTime);
                } else {
                    conversation.blurb = "";
                    conversation.lastModified = "";
                }
                that.allConversations.set(controller.chatUuid, conversation);
            });
        },
        readChatMessages: function(controller) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let chatController = this.allChatControllers.get(controller.chatUuid);
            let conversation = this.allConversations.get(controller.chatUuid);
            that.messenger.mergeAllUpdates(controller, this.socialState).thenApply(updatedController => {
                chatController.controller = updatedController;
                let origParticipants = updatedController.getMemberNames().toArray();
                let participants = that.removeSelfFromParticipants(origParticipants);
                conversation.participants = participants;
                conversation.readonly = origParticipants.length == participants.length;
                that.checkChatState(conversation);
                if (participants.length == 1) {
                    conversation.profileImageNA = false;
                }
                let firstGet = chatController.startIndex == 0;
                let loadAttachments = controller.chatUuid == that.selectedConversationId;
                that.retrieveChatMessages(chatController, loadAttachments).thenApply(messages => {
                    if (!firstGet && messages.messagePairs.length > 0) {
                        conversation.hasUnreadMessages = true;
                    }
                    future.complete({conversationId: controller.chatUuid, messagePairs: messages.messagePairs
                                    , attachmentMap: messages.attachmentMap});
                });
            }).exceptionally(function(throwable) {
                console.log(throwable.toString());
                future.complete({conversationId: controller.chatUuid, messagePairs: [], attachmentMap: new Map()});
            });
            return future;
        },
        extractOwnerFromPath: function(path) {
            let pathWithoutLeadingSlash = path.startsWith("/") ? path.substring(1) : path;
            return pathWithoutLeadingSlash.substring(0, pathWithoutLeadingSlash.indexOf("/"));
        },
        loadAllAttachments: function(chatController, future) {
            let that = this;
            let attachmentMap = new Map();
            let refs = chatController.pendingAttachmentRefs;
            if (refs.length == 0) {
                future.complete(attachmentMap);
            } else {
                var loadedCount = 0;
                refs.forEach(ref => {
                    let owner = that.extractOwnerFromPath(ref.path);
                    that.context.network.getFile(ref.cap, owner).thenApply(optFile => {
                        loadedCount++;
                        let mediaFile = optFile.ref;
                        if (mediaFile != null) {
                            let fullPath = ref.path.startsWith("/") ? ref.path : "/" + ref.path;
                            attachmentMap.set(fullPath, mediaFile);
                        }
                        if (loadedCount == refs.length) {
                            chatController.pendingAttachmentRefs = [];
                            future.complete(attachmentMap);
                        }
                    }).exceptionally(err => {
                        console.log(err);
                        loadedCount++;
                    });
                });
            }
        },
        loadAttachments: function(chatController) {
            let future = peergos.shared.util.Futures.incomplete();
            this.loadAllAttachments(chatController, future);
            return future;
        },
        addPendingAttachments: function(chatController, messages) {
            let refs = chatController.pendingAttachmentRefs;
            for(var j = 0; j < messages.length; j++) {
                let chatEnvelope = messages[j];
                let payload = chatEnvelope.payload;
                let type = payload.type().toString();
                if (type == 'Application' || type == 'ReplyTo') {
                    let body = type == 'Application' ? payload.body.toArray() : payload.content.body.toArray();
                    if (body.length > 1) {
                        for(var i = 1; i < body.length; i++) {
                            let mediaRef = body[i].reference().ref;
                            if (refs.findIndex(v => v.path == mediaRef.path) == -1) {
                                refs.push(mediaRef);
                            }
                        }
                    }
                }
            }
        },

        retrieveChatMessages: function(chatController, loadAttachments) {
            let future = peergos.shared.util.Futures.incomplete();
            let that = this;
            that.getAllMessages(chatController).thenApply(messages => {
                that.generateMessageHashes(chatController, messages).thenApply(messagePairs => {
                    that.addPendingAttachments(chatController, messages);
                    if (loadAttachments) {
                        that.loadAttachments(chatController).thenApply(attachmentMap => {
                            future.complete({attachmentMap: attachmentMap, messagePairs: messagePairs});
                        });
                    } else {
                        future.complete({attachmentMap: new Map(), messagePairs: messagePairs});
                    }
                });
            });
            return future;
        },
        loadChatMessages: function(chats) {
            let that = this;
            let accumulator = [];
            let future = peergos.shared.util.Futures.incomplete();
            if (chats.length == 0) {
                future.complete(accumulator);
            }
            chats.forEach(chat => {
                that.readChatMessages(chat).thenApply(result => {
                    accumulator.push(result);
                    if (accumulator.length == chats.length) {
                        future.complete(accumulator);
                    }
                });
            });
            return future;
        },
        buildConversations: function() {
            let conversationList = [];
            let conversationIconCandidates = [];
            var newMessageArea = document.getElementById("new-message-id");
            if (this.allConversations.size == 0) {
                newMessageArea.classList.add("chat-hide");
                this.statusMessages = [];
                this.statusMessages.push("Welcome to Peergos Chat!");
                this.statusMessages.push("");
                this.statusMessages.push("");
                this.statusMessages.push("");
                this.statusMessages.push("");
                this.statusMessages.push("");
                this.statusMessages.push("Chat invitations will appear on your news feed");
            } else {
                this.statusMessages = [];
                newMessageArea.classList.remove("chat-hide");
                this.allConversations.forEach((val, key) => {
                    let filterText = this.filterText.toLowerCase();

                    let messageThread = this.allMessageThreads.get(key);
                    let latestMessage = messageThread != null && messageThread.length > 0
                        ? messageThread[messageThread.length -1] : null;

                    var index = this.filterText.length == 0 ? 0
                        : (val.participants.findIndex(v => v.toLowerCase().indexOf(filterText) > -1) || val.title.toLowerCase().indexOf(filterText) > -1);
                    if (index == -1) {
                        index = val.title.toLowerCase().indexOf(filterText);
                    }
                    if (index > -1) {
                        if (latestMessage != null) {
                            val.blurb = latestMessage.contents;
                            val.lastModified = latestMessage.sendTime;
                        }
                        conversationList.push(val);
                    }
                    if (val.participants.length == 1 && val.profileImage == null && !val.profileImageNA) {
                        conversationIconCandidates.push(val);
                    }
                });
            }
            conversationList.sort(function(aVal, bVal){
                return bVal.lastModified.localeCompare(aVal.lastModified)
            });
            this.conversations = conversationList;
            let that = this;
            if (conversationIconCandidates.length > 0) {
                Vue.nextTick(function() {
                    that.loadConversationIcons(conversationIconCandidates);
                });
            }
        },
        formatParticipants: function (participants) {
            let list = participants.join(',');
            return list;
        },
        buildMessageThread: function (conversationId) {
            if (conversationId != null && this.allConversations.get(conversationId) != null) {
                let conversation = this.allConversations.get(conversationId);
                conversation.hasUnreadMessages = false;
                var title = this.truncateText(conversation.title, 20);
                var participants = this.truncateText(this.formatParticipants(conversation.participants), 20);
                if (participants.length > 0) {
                    if (conversation.readonly) {
                        participants = " - " + participants;
                    } else {
                        participants = " - you, " + participants;
                    }
                }
                title = title + participants;
                let that = this;
                that.chatTitle = title;
                that.selectedConversationId = conversationId;
                let currentMessageThread = that.allMessageThreads.get(conversationId);
                if (currentMessageThread != null) {
                    that.messageThread = currentMessageThread.slice();
                } else {
                    that.messageThread = [];
                }
                this.selectedConversationIsReadOnly = conversation.readonly;
            } else {
                this.chatTitle = "";
                this.messageThread = [];
                this.selectedConversationIsReadOnly = true;
            }
        },
        send: function() {
            let that = this;
            let text = this.newMessageText;
            if (text.length == 1 && text == '\n') {
                this.newMessageText = '';
                return;
            }
            let conversationId = this.selectedConversationId;
            let msg = this.attachmentList.length > 0 ?
                peergos.shared.messaging.messages.ApplicationMessage.attachment(text, this.buildAttachmentFileRefList())
                : peergos.shared.messaging.messages.ApplicationMessage.text(text);
            let attachmentMap = new Map();
            for(var i = 0; i < this.attachmentList.length; i++) {
                let path = this.attachmentList[i].mediaItem.path;
                attachmentMap.set(path, this.attachmentList[i].mediaFile);
            }
            let editMessage = this.editMessage;
            let replyToMessage = this.replyToMessage;
            var showProgress = false;
            if (editMessage != null) {
                if (editMessage.envelope == null) {
                    showProgress = true;
                } else {
                    let chatController = this.allChatControllers.get(conversationId);
                    chatController.controller.generateHash(editMessage.envelope).thenApply(messageRef => {
                        var hashToIndex = this.allThreadsHashToIndex.get(conversationId);
                        let messageIndex = hashToIndex.get(messageRef.toString());
                        let messageThread = this.allMessageThreads.get(conversationId);
                        let message = messageThread[messageIndex];
                        message.contents = text;
                        message.edited = true;
                    });
                }
            } else if (replyToMessage != null) {
                if (replyToMessage.envelope == null) {
                    showProgress = true;
                } else {
                    that.draftMessage(conversationId, msg, attachmentMap, replyToMessage);
                }
            } else {
                that.draftMessage(conversationId, msg, attachmentMap, null);
            }
            function command() {
                return that.executeSend(conversationId, editMessage, replyToMessage, msg, showProgress);
            }
            this.drainCommandQueue(() => command());
        },
        executeSend: function(conversationId, editMessage, replyToMessage, message, showProgress) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            if (showProgress) {
                this.spinner(true);
            }
            if (editMessage != null) {
                let chatController = this.allChatControllers.get(conversationId);
                chatController.controller.generateHash(editMessage.envelope).thenApply(messageRef => {
                    let edit = new peergos.shared.messaging.messages.EditMessage(messageRef, message);
                    that.sendMessage(conversationId, edit).thenApply(res => {
                        that.refreshConversation(conversationId).thenApply(res2 => {
                            if (showProgress) {
                                that.spinner(false);
                            }
                            future.complete(true);
                        });
                    });
                });
            } else if (replyToMessage != null) {
                peergos.shared.messaging.messages.ReplyTo.build(replyToMessage.envelope, message, this.context.crypto.hasher).thenApply(function(replyTo) {
                    that.sendMessage(conversationId, replyTo).thenApply(res => {
                        that.refreshConversation(conversationId).thenApply(res2 => {
                            if (showProgress) {
                                that.spinner(false);
                            }
                            future.complete(true);
                        });
                    });
                });
            } else {
                this.sendMessage(conversationId, message).thenApply(res => {
                    that.refreshConversation(conversationId).thenApply(res2 => {
                        if (showProgress) {
                            that.spinner(false);
                        }
                        future.complete(true);
                    });
                });
            }
            return future;
        },
        buildAttachmentFileRefList: function() {
            let fileRefs = this.attachmentList.map(i => i.mediaItem);
            let fileRefList = peergos.client.JsUtil.asList(fileRefs);
            return fileRefList;
        },
        deleteChatMessage: function(message, conversationId) {
            let that = this;
            function command(message, conversationId) {
                return that.executeDeleteChatMessage(message, conversationId);
            }
            this.drainCommandQueue(() => command(message, conversationId));
        },
        executeDeleteChatMessage: function(message, conversationId) {
            let that = this;
            let chatController = this.allChatControllers.get(conversationId);
            this.spinner(true);
            let future = peergos.shared.util.Futures.incomplete();
            chatController.controller.generateHash(message.envelope).thenApply(messageRef => {
                let msg = new peergos.shared.messaging.messages.DeleteMessage(messageRef);
                that.sendMessage(conversationId, msg).thenApply(res => {
                    that.refreshConversation(conversationId).thenApply(res2 => {
                        that.spinner(false);
                        future.complete(true);
                    });
                });
            });
            return future;
        },
        sendMessage: function(conversationId, msg) {
            let future = peergos.shared.util.Futures.incomplete();
            let that = this;
            let chatController = this.allChatControllers.get(conversationId);
            let controller = chatController.controller;
            this.messenger.sendMessage(controller, msg).thenApply(function(updatedController) {
                chatController.controller = updatedController;
                that.newMessageText = "";
                that.replyToMessage = null;
                that.editMessage = null;
                that.attachmentList = [];
                future.complete(true);
            }).exceptionally(function(throwable) {
                console.log(throwable);
                that.showMessage("Unable to send message");
                future.complete(false);
            });
            return future;
        },
        changeTitle: function(conversationId, text) {
            let future = peergos.shared.util.Futures.incomplete();
            let that = this;
            let chatController = this.allChatControllers.get(conversationId);
            let controller = chatController.controller;
            this.messenger.setGroupProperty(controller, "title", text).thenApply(function(updatedController) {
                chatController.controller = updatedController;
                future.complete(true);
            }).exceptionally(function(throwable) {
                console.log(throwable);
                that.showMessage("Unable to change Title");
                future.complete(false);
            });
            return future;
        },
        draftMessage: function(conversationId, message, attachmentMap, parentMessage) {
            let messageThread = this.allMessageThreads.get(conversationId);
            let draftMsg = this.createMessage(this.context.username, null, message.body.toArray(), attachmentMap, parentMessage);
            this.draftMessages.push({key: this.msgKey(draftMsg), index:messageThread.length});
            messageThread.push(draftMsg);
            this.buildMessageThread(conversationId);
            this.updateScrollPane(true);
        },
        createMessage: function(author, messageEnvelope, body, attachmentMap, parentMessage) {
            let content = body[0].inlineText();
            let mediaFiles = [];
            let mediaFilePaths = [];
            for(var i = 1; i < body.length; i++) {
                let path = body[i].reference().ref.path;
                let mediaFile = attachmentMap.get(path);
                if (mediaFile != null) {
                    let fileType = mediaFile.getFileProperties().getType();
                    let thumbnail = mediaFile.getFileProperties().thumbnail.ref != null ? mediaFile.getBase64Thumbnail() : "";
                    mediaFiles.push({path: path, file: mediaFile, fileType: fileType, thumbnail: thumbnail, hasThumbnail: thumbnail.length > 0});
                } else {
                    mediaFilePaths.push(path);
                    mediaFiles.push({path: path, file: null, fileType: null, thumbnail: "", hasThumbnail: false});
                }
            }
            let timestamp = messageEnvelope == null ? "" : this.fromUTCtoLocal(messageEnvelope.creationTime);
            let entry = {isStatusMsg: false, mediaFiles: mediaFiles, mediaFilePaths: mediaFilePaths,
                sender: author, sendTime: timestamp, contents: content
                , envelope: messageEnvelope, parentMessage: parentMessage, edited: false, deleted : false};
            return entry;
        },
        createStatusMessage: function(timestamp, message) {
            let entry = {isStatusMsg: true, sender: null, hasThumbnail: false,
                sendTime: this.fromUTCtoLocal(timestamp), contents: message};
            return entry;
        },
        fromUTCtoLocal: function(dateTime) {
            let date = new Date(dateTime.toString() + "+00:00");//adding UTC TZ in ISO_OFFSET_DATE_TIME ie 2021-12-03T10:25:30+00:00
            let formatted = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate()
                + ' ' + (date.getHours() < 10 ? '0' : '') + date.getHours()
                + ':' + (date.getMinutes() < 10 ? '0' : '') + date.getMinutes()
                + ':' + (date.getSeconds() < 10 ? '0' : '') + date.getSeconds();
            return formatted;
        },
    }
}
