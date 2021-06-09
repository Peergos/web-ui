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
            allConversations: new Map(),
            allChatControllers: new Map(),
            allMessageThreads: new Map(),
            allThreadsHashToIndex: new Map(),
            chatTitle: "",
            pageStartIndex : 0,
            savingNewMsg: false,
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
            displayingMessages: false
        }
    },
    props: ['context', 'closeChatViewer', 'friendnames', 'socialFeed', 'socialState', 'getFileIconFromFileAndType', 'displayProfile'],
    created: function() {
        let that = this;
        this.messenger = new peergos.shared.messaging.Messenger(this.context);
        this.init();
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
        resizeHandler: function() {
            var left = document.getElementById("chat-left-panel");
            var right = document.getElementById("dnd-chat");
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
            this.displayingMessages = true;
            this.resizeHandler();
            this.buildMessageThread(conversation.id);
            this.updateScrollPane();
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
            this.spinner(true);
            this.deleteFile(attachment).thenApply(function(res){
                that.spinner(false);
                if (res) {
                    let idx = that.attachmentList.findIndex(v => v.mediaItem.path === attachment.mediaItem.path);
                    if (idx > -1) {
                        that.attachmentList.splice(idx, 1);
                    }
                }
            });
        },
        deleteReply: function() {
            this.replyToMessage = null;
            this.newMessageText = "";
        },
        reply: function(message) {
            this.replyToMessage = message;
            this.editMessage = null;
            this.focus();
        },
        deleteEdit: function() {
            this.editMessage = null;
            this.newMessageText = "";
        },
        edit: function(message) {
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
            let entries = evt.dataTransfer.items;
            if (entries.length != 1) {
                this.showMessage("Only 1 item can be dragged and dropped");
                return;
            }
            let mimeType = entries[0].type;
            if (!(mimeType.startsWith("image") || mimeType.startsWith("audio") || mimeType.startsWith("video"))) {
                this.showMessage("Only media files can be dragged and dropped");
            }
            let entry = entries[0].webkitGetAsEntry();
            if (entry.isDirectory || !entry.isFile) {
                this.showMessage("Only files can be dragged and dropped");
                return;
            }
            if (this.savingNewMsg) {
                this.showMessage("Unable to drag and drop while busy");
                return;
            }
            this.uploadFile(evt.dataTransfer.files[0]);
        },
        view: function (message, mediaIndex) {
            let mediaList = message.mediaFiles;
            let files = [];
            for(var i = mediaIndex; i < mediaList.length; i++) {
                files.push(mediaList[i].file);
            }
            for(var j = 0; j < mediaIndex; j++) {
                files.push(mediaList[j].file);
            }
            this.filesToViewInGallery = files;
            this.showEmbeddedGallery = true;
        },
        uploadMedia: function(mediaFile, updateProgressBar) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let reader = new browserio.JSFileReader(mediaFile);
            let java_reader = new peergos.shared.user.fs.BrowserFileReader(reader);
            if (mediaFile.size > 2147483647) {
                that.showMessage("Media file greater than 2GiB not currently supported!");
                future.complete(null);
            } else {
                let postTime = peergos.client.JsUtil.now();
                let chatController = this.allChatControllers.get(this.selectedConversationId);
                this.messenger.uploadMedia(chatController.controller, java_reader, mediaFile.size, postTime, updateProgressBar).thenApply(function(pair) {
                    var thumbnailAllocation = Math.min(100000, mediaFile.size / 10);
                    updateProgressBar({ value_0: thumbnailAllocation});
                    that.context.getByPath(pair.right.path).thenApply(function(fileOpt){
                        let file = fileOpt.ref;
                        future.complete({mediaItem: pair.right, mediaFile: file});
                    });
                });
            }
            return future;
        },
        addAllAttachments: function(index, files) {
            let that = this;
            if (index == files.length) {
                document.getElementById('uploadInput').value = "";
            } else {
                let mediaFile = files[index];
                this.uploadFile(mediaFile).thenApply(function(res){
                    that.addAllAttachments(++index, files);
                }).exceptionally(function(throwable) {
                    console.log(throwable.getMessage());
                    that.showMessage("error uploading attachment");
                    document.getElementById('uploadInput').value = "";
                });
            }
        },
        addAttachments: function(evt) {
            if (this.savingNewMsg || this.selectedConversationId == null ) {
                return;
            }
            let files = evt.target.files || evt.dataTransfer.files;
            this.addAllAttachments(0, files);
        },
        uploadFile: function(mediaFile) {
            let future = peergos.shared.util.Futures.incomplete();
            this.savingNewMsg = true;
            let that = this;
            var thumbnailAllocation = Math.min(100000, mediaFile.size / 10);
            var resultingSize = mediaFile.size + thumbnailAllocation;
            var progress = {
                show:true,
                title:"Encrypting and uploading " + mediaFile.name,
                done:0,
                max:resultingSize
            };
            this.progressMonitors.push(progress);
            let updateProgressBar = function(len){
                progress.done += len.value_0;
                if (progress.done >= progress.max) {
                    progress.show = false;
                }
            };
            this.uploadMedia(mediaFile, updateProgressBar).thenApply(function(mediaResponse) {
                that.attachmentList.push(mediaResponse);
                let idx = that.progressMonitors.indexOf(progress);
                if(idx >= 0) {
                    that.progressMonitors.splice(idx, 1);
                }
                that.savingNewMsg = false;
                future.complete(true);
            }).exceptionally(function(throwable) {
                console.log(throwable.getMessage());
                that.showMessage("error uploading attachment");
                future.complete(false);
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
        updateMessageThread: function (conversationId, messagePairs, attachmentMap) {
            let messageThread = this.allMessageThreads.get(conversationId);
            var hashToIndex = this.allThreadsHashToIndex.get(conversationId);
            if (hashToIndex == null) {
                hashToIndex = new Map();
                this.allThreadsHashToIndex.set(conversationId, hashToIndex);
            }
            let chatController = this.allChatControllers.get(conversationId);
            for(var j = 0; j < messagePairs.length; j++) {
                let chatEnvelope = messagePairs[j].message;
                let messageHash = messagePairs[j].hash;
                let payload = chatEnvelope.payload;
                let type = payload.type().toString();
                let author = chatController.controller.getAuthorUsername(chatEnvelope);
                if (type == 'GroupState') {//type
                    if(payload.key == "title") {
                        messageThread.push(this.createStatusMessage(chatEnvelope.creationTime, "Chat name changed to " + payload.value));
                        let conversation = this.allConversations.get(conversationId);
                        conversation.title = payload.value;
                    }
                } else if(type == 'Invite') {
                    let username = chatEnvelope.payload.username;
                    messageThread.push(this.createStatusMessage(chatEnvelope.creationTime, author + " invited " + username));
                } else if(type == 'Join') {
                    let username = chatEnvelope.payload.username;
                    messageThread.push(this.createStatusMessage(chatEnvelope.creationTime, username + " joined the chat"));
                } else if(type == 'Application') {
                    hashToIndex.set(messageHash, messageThread.length);
                    messageThread.push(this.createMessage(author, chatEnvelope, payload.body.toArray(), attachmentMap, null));
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
                        message.file = null;
                    }
                } else if(type == 'ReplyTo') {
                    let parentRef = payload.parent;
                    let messageIndex = hashToIndex.get(parentRef.toString());
                    let parentMessage = messageThread[messageIndex];
                    hashToIndex.set(messageHash, messageThread.length);
                    messageThread.push(this.createMessage(author, chatEnvelope, payload.content.body.toArray(), attachmentMap, parentMessage));
                }
            }
        },
        updateScrollPane: function(val) {
           Vue.nextTick(function() {
               let scrollArea = document.getElementById("message-scroll-area");
               scrollArea.scrollTop = scrollArea.scrollHeight;
           });
        },
        spinner: function(val) {
            this.showSpinner = val;
        },
        init: function() {
            this.refreshUI();
        },
        fullRefresh: function() {
            if (this.showSpinner) {
                return;
            }
            this.init();
        },
        refreshUI: function(existingChats) {
            var that = this;
            this.spinner(true);
            this.messenger.listChats().thenApply(function(chats) {
                let allChats = chats.toArray();
                that.loadChatMessages(allChats).thenApply(function(allChats) {
                    that.updateMessageThreads(allChats);
                    that.buildConversations();
                    let conversationId = null;
                    if (that.selectedConversationId != null) {
                        conversationId = that.selectedConversationId;
                    } else if(that.conversations.length > 0){
                        conversationId = that.conversations[0].id;
                    }
                    that.buildMessageThread(conversationId);
                    if (conversationId != null) {
                        that.updateScrollPane();
                    }
                    that.spinner(false);
                });
            });
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
        refreshConversation: function(conversationId) {
            var that = this;
            this.spinner(true);
            let chatController = this.allChatControllers.get(conversationId);
            that.messenger.mergeAllUpdates(chatController.controller, this.socialState).thenApply(latestController => {
                chatController.controller = latestController;
                that.retrieveChatMessages(chatController).thenApply(messages => {
                    that.updateMessageThread(conversationId, messages.messagePairs, messages.attachmentMap);
                    that.buildConversations();
                    that.buildMessageThread(conversationId);
                    that.updateScrollPane();
                    that.spinner(false);
                });
            });
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
            });
        },
        getAllMessages: function(chatController) {
            let future = peergos.shared.util.Futures.incomplete();
            this.reduceGetAllMessages(chatController, [], future);
            return future;
        },
        close: function () {
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
        formatDateTime: function(dateTime) {
            if (dateTime == "") {
                return "";
            }
            let date = new Date(dateTime.toString() + "+00:00");//adding UTC TZ in ISO_OFFSET_DATE_TIME ie 2021-12-03T10:25:30+00:00
            let formatted = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate()
                + ' ' + (date.getHours() < 10 ? '0' : '') + date.getHours()
                + ':' + (date.getMinutes() < 10 ? '0' : '') + date.getMinutes()
                + ':' + (date.getSeconds() < 10 ? '0' : '') + date.getSeconds();
            return formatted;
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
        updatedGroupMembership: function(conversationId, updatedGroupTitle, updatedMembers) {
            let that = this;
            let conversation = this.allConversations.get(conversationId);
            this.spinner(true);
            if (conversation == null) {
                this.spinnerMessage = "Creating new chat";
                this.messenger.createChat().thenApply(function(controller){
                    let conversationId = controller.chatUuid;
                    that.allChatControllers.set(controller.chatUuid,
                        {controller: controller, owner: that.context.username, startIndex: 0});
                    let item = {id: conversationId, title: updatedGroupTitle, participants: updatedMembers};
                    if (updatedMembers.length == 1) {
                        item.profileImageNA = false;
                    }
                    that.allConversations.set(conversationId, item);
                    that.allMessageThreads.set(conversationId, []);

                    that.changeTitle(conversationId, updatedGroupTitle).thenApply(function(res1) {
                        that.inviteNewParticipants(conversationId, updatedMembers).thenApply(function(res1) {
                            that.spinnerMessage = "";
                            that.spinner(false);
                            that.refreshConversation(conversationId);
                        });
                    });
                });
            } else {
                if (updatedMembers.length == 1) {
                    conversation.profileImageNA = false;
                }
                let added = this.extractAddedParticipants(conversation.participants, updatedMembers);
                let removed = this.extractRemovedParticipants(conversation.participants, updatedMembers);
                conversation.participants = updatedMembers.slice();
                that.inviteNewParticipants(conversationId, added).thenApply(function(res1) {
                    that.unInviteParticipants(conversationId, removed).thenApply(function(res2) {
                        that.spinnerMessage = "";
                        that.spinner(false);
                        if (conversation.title != updatedGroupTitle) {
                            conversation.title = updatedGroupTitle;
                            that.changeTitle(conversationId, updatedGroupTitle).thenApply(function(res3) {
                                that.refreshConversation(conversationId);
                            });
                        } else {
                            that.refreshConversation(conversationId);
                        }
                    });
                });
            }
        },
        newConversation: function() {
            let that = this;
            that.groupId = "";
            that.groupTitle = "New Chat";
            that.friendNames = that.friendnames;
            that.messages = that.messages;
            that.existingGroups = that.getExistingConversationTitles();
            this.existingGroupMembers = [];
            that.showGroupMembership = true;
        },
        editCurrentConversation: function() {
            if (this.selectedConversationId == null) {
                return;
            }
            if (this.extractChatOwner(this.selectedConversationId) != this.context.username) {
                return;
            }
            let conversation = this.allConversations.get(this.selectedConversationId);
            this.editConversation(conversation);
        },
        editConversation: function(conversation) {
            if (conversation != null) {
                this.groupId = this.selectedConversationId;
                this.groupTitle = conversation.title;
                this.friendNames = this.friendnames;
                this.messages = this.messages;
                this.existingGroups = this.getExistingConversationTitles();
                this.existingGroupMembers = conversation.participants.slice();
                this.showGroupMembership = true;
            }
        },
        deleteConversation: function(conversation) {
            this.allConversations.delete(conversation.id);
            this.buildConversations();
            this.buildMessageThread(this.conversations.length == 0 ? null : this.conversations[0].id);
        },
        confirmDeleteMessage: function(deleteMessageFunction, cancelFunction) {
            this.confirm_message='Are you sure you want to delete the message?';
            this.confirm_body='';
            this.confirm_consumer_cancel_func = cancelFunction;
            this.confirm_consumer_func = deleteMessageFunction;
            this.showConfirm = true;
        },
        deleteMessage: function(message) {
            let that = this;
            if (message.sender != this.context.username) {
                return;
            }
            this.confirmDeleteMessage(
                () => { that.showConfirm = false;
                    that.deleteChatMessage(message);
                },
                () => { that.showConfirm = false;}
            );
        },
        convertToPath: function(dir) {
            let dirWithoutLeadingSlash = dir.startsWith("/") ? dir.substring(1) : dir;
            return peergos.client.PathUtils.directoryToPath(dirWithoutLeadingSlash.split('/'));
        },
        deleteChatMessage: function(message) {
            let that = this;
            this.spinner(true);
            let chatController = this.allChatControllers.get(this.selectedConversationId);
            chatController.controller.generateHash(message.envelope).thenApply(messageRef => {
                let msg = new peergos.shared.messaging.messages.DeleteMessage(messageRef);
                that.sendMessage(that.selectedConversationId, msg).thenApply(function(res) {
                    that.refreshConversation(that.selectedConversationId);
                });
            });
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
                        that.showMessage("error deleting attachment");
                        future.complete(false);
                    });
                }).exceptionally(function(throwable) {
                    that.showMessage("error finding attachment");
                    future.complete(false);
                });
            }
            return future;
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
                    });
                });
            }
            return future;
        },
        reduceRemovingInvitations: function(conversationId, membersToRemove, index, future) {
            future.complete(true);
            /* not implemented yet!
            */
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
        reduceNewChats: function(pairs, index, future) {
            let that = this;
            if (index == pairs.length) {
                future.complete(true);
            } else {
                let currentPair = pairs[index];
                let sharedChatDir = currentPair.right;
                this.messenger.cloneLocallyAndJoin(sharedChatDir).thenApply(res => {
                    that.reduceNewChats(pairs, ++index, future);
                }).exceptionally(function(throwable) {
                    that.showMessage(throwable.getMessage());
                    that.reduceNewChats(pairs, ++index, future);
                });
            }
        },
        loadNewChats: function(pairs) {
            let future = peergos.shared.util.Futures.incomplete();
            this.reduceNewChats(pairs, 0, future);
            return future;
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
        readChatMessages: function(controller) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let chatController = that.allChatControllers.get(controller.chatUuid);
            if (chatController == null) {
                let chatOwner = this.extractChatOwner(controller.chatUuid);
                chatController = {controller:controller, startIndex: 0, owner: chatOwner};
                that.allChatControllers.set(controller.chatUuid, chatController);
                that.allMessageThreads.set(controller.chatUuid, []);
                let participants = that.removeSelfFromParticipants(controller.getMemberNames().toArray());
                let conversation = {id: controller.chatUuid, participants: participants};
                if (participants.length == 1) {
                    conversation.profileImageNA = false;
                }
                that.allConversations.set(controller.chatUuid, conversation);
            }
            chatController.controller = controller;
            let conversation = this.allConversations.get(controller.chatUuid);
            that.messenger.mergeAllUpdates(controller, this.socialState).thenApply(updatedController => {
                chatController.controller = updatedController;
                let participants = that.removeSelfFromParticipants(updatedController.getMemberNames().toArray());
                conversation.participants = participants;
                if (participants.length == 1) {
                    conversation.profileImageNA = false;
                }
                that.retrieveChatMessages(chatController).thenApply(messages => {
                    future.complete({conversationId: controller.chatUuid, messagePairs: messages.messagePairs
                                    , attachmentMap: messages.attachmentMap});
                });
            }).exceptionally(function(throwable) {
                that.showMessage(throwable.getMessage());
            });
            return future;
        },
        extractOwnerFromPath: function(path) {
            let pathWithoutLeadingSlash = path.startsWith("/") ? path.substring(1) : path;
            return pathWithoutLeadingSlash.substring(0, pathWithoutLeadingSlash.indexOf("/"));
        },
        loadAllAttachments: function(refs, future) {
            let that = this;
            let attachmentMap = new Map();
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
                            future.complete(attachmentMap);
                        }
                    });
                });
            }
        },
        loadAttachments: function(messages) {
            let future = peergos.shared.util.Futures.incomplete();
            let refs = [];
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
            this.loadAllAttachments(refs, future);
            return future;
        },
        retrieveChatMessages: function(chatController) {
            let future = peergos.shared.util.Futures.incomplete();
            let that = this;
            that.getAllMessages(chatController).thenApply(messages => {
                that.generateMessageHashes(chatController, messages).thenApply(messagePairs => {
                    that.loadAttachments(messages).thenApply(attachmentMap => {
                        future.complete({attachmentMap: attachmentMap, messagePairs: messagePairs});
                    });
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
                        } else {
                            val.blurb = "";
                            val.lastModified = "";
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
            if (conversationId != null) {
                let conversation = this.allConversations.get(conversationId);
                var title = this.truncateText(conversation.title, 20);
                var participants = this.truncateText(this.formatParticipants(conversation.participants), 20);
                if (participants.length > 0) {
                    participants = " - " + participants;
                }
                title = title + participants;
                this.chatTitle = title;
                this.selectedConversationId = conversationId;
                let currentMessageThread = this.allMessageThreads.get(conversationId);
                if (currentMessageThread != null) {
                    this.messageThread = currentMessageThread.slice();
                } else {
                    this.messageThread = [];
                }
            } else {
                this.chatTitle = "";
                this.messageThread = [];
            }
        },
        send: function() {
            let that = this;
            let text = this.newMessageText;
            let conversationId = this.selectedConversationId;
            if (this.savingNewMsg || this.selectedConversationId == null ) {
                return;
            }
            that.savingNewMsg = true;
            if (this.editMessage != null) {
                if (this.editMessage.sender != this.context.username) {
                    return;
                }
                this.editExistingMessage(conversationId, this.editMessage.envelope, text).thenApply(function(result) {
                    that.refreshConversation(conversationId);
                });
            } else if (this.replyToMessage != null) {
                this.replyTo(conversationId, this.replyToMessage.envelope, text).thenApply(function(result) {
                    that.refreshConversation(conversationId);
                });
            } else {
                this.newMessage(conversationId, text).thenApply(function(result) {
                    that.refreshConversation(conversationId);
                });
            }
        },
        buildAttachmentFileRefSet: function() {
            let fileRefList = this.attachmentList.map(i => i.mediaItem);
            let fileRefSet = peergos.client.JsUtil.asSet(fileRefList);
            return fileRefSet;
        },
        editExistingMessage: function(conversationId, editMessage, text) {
            let future = peergos.shared.util.Futures.incomplete();
            if (this.attachmentList.length > 0) {
                let msg = peergos.shared.messaging.messages.ApplicationMessage.attachment(text, this.buildAttachmentFileRefSet());
                this.sendEditMessage(conversationId, editMessage, msg, future);
            } else {
                let msg = peergos.shared.messaging.messages.ApplicationMessage.text(text);
                this.sendEditMessage(conversationId, editMessage, msg, future);
            }
            return future;
        },
        replyTo: function(conversationId, replyToMessage, text) {
            let future = peergos.shared.util.Futures.incomplete();
            if (this.attachmentList.length > 0) {
                let msg = peergos.shared.messaging.messages.ApplicationMessage.attachment(text, this.buildAttachmentFileRefSet());
                this.sendReplyTo(conversationId, replyToMessage, msg, future);
            } else {
                let msg = peergos.shared.messaging.messages.ApplicationMessage.text(text);
                this.sendReplyTo(conversationId, replyToMessage, msg, future);
            }
            return future;
        },
        newMessage: function(conversationId, text) {
            let future = peergos.shared.util.Futures.incomplete();
            if (this.attachmentList.length > 0) {
                let msg = peergos.shared.messaging.messages.ApplicationMessage.attachment(text, this.buildAttachmentFileRefSet());
                this.sendNewMessage(conversationId, msg, future);
            } else {
                let msg = peergos.shared.messaging.messages.ApplicationMessage.text(text);
                this.sendNewMessage(conversationId, msg, future);
            }
            return future;
        },
        sendEditMessage: function(conversationId, editMessage, msg, future) {
            let that = this;
            this.spinner(true);
            let chatController = this.allChatControllers.get(conversationId);
            chatController.controller.generateHash(editMessage).thenApply(messageRef => {
                let edit = new peergos.shared.messaging.messages.EditMessage(messageRef, msg);
                that.sendMessage(conversationId, edit).thenApply(function(res) {
                    future.complete(true);
                });
            });
        },
        sendReplyTo: function(conversationId, replyToMessage, msg, future) {
            let that = this;
            this.spinner(true);
            peergos.shared.messaging.messages.ReplyTo.build(replyToMessage, msg, this.context.crypto.hasher).thenApply(function(replyTo) {
                that.sendMessage(conversationId, replyTo).thenApply(function(res) {
                    future.complete(true);
                });
            });
        },
        sendNewMessage: function(conversationId, msg, future) {
            let that = this;
            this.spinner(true);
            this.sendMessage(conversationId, msg).thenApply(function(res) {
                future.complete(true);
            });
        },
        sendMessage: function(conversationId, msg) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let chatController = this.allChatControllers.get(conversationId);
            let controller = chatController.controller;
            this.messenger.sendMessage(controller, msg).thenApply(function(updatedController) {
                chatController.controller = updatedController;
                that.newMessageText = "";
                that.savingNewMsg = false;
                that.replyToMessage = null;
                that.editMessage = null;
                that.attachmentList = [];
                that.spinner(false);
                future.complete(true);
            }).exceptionally(function(throwable) {
                that.showMessage(throwable.getMessage());
                that.spinner(false);
                that.savingNewMsg = false;
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
                that.showMessage(throwable.getMessage());
                that.spinner(false);
                future.complete(false);
            });
            return future;
        },
        createMessage: function(author, messageEnvelope, body, attachmentMap, parentMessage) {
            let content = body[0].inlineText();
            let mediaFiles = [];
            for(var i = 1; i < body.length; i++) {
                let mediaFile = attachmentMap.get(body[i].reference().ref.path);
                if (mediaFile != null) {
                    let fileType = mediaFile.getFileProperties().getType();
                    let thumbnail = mediaFile.getFileProperties().thumbnail.ref != null ? mediaFile.getBase64Thumbnail() : "";
                    mediaFiles.push({file: mediaFile, fileType: fileType, thumbnail: thumbnail, hasThumbnail: thumbnail.length > 0});
                }
            }
            let timestamp = messageEnvelope.creationTime;
            let entry = {isStatusMsg: false, mediaFiles: mediaFiles,
                sender: author, sendTime: timestamp.toString(), contents: content
                , envelope: messageEnvelope, parentMessage: parentMessage, edited: false, deleted : false};
            return entry;
        },
        createStatusMessage: function(timestamp, message) {
            let entry = {isStatusMsg: true, sender: null, hasThumbnail: false,
                sendTime: timestamp.toString(), contents: message};
            return entry;
        },
    }
}
