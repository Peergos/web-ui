module.exports = {
    template: require('email.html'),
    data: function() {
        return {
            CONFIG_FILENAME: 'App.config',
            EMAIL_FILE_EXTENSION: '.cbor',
            emailClientProperties: null,
	        showSpinner: false,
	        spinnerMessage: '',
	        showWarning: false,
	        showPrompt: false,
            showPrompt: false,
            prompt_message: '',
            prompt_placeholder: '',
            prompt_max_input_size: null,
            prompt_value: '',
            prompt_consumer_func: () => {},
            showConfirm: false,
            confirm_message: "",
            confirm_body: "",
            confirm_consumer_cancel_func: () => {},
            confirm_consumer_func: () => {},
            messageToTimestamp: new Map(),
            emailHostDomainIdentifier: '@peergos.net',
            attachmentReferences: new Map(),
            progressMonitors: [],
            directoryPrefix: 'default'
        }
    },
    props: ['context', 'messages', 'availableUsernames', 'importCalendarEvent', 'icalEventTitle', 'icalEvent', 'checkAvailableSpace'],
    created: function() {
        this.displaySpinner();
        let that = this;
        peergos.shared.user.App.init(that.context, "email").thenCompose(email => {
            that.getPropertiesFile(email).thenApply(props => {
                that.setupDirectories(email).thenApply(done => {
                    that.emailClientProperties = props;
                    that.startListener(email)
                });
            });
        });
    },
    methods: {
        getContext: function() {
            return this.context;
        },
        reduceCreatingDirectories: function(email, prefix, index, directoriesToCreate, future) {
            let that = this;
            if (index >= directoriesToCreate.length) {
                future.complete(true);
            } else {
                let dirStr = prefix + "/" + directoriesToCreate[index];
                let directoryPath = peergos.client.PathUtils.directoryToPath(dirStr.split('/'));
                email.createDirectoryInternal(directoryPath).thenApply(function(res) {
                    that.reduceCreatingDirectories(email, prefix, ++index, directoriesToCreate, future);
                }).exceptionally(function(throwable) {
                    console.log('Unable to create directory:' + dirStr);
                    that.showMessage("Unable to to create directory:" + dirStr);
                    future.complete(false);
                });
            }
        },
        setupDirectories: function(email) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let prefix = this.directoryPrefix;
            email.dirInternal(null).thenApply(dataDir => {
                let dataSubDirs = dataDir.toArray([]);
                if (dataSubDirs.length == 0) {
                    let directoryPath = peergos.client.PathUtils.directoryToPath([prefix]);
                    email.createDirectoryInternal(directoryPath).thenApply(function(res) {
                        future.complete(true);
                    }).exceptionally(function(throwable) {
                        console.log('Unable to create directory:' + prefix);
                        that.showMessage("Unable to to create directory:" + prefix);
                        future.complete(false);
                    });
                } else {
                    future.complete(true);
                }
            });
            let future2 = peergos.shared.util.Futures.incomplete();
            future.thenApply(done => {
                that.setupDefaultDirectories(email).thenApply(done => {
                    future2.complete(done);
                });
            });
            return future2;
        },
        setupDefaultDirectories: function(email) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let requiredDirs = ['inbox','sent','pending', 'attachments'];
            let prefix = this.directoryPrefix;
            let prefixPath = peergos.client.PathUtils.directoryToPath([this.directoryPrefix]);
            email.dirInternal(prefixPath).thenApply(dirNames => {
                let folders = dirNames.toArray([]);
                folders.forEach(folder => {
                    let index = requiredDirs.findIndex(v => v === folder);
                    if (index >= -1) {
                        requiredDirs.splice(index, 1);
                    }
                });
                if (requiredDirs.length == 0) {
                    future.complete(true);
                } else {
                    that.displaySpinner("Creating email directories");
                    let pendingIndex = requiredDirs.findIndex(v => v === 'pending');
                    if (pendingIndex => 0) {
                        requiredDirs.push('pending/inbox');
                        requiredDirs.push('pending/outbox');
                    }
                    let future2 = peergos.shared.util.Futures.incomplete();
                    that.reduceCreatingDirectories(email, prefix, 0, requiredDirs, future2);
                    future2.thenApply(done => {
                        if (done) {
                            let sharees = peergos.client.JsUtil.asSet(['email-bridge']);
                            let dirStr = that.context.username + '/.apps/email/data/' + prefix;
                            let directoryPath = peergos.client.PathUtils.directoryToPath(dirStr.split('/'));
                            that.context.shareWriteAccessWith(directoryPath, sharees).thenApply(function(b) {
                                that.removeSpinner();
                                future.complete(true);
                            });
                        }
                    });
                }
            });
            return future;
        },
        frameUrl: function() {
            return this.frameDomain() + "/apps/email-client/index.html";
        },
        frameDomain: function() {
            return window.location.protocol + "//email." + window.location.host;
        },
        startListener: function(email) {
            var that = this;
            var iframe = document.getElementById("email-client");
            if (iframe == null) {
                setTimeout(function(){that.startListener(email)}, 1000);
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
                    if(e.data.type=="displaySpinner") {
                        that.displaySpinner();
                    } else if(e.data.type=="removeSpinner") {
                        that.removeSpinner();
                    } else if(e.data.action=="requestSendEmail") {
                        that.requestSendEmail(email, e.data.data);
                    } else if(e.data.action=="requestMoveEmails") {
                        that.requestMoveEmails(email, e.data.data, e.data.fromFolder, e.data.toFolder);
                    } else if(e.data.action=="requestMoveEmail") {
                        that.requestMoveEmail(email, e.data.data, e.data.fromFolder, e.data.toFolder);
                    } else if(e.data.action=="requestUpdateEmail") {
                        that.requestUpdateEmail(email, e.data.data, e.data.folder);
                    } else if(e.data.action=="requestDeleteEmails") {
                        that.requestDeleteEmails(email, e.data.data, e.data.folder);
                    } else if(e.data.action=="requestDeleteEmail") {
                        that.requestDeleteEmail(email, e.data.data, e.data.folder);
                    } else if(e.data.action=="requestLoadFolder") {
                        that.requestLoadFolder(email, e.data.folderName);
                    } else if(e.data.action=="requestNewFolder") {
                        that.requestNewFolder(email);
                    } else if(e.data.action=="requestDeleteFolder") {
                        that.requestDeleteFolder(email, e.data.folderName);
                    } else if(e.data.action=="requestShowMessage") {
                        that.requestShowMessage(e.data.message);
                    } else if(e.data.type=="requestConfirmAction") {
                        that.requestConfirmAction(e.data.action, e.data.message);
                    } else if(e.data.action=="requestDownloadAttachment") {
                        that.requestDownloadAttachment(e.data.attachment);
                    } else if(e.data.action=="requestImportCalendarEvent") {
                        that.requestImportCalendarEvent(e.data.icalEvent);
                    } else if(e.data.action=="requestRefreshInbox") {
                        that.requestRefreshInbox(email);
                    }
                }
            });
            // Note that we're sending the message to "*", rather than some specific
            // origin. Sandboxed iframes which lack the 'allow-same-origin' header
            // don't have an origin which you can target: you'll have to send to any
            // origin, which might alow some esoteric attacks. Validate your output!
            this.load(email);
        },
        postMessage: function(obj) {
            Vue.nextTick(function() {
                var iframe = document.getElementById("email-client");
                iframe.contentWindow.postMessage(obj, '*');
            });
        },
        reduceDeletingEmails: function(email, data, folder, index, future) {
            let that = this;
            if (index >= data.length) {
                future.complete(true);
            } else {
                let item = data[index];
                this.removeEmail(email, folder, item, true).thenApply(function(res) {
                    that.reduceDeletingEmails(email, data, folder, ++index, future);
                });
            }
        },
        requestDeleteEmails: function(email, data, folder) {
            let that = this;
            that.displaySpinner();
            let future = peergos.shared.util.Futures.incomplete();
            that.reduceDeletingEmails(email, data, folder, 0, future);
            future.thenApply(done => {
                that.removeSpinner();
                if (done) {
                    that.postMessage({type: 'respondToDeleteEmails', data: data, folder: folder});
                }
            });
        },
        requestDeleteEmail: function(email, data, folder) {
            const that = this;
            that.displaySpinner();
            this.removeEmail(email, folder, data, true).thenApply(function(done) {
                that.removeSpinner();
                if (done) {
                    that.postMessage({type: 'respondToDeleteEmail', data: data, folder: folder});
                }
            });
        },
        reduceMovingEmails: function(email, data, fromFolder, toFolder, index, future) {
            let that = this;
            if (index >= data.length) {
                future.complete(true);
            } else {
                let item = data[index];
                this.moveEmail(email, item, fromFolder, toFolder).thenApply(res => {
                    that.reduceMovingEmails(email, data, fromFolder, toFolder, ++index, future);
                });
            }
        },
        requestMoveEmails: function(email, data, fromFolder, toFolder) {
            let that = this;
            that.displaySpinner();
            let future = peergos.shared.util.Futures.incomplete();
            that.reduceMovingEmails(email, data, fromFolder, toFolder, 0, future);
            future.thenApply(done => {
                that.removeSpinner();
                if (done) {
                    that.postMessage({type: 'respondToMoveEmails', data: data, toFolder: toFolder});
                }
            });
        },
        requestMoveEmail: function(email, data, fromFolder, toFolder) {
            const that = this;
            that.displaySpinner();
            that.moveEmail(email, data, fromFolder, toFolder).thenApply(function(done) {
                that.removeSpinner();
                if (done) {
                    that.postMessage({type: 'respondToMoveEmail', data: data, toFolder: toFolder});
                }
            });
        },
        removeEmailFromPending: function(email, id) {
            let filename = id + this.EMAIL_FILE_EXTENSION;
            let folder = this.directoryPrefix + '/pending/inbox';
            let filePath = peergos.client.PathUtils.toPath(folder.split('/'), filename);
            return email.deleteInternal(filePath);
        },
        removeEmail: function(email, folder, data, deleteAttachment) {
            let that = this;
            let filename = data.id + this.EMAIL_FILE_EXTENSION;
            let fullFolderPath = this.directoryPrefix + '/' + folder;
            let filePath = peergos.client.PathUtils.toPath(fullFolderPath.split('/'), filename);
            let future = peergos.shared.util.Futures.incomplete();
            email.deleteInternal(filePath).thenApply( res => {
                if (deleteAttachment) {
                    let future2 = peergos.shared.util.Futures.incomplete();
                    that.reduceDeletingAttachments(email, data.attachments, 0, future2);
                    future2.thenApply(done => {
                        future.complete(true);
                    }).exceptionally(function(throwable) {
                        future.complete(false);
                    });
                } else {
                    future.complete(true);
                }
            }).exceptionally(function(throwable) {
                that.showMessage("Unable to delete email");
                console.log(throwable.getMessage());
                future.complete(false);
            });
            return future;
        },
        reduceDeletingAttachments: function(email, attachments, index, future) {
            let that = this;
            if (index >= attachments.length) {
                future.complete(true);
            } else {
                let attachment = attachments[index];
                this.attachmentReferences.delete(attachment.path);
                let prefix = '/' + this.context.username + "/.apps/email/data";
                let relativePath = attachment.path.substring(prefix.length);
                let filePath = peergos.client.PathUtils.directoryToPath(relativePath.split('/'));
                email.deleteInternal(filePath).thenApply( res => {
                    that.reduceDeletingAttachments(email, attachments, ++index, future);
                }).exceptionally(function(throwable) {
                    if (throwable.toString() == "java.util.NoSuchElementException") {
                        that.reduceDeletingAttachments(email, attachments, ++index, future);
                    } else {
                        that.showMessage("Unable to delete attachment:" + attachment.filename);
                        console.log(throwable.getMessage());
                        future.complete(false);
                    }
                });
            }
        },
        moveEmail: function(email, data, fromFolder, toFolder) {
            const that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let bytes = that.buildEmailBytes(data);
            that.saveEmail(email, toFolder, bytes, data.id).thenApply(function(res2) {
                that.removeEmail(email, fromFolder, data, false).thenApply(function(res) {
                    future.complete(true);
                }).exceptionally(function(throwable) {
                    that.showMessage("Unable to delete moved email from source folder");
                    console.log(throwable.getMessage());
                    future.complete(false);
                });
            }).exceptionally(function(throwable) {
                that.showMessage("Unable to move email");
                console.log(throwable.getMessage());
                future.complete(false);
            });
            return future;
        },
        requestUpdateEmail: function(email, data, folder) {
            const that = this;
            that.displaySpinner();
            let bytes = that.buildEmailBytes(data);
            that.saveEmail(email, folder, bytes, data.id).thenApply(function(res) {
                that.removeSpinner();
                that.postMessage({type: 'respondToUpdateEmail'});
            }).exceptionally(function(throwable) {
                that.showMessage("Unable to save email");
                console.log(throwable.getMessage());
            });
        },
        requestDownloadAttachment: function(attachment) {
            let ref = this.attachmentReferences.get(attachment.path);
            let that = this;
            this.context.network.getFile(ref.cap, this.context.username).thenApply(optFile => {
                if (optFile.ref != null) {
                    that.downloadFile(optFile.ref, attachment.filename);
                } else {
                    that.showMessage("Unable to find email attachment:" + attachment.filename);
                }
            });
        },
        buildEmailBytes: function(data) {
            let email = this.buildEmail(data, true);
            return email.toBytes();
        },

        buildEmail: function(data, recurse) {
            let that = this;
            let allAttachments = [];
            data.attachments.forEach(item => {
                let ref = that.attachmentReferences.get(item.path);
                let attachment = new peergos.shared.email.Attachment(item.filename, item.size,
                    item.type, ref);
                allAttachments.push(attachment);
            });
            let attachments = peergos.client.JsUtil.asList(allAttachments);
            let to = peergos.client.JsUtil.asList(data.to);
            let cc = peergos.client.JsUtil.asList(data.cc);
            let bcc = peergos.client.JsUtil.asList(data.bcc);

            let createdTimestamp = this.messageToTimestamp.get(data.id);

            let replyingToEmail = data.replyingToEmail == null || !recurse ? peergos.client.JsUtil.emptyOptional()
                : peergos.client.JsUtil.optionalOf(this.buildEmail(data.replyingToEmail, false));

            let forwardingToEmail = data.forwardingToEmail == null || !recurse ? peergos.client.JsUtil.emptyOptional()
                : peergos.client.JsUtil.optionalOf(this.buildEmail(data.forwardingToEmail, false));

            let sendError = peergos.client.JsUtil.emptyOptional();
            let emailJava = new peergos.shared.email.EmailMessage(data.id, data.from, data.subject,
                 createdTimestamp, to, cc, bcc,
                 data.content, data.unread, data.star, attachments, data.icalEvent,
                 replyingToEmail, forwardingToEmail, sendError);
            return emailJava;
        },
        saveEmail: function(email, folder, bytes, id) {
            let fullFolderPath = this.directoryPrefix + "/" + folder;
            let folderDirs = fullFolderPath.split('/');
            let filePath = peergos.client.PathUtils.directoryToPath(folderDirs.concat(
                    [id + this.EMAIL_FILE_EXTENSION]));
            return email.writeInternal(filePath, bytes);
        },
        requestSendEmail: function(email, data) {
            let that = this;
            this.displaySpinner();
            //Note: id, timestamp and from email address are replaced serverside for security
            data.id = this.createUUID();
            data.from = "";
            let timestamp = peergos.client.JsUtil.now();
            this.messageToTimestamp.set(data.id, timestamp);
            data.timestamp = timestamp.toString();
            this.uploadAttachments(data).thenApply(attachments => {
                let bytes = that.buildEmailBytes(data);
                that.saveEmail(email, 'pending/outbox', bytes, data.id).thenApply(copiedToOutbox => {
                    that.removeSpinner();
                    if (copiedToOutbox) {
                        that.postMessage({type: 'respondToSendEmail'});
                    } else {
                        that.showMessage("Unable to Send Email to pending outbox");
                    }
                });
            });
        },
        createUUID: function() {
            let uuid = ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
                (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
            ).split("-").join("");
            return uuid;
        },
        getPropertiesFile: function(email) {
            let that = this;
            let filePath = peergos.client.PathUtils.directoryToPath([this.directoryPrefix, this.CONFIG_FILENAME]);
            return email.readInternal(filePath).thenApply(data => {
                return JSON.parse(new TextDecoder().decode(data));
            }).exceptionally(function(throwable) {//File not found
                if (throwable.detailMessage.startsWith("File not found")) {
                    let props = new Object();
                    props.userFolders = [];
                    return props;
                } else {
                    that.showMessage("Unable to load file","Please close email client and try again");
                }
            });
        },
        updatePropertiesFile: function(email, json) {
            let filePath = peergos.client.PathUtils.directoryToPath([this.directoryPrefix, this.CONFIG_FILENAME]);
            let encoder = new TextEncoder();
            let uint8Array = encoder.encode(JSON.stringify(json));
            let bytes = convertToByteArray(uint8Array);
            return email.writeInternal(filePath, bytes);
        },
        reduceLoadingEmails: function(email, directory, filenames, accumulator, future) {
            let that = this;
            let filename = filenames.pop();
            if (filename == null) {
                let sorted = accumulator.sort(function (a, b) {
                        let aDate = new Date(a.timestamp);
                        let bDate = new Date(b.timestamp);
                        return bDate - aDate;
                    });
                future.complete(sorted);
            } else {
                let filePath = peergos.client.PathUtils.toPath(directory.split('/'), filename);
                email.readInternal(filePath, this.context.username).thenApply(data => {
                    let emailJava = peergos.shared.util.Serialize.parse(data, c => peergos.shared.email.EmailMessage.fromCbor(c));
                    that.messageToTimestamp.set(emailJava.id, emailJava.created);
                    let emailJS =
                    {   id: emailJava.id, from: emailJava.from, subject: emailJava.subject
                        , timestamp: emailJava.created.toString()
                        , to: that.toJsList(emailJava.to)
                        , cc: that.toJsList(emailJava.cc)
                        , bcc: that.toJsList(emailJava.bcc)
                        , content: emailJava.content
                        , unread: emailJava.unread, star: emailJava.star, selected: false
                        , attachments: that.toJsAttachmentList(emailJava.attachments)
                        , icalEvent: emailJava.icalEvent
                    };

                    accumulator.push(emailJS);
                    that.reduceLoadingEmails(email, directory, filenames, accumulator, future);
                });
            }
        },
        toJsAttachmentList: function(javaList) {
            let javaArray = javaList.toArray([]);
            let jsAttachmentList = [];
            for(var i = 0; i < javaArray.length; i++) {
                let item = javaArray[i];
                let attachment = {filename: item.filename, size: item.size, type: item.type, path: item.reference.path};
                this.attachmentReferences.set(item.reference.path, item.reference);
                jsAttachmentList.push(attachment);
            }
            return jsAttachmentList;
        },
        toJsList: function(javaList) {
            let javaArray = javaList.toArray([]);
            let jsList = [];
            for(var i = 0; i < javaArray.length; i++) {
                jsList.push(javaArray[i]);
            }
            return jsList;
        },
        loadEmails: function(email, directory, filenames) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            that.reduceLoadingEmails(email, directory, filenames, [], future);
            return future;
        },
        load: function(email) {
            let that = this;
            let userFolders = [];
            for(var i=0;i < that.emailClientProperties.userFolders.length;i++) {
                let folder = that.emailClientProperties.userFolders[i];
                userFolders.push({name: folder.name, path: folder.path});
            }
            that.postMessage({type: 'load', availableUsernames: that.availableUsernames,
                userFolders: userFolders, username: that.context.username,
                icalEventTitle: that.icalEventTitle, icalEvent: that.icalEvent
            });
            that.removeSpinner();
        },
        requestLoadFolder: function(email, folderName) {
            let that = this;
            this.displaySpinner();
            let fullFolderPath = this.directoryPrefix + '/' + folderName;
            let directoryPath = peergos.client.PathUtils.directoryToPath(fullFolderPath.split('/'));
            email.dirInternal(directoryPath, this.context.username).thenApply(filenames => {
                that.loadEmails(email, fullFolderPath, filenames.toArray()).thenApply(results => {
                    that.postMessage({type: 'respondToLoadFolder', data: results, folderName: folderName});
                    that.removeSpinner();
                });
            });
        },
        requestNewFolder: function(email) {
            let that = this;
            this.prompt_placeholder = 'New Folder name';
            this.prompt_value = "";
            this.prompt_message = 'Enter a new folder name';
            this.prompt_max_input_size = 8;
            this.prompt_consumer_func = function(prompt_result) {
                if (prompt_result === null)
                    return;
                let newName = prompt_result.trim();
                if (newName === '')
                    return;
                if (newName === '.' || newName === '..')
                    return;
                if (!newName.match(/^[a-z\d\-_\s]+$/i)) {
                    that.showMessage("Invalid folder name. Use only alphanumeric characters plus space, dash and underscore");
                    return;
                }
                setTimeout(function(){
                    //make sure names are unique
                    if (that.isInbuiltFolderName(newName)) {
                        that.showMessage("Folder already exists!");
                        return;
                    }
                    for (var i=0;i < that.emailClientProperties.userFolders.length; i++) {
                        let folder = that.emailClientProperties.userFolders[i];
                        if (folder.name == newName) {
                            that.showMessage("Folder already exists!");
                            return;
                        }
                    }
                    that.displaySpinner();
                    let dirName = that.generateDirectoryName();
                    let newFolder = {name: newName, path: dirName};
                    that.emailClientProperties.userFolders.push(newFolder);
                    that.updatePropertiesFile(email, that.emailClientProperties).thenApply(res => {
                        that.removeSpinner();
                        that.postMessage({type: 'respondToNewFolder', data:  newFolder});
                    });
                });
            };
            this.showPrompt =  true;
        },
        isInbuiltFolderName: function(folderName) {
            let specialFolders = ['inbox','sent','trash','spam','archive'];
            return specialFolders.findIndex(v => v === folderName.toLowerCase()) > -1;
        },
        generateDirectoryName: function() {
          return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
          ).substring(0, 12);
        },
        postDeleteFolder: function(email, folderName) {
            let that = this;
            this.emailClientProperties.userFolders.splice(this.emailClientProperties.userFolders.findIndex(v => v.name === folderName), 1);
            this.updatePropertiesFile(email, this.emailClientProperties).thenApply(res => {
                that.removeSpinner();
                that.postMessage({type: 'respondToDeleteFolder', data: folderName});
            });
        },
        findFolderDirectory: function(folderName) {
            for (var i=0; i < this.emailClientProperties.userFolders.length; i++) {
                let folder = this.emailClientProperties.userFolders[i];
                if (folder.name == folderName) {
                    return folder.path;
                }
            }
            throw new Error("Folder not found!");
        },
        requestDeleteFolder: function(email, folderName) {
            let that = this;
            if (this.isInbuiltFolderName(folderName)) {
                return;
            }
            this.confirmDeleteFolder(folderName,
                () => { that.showConfirm = false;
                    that.displaySpinner();
                    let dirPath = peergos.client.PathUtils.directoryToPath(
                        [that.directoryPrefix, that.findFolderDirectory(folderName)]);
                    email.deleteInternal(dirPath).thenApply(function(res) {
                        that.postDeleteFolder(email, folderName);
                    }).exceptionally(function(throwable) {
                        if (throwable.toString() == "java.util.NoSuchElementException") { //Because folder is empty
                            that.postDeleteFolder(email, folderName);
                        } else {
                            that.removeSpinner();
                            that.showMessage("Unable to delete Folder");
                            console.log(throwable.getMessage());
                        }
                    });
                },
                () => { that.showConfirm = false;}
            );
        },
        confirmDeleteFolder: function(folderName, deleteFunction, cancelFunction) {
            this.confirm_message='Are you sure you want to delete folder: ' + folderName + " ?";
            this.confirm_body='';
            this.confirm_consumer_cancel_func = cancelFunction;
            this.confirm_consumer_func = deleteFunction;
            this.showConfirm = true;
        },
        requestConfirmAction: function(action, message) {
            let that = this;
            this.confirm_message= message;
            this.confirm_body='';
            this.confirm_consumer_cancel_func = function() {
                    that.postMessage({type: 'respondToConfirmAction', action: action, response: false});
                };
            this.confirm_consumer_func = function() {
                    that.postMessage({type: 'respondToConfirmAction', action: action, response: true});
                };
            this.showConfirm = true;
        },
        requestImportCalendarEvent: function(icalEvent) {
            let that = this;
            Vue.nextTick(function() {
                that.importCalendarEvent(icalEvent, that.context.username, false, true);
            });
        },
        requestRefreshInbox: function(email) {
            let that = this;
            this.displaySpinner();
            let directoryPath = peergos.client.PathUtils.directoryToPath([this.directoryPrefix, 'pending', 'inbox']);
            email.dirInternal(directoryPath).thenApply(filenames => {
                let emailsToRead = filenames.toArray([]);
                let future = peergos.shared.util.Futures.incomplete();
                that.reduceMovingEmailsToInbox(email, emailsToRead, 0, future);
                future.thenApply(done => {
                    that.removeSpinner();
                    that.requestLoadFolder(email, 'inbox');
                });
            });
        },
        reduceMovingEmailsToInbox: function(email, emailsToRead, index, future) {
            let that = this;
            if (index >= emailsToRead.length) {
                future.complete(true);
            } else {
                let filename = emailsToRead[index];
                let dirStr = this.directoryPrefix + '/pending/inbox/' + filename;
                let filePath = peergos.client.PathUtils.directoryToPath(dirStr.split('/'));
                email.readInternal(filePath).thenApply(bytes => {
                    let id = filename.substring(0, filename.lastIndexOf('.'));
                    that.moveEmailToInbox(email, bytes, id).thenApply(res => {
                        that.reduceMovingEmailsToInbox(email, emailsToRead, ++index, future);
                    });
                });
            }
        },
        moveEmailToInbox: function(email, bytes, id) {
            const that = this;
            let future = peergos.shared.util.Futures.incomplete();
            that.saveEmail(email, 'inbox', bytes, id).thenApply(function(res2) {
                that.removeEmailFromPending(email, id).thenApply(function(res) {
                    future.complete(true);
                }).exceptionally(function(throwable) {
                    that.showMessage("Unable to import email");
                    console.log(throwable.getMessage());
                    future.complete(false);
                });
            }).exceptionally(function(throwable) {
                that.showMessage("Unable to import email to inbox");
                console.log(throwable.getMessage());
                future.complete(false);
            });
            return future;
        },
        displaySpinner: function(msg) {
            this.showSpinner = true;
            if (msg != null) {
                this.spinnerMessage = msg;
            }
        },
        removeSpinner: function() {
            this.showSpinner = false;
            this.spinnerMessage = '';
        },
        showMessage: function(title, body) {
            this.messages.push({
                title: title,
                body: body,
                show: true
            });
        },
        requestShowMessage: function(msg) {
            this.showMessage(msg);
        },
        close: function () {
            this.$emit("hide-email");
        },
        uploadAttachments: function(data) {
            let that = this;
            var totalSize = 0;
            for(var i=0; i < data.attachments.length; i++) {
                totalSize += data.attachments[i].size;
            }
            let spaceAfterOperation = this.checkAvailableSpace(totalSize);
            if (spaceAfterOperation < 0) {
                that.showMessage("Attachment(s) exceeds available Space",
                    "Please free up " + this.convertBytesToHumanReadable('' + -spaceAfterOperation) + " and try again");
                return;
            }
            let future = peergos.shared.util.Futures.incomplete();
            let progressBars = [];
            for(var i=0; i < data.attachments.length; i++) {
                let attachment = data.attachments[i];
                var thumbnailAllocation = Math.min(100000, attachment.size / 10);
                var resultingSize = attachment.size + thumbnailAllocation;
                var progress = {
                    show:true,
                    title:"Encrypting and uploading " + attachment.filename,
                    done:0,
                    max:resultingSize
                };
                this.progressMonitors.push(progress);
                progressBars.push(progress);
            }
            this.reduceUploadAllAttachments(0, data.attachments, progressBars, future);
            let future2 = peergos.shared.util.Futures.incomplete();
            future.thenApply(done => {
                future2.complete(true);
            });
            return future2;
        },
        reduceUploadAllAttachments: function(index, files, progressBars, future) {
            let that = this;
            if (index == files.length) {
                future.complete(true);
            } else {
                let attachment = files[index];
                let progress = progressBars[index];
                this.uploadAttachment(attachment, progress).thenApply(function(res){
                    if (res) {
                        that.reduceUploadAllAttachments(++index, files, progressBars, future);
                    } else {
                        future.complete(false);
                    }
                });
            }
            return future;
        },
        uploadAttachment: function(attachment, progress) {
            let future = peergos.shared.util.Futures.incomplete();
            let that = this;
            let updateProgressBar = function(len){
                progress.done += len.value_0;
                if (progress.done >= progress.max) {
                    progress.show = false;
                }
            };
            this.uploadFile(attachment, updateProgressBar).thenApply(function(result) {
                if (result == null) {
                    future.complete(false);
                } else {
                    that.attachmentReferences.set(result.path, result);
                    attachment.path = result.path;
                    attachment.data = null;
                    let idx = that.progressMonitors.indexOf(progress);
                    if(idx >= 0) {
                        that.progressMonitors.splice(idx, 1);
                    }
                    future.complete(true);
                }
            });
            return future;
        },
        uploadFile: function(file, updateProgressBar) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            var data = convertToByteArray(file.data);
            let reader = new peergos.shared.user.fs.AsyncReader.ArrayBacked(data);
            let fileExtension = "";
            let dotIndex = file.filename.lastIndexOf('.');
            if (dotIndex > -1 && dotIndex <= file.filename.length -1) {
                fileExtension = file.filename.substring(dotIndex + 1);
            }
            peergos.shared.email.EmailAttachmentHelper.upload(this.context, this.context.username, this.directoryPrefix, reader, fileExtension, file.size, updateProgressBar).thenApply(function(pair) {
                var thumbnailAllocation = Math.min(100000, file.size / 10);
                updateProgressBar({ value_0: thumbnailAllocation});
                future.complete(pair.right);
            }).exceptionally(err => {
                that.showMessage("unable to upload file:" + file.filename);
                console.log(err);
                future.complete(null);
            });
            return future;
        },
    }
}
