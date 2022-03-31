<template>
<article class="chat-app">
	<AppHeader>
		<template #primary>
			<h1>Tasks view</h1>
		</template>
	</AppHeader>
    <div class="modal-mask-app" @click="close">
        <div class="modal-container full-height" @click.stop style="width:100%;overflow-y:auto;padding:0;display:flex;flex-flow:column;">
            <div class="modal-header-app">
                <span style="position:absolute;top:0;right: 0.2em;">
                    <span @click="close" style="color:black;font-size:3em;font-weight:bold;cursor:pointer;">&times;</span>
                </span>
            </div>

            <div class="modal-body" style="padding:0;display:flex;flex-grow:1;">
                <iframe id="email-client" :src="frameUrl()" style="width:100%;height:100%" frameBorder="0"></iframe>
            </div>
            <spinner v-if="showSpinner" :message="spinnerMessage"></spinner>
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
            <confirm
                    v-if="showConfirm"
                    v-on:hide-confirm="showConfirm = false"
                    :confirm_message='confirm_message'
                    :confirm_body="confirm_body"
                    :consumer_cancel_func="confirm_consumer_cancel_func"
                    :consumer_func="confirm_consumer_func">
            </confirm>
            <message
                    v-for="message in messages"
                    v-on:remove-message="messages.splice(messages.indexOf(message), 1)"
                    :title="message.title"
                    :message="message.body">
            </message>
        </div>
    </div>
</article>
</template>

<script>
const AppHeader = require("../components/AppHeader.vue");
const Gallery = require("../components/drive/DriveGallery.vue");
const ProgressBar = require("../components/drive/ProgressBar.vue");
const mixins = require("../mixins/mixins.js");
const routerMixins = require("../mixins/router/index.js");
const downloaderMixins = require("../mixins/downloader/index.js");

module.exports = {
    components: {
		Gallery,
		AppHeader,
		ProgressBar
    },
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
            directoryPrefix: 'default',
            isIframeInitialised: false,
            messages: [],
            icalEventTitle: '',
            icalEvent: ''
        }
    },
    props: [],
    computed: {
        ...Vuex.mapState([
            'quotaBytes',
            'usageBytes',
             'context',
             'socialData',
             'path'
        ]),
        ...Vuex.mapGetters([
            'isSecretLink',
            'getPath'
        ]),
         friendnames: function() {
             return this.socialData.friends;
         }
    },
    mixins:[mixins, routerMixins, downloaderMixins],
    created: function() {
        let that = this;
        var query = new URLSearchParams(window.location.search)
        if (query.get("email") == null) {
            this.$toast.error("Email client not configured", {timeout:false});
            Vue.nextTick(function() {
                that.close();
            });
        } else {
            this.displaySpinner();
            peergos.shared.user.App.init(that.context, "email").thenCompose(emailApp => {
                that.isPendingDirectoryCreated(emailApp).thenApply(isInit => {
                    if (! isInit) {
                        that.askForEmailBridgeUser(emailApp);
                    } else {
                        peergos.shared.email.EmailClient.load(emailApp, that.context.crypto, that.context).thenApply(emailClient => {
                            emailClient.getEmailAddress().thenApply(emailAddress => {
                                if (emailAddress.ref == null) {
                                    that.showToast("Awaiting approval from Email Administrator");
                                    that.close();
                                } else {
                                    that.getInputParameters().thenApply(done => {
                                        that.getPropertiesFile(emailApp).thenApply(props => {
                                            that.emailClientProperties = props;
                                            that.startListener(emailApp, emailClient, emailAddress.ref);
                                        });
                                    });
                                }
                            });
                        });
                    }
                });
            });
        }
    },
    methods: {
        getInputParameters: function() {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            const urlProps = this.getPropsFromUrl();
            let filename = urlProps.args.filename;
            if (filename == '') {
                future.complete(false);
            } else {
                this.context.getByPath(urlProps.path + '/' + filename).thenApply(fileOpt => {
                    if (! fileOpt.isPresent()) {
                        that.$toast.error("Couldn't load calendar event file", {timeout:false});
                        future.complete(false);
                    } else {
                        let file = fileOpt.get();
                        let props = file.getFileProperties();
                        file.getInputStream(that.context.network, that.context.crypto, props.sizeHigh(), props.sizeLow(), function(read) {})
                        .thenCompose(function(reader) {
                            var size = that.getFileSize(props);
                            var data = convertToByteArray(new Int8Array(size));
                            return reader.readIntoArray(data, 0, data.length)
                            .thenApply(function(read){
                                that.icalEventTitle = ""; //fixme set from event title somehow
                                that.icalEvent = new TextDecoder().decode(data);
                                future.complete(true);
                            });
                        });
                    }
                });
            }
            return future;
        },
        getFileSize: function(props) {
                var low = props.sizeLow();
                if (low < 0) low = low + Math.pow(2, 32);
                return low + (props.sizeHigh() * Math.pow(2, 32));
        },
        checkAvailableSpace: function(fileSize) {
            return Number(this.quotaBytes.toString()) - (Number(this.usageBytes.toString()) + fileSize);
        },
        getContext: function() {
            return this.context;
        },
        isPendingDirectoryCreated: function(emailApp) {
            let path = peergos.client.PathUtils.directoryToPath([this.directoryPrefix, 'pending']);
            let future = peergos.shared.util.Futures.incomplete();
            emailApp.dirInternal(path).thenApply(files => {
                let filesArray = files.toArray([]);
                future.complete(filesArray.length != 0);
            });
            return future;
        },
        askForEmailBridgeUser: function(email) {
            let that = this;
            this.prompt_placeholder='Email Bridge username';
            this.prompt_message='Set Email Bridge user';
            this.prompt_value='';
            this.prompt_consumer_func = function(prompt_result) {
                var valid = true;
                let bridgeUsername = null;
                if (prompt_result === null) {
                    valid = false;
                } else {
                    bridgeUsername = prompt_result.trim().toLowerCase();
                    let knownUsers = this.context.network.usernames.toArray([]);
                    let index = knownUsers.findIndex(v => v === bridgeUsername);
                    if (index == -1 || bridgeUsername == that.context.username) {
                        valid = false;
                    }
                }
                if (! valid) {
                    that.showError("Username does not exist:" + bridgeUsername);
                    that.close();
                } else {
                    that.displaySpinner("Creating email directories");
                    peergos.shared.email.EmailClient.load(email, that.context.crypto).thenApply(client => {
                        client.connectToBridge(that.context, bridgeUsername).thenApply(res => {
                            that.removeSpinner();
                            that.showToast("Awaiting approval from Email Administrator");
                            that.close();
                        });
                    });
                }
            }.bind(this);
            this.showPrompt = true;
        },
        frameUrl: function() {
            return this.frameDomain() + "/apps/email-client/index.html";
        },
        frameDomain: function() {
            return window.location.protocol + "//email." + window.location.host;
        },
        startListener: function(email, emailClient, emailAddress) {
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
                    if (e.data.action == 'pong') {
                        that.isIframeInitialised = true;
                    } else if(e.data.type=="displaySpinner") {
                        that.displaySpinner();
                    } else if(e.data.type=="removeSpinner") {
                        that.removeSpinner();
                    } else if(e.data.action=="requestSendEmail") {
                        that.requestSendEmail(email, emailClient, e.data.data);
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
                        if(e.data.folderName == "inbox") {
                            that.requestRefreshInbox(email, emailClient, e.data.filterStarredEmails);
                        } else if(e.data.folderName == "sent") {
                            that.requestRefreshSent(email, emailClient, e.data.filterStarredEmails);
                        } else {
                            that.requestLoadFolder(email, e.data.folderName, e.data.filterStarredEmails);
                        }
                    } else if(e.data.action=="requestNewFolder") {
                        that.requestNewFolder(email);
                    } else if(e.data.action=="requestDeleteFolder") {
                        that.requestDeleteFolder(email, e.data.folderName);
                    } else if(e.data.action=="requestShowMessage") {
                        that.requestShowMessage(e.data.message);
                    } else if(e.data.type=="requestConfirmAction") {
                        that.requestConfirmAction(e.data.action, e.data.message);
                    } else if(e.data.action=="requestImportCalendarAttachment") {
                        that.requestImportCalendarAttachment(e.data.attachment);
                    } else if(e.data.action=="requestDownloadAttachment") {
                        that.requestDownloadAttachment(emailClient, e.data.attachment);
                    } else if(e.data.action=="requestImportCalendarEvent") {
                        that.requestImportCalendarEvent(email, e.data.icalEvent);
                    } else if(e.data.action=="requestRefreshInbox") {
                        that.requestRefreshInbox(email, emailClient, false);
                    } else if(e.data.action=="requestRefreshSent") {
                        that.requestRefreshSent(email, emailClient, false);
                    }
                }
            });
            // Note that we're sending the message to "*", rather than some specific
            // origin. Sandboxed iframes which lack the 'allow-same-origin' header
            // don't have an origin which you can target: you'll have to send to any
            // origin, which might alow some esoteric attacks. Validate your output!
            let func = function() {
                that.load(email, emailAddress);
            };
            that.setupIFrameMessaging(iframe, func);
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
        postMessage: function(obj) {
            var iframe = document.getElementById("email-client");
            iframe.contentWindow.postMessage(obj, '*');
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
        removeEmailFromFolder: function(email, id, folderName) {
            let filename = id + this.EMAIL_FILE_EXTENSION;
            var folder = this.directoryPrefix + folderName;
            if (folder.endsWith('/')) {
                folder = folder.substring(0, folder.length - 1);
            }
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
                that.showError("Unable to delete email");
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
                let fullFolderPath = this.directoryPrefix + '/attachments';
                let filePath = peergos.client.PathUtils.toPath(fullFolderPath.split('/'), attachment.uuid);
                email.deleteInternal(filePath).thenApply( res => {
                    that.reduceDeletingAttachments(email, attachments, ++index, future);
                }).exceptionally(function(throwable) {
                    if (throwable.toString() == "java.util.NoSuchElementException") {
                        that.reduceDeletingAttachments(email, attachments, ++index, future);
                    } else {
                        that.showError("Unable to delete attachment:" + attachment.filename);
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
                    that.showError("Unable to delete moved email from source folder");
                    console.log(throwable.getMessage());
                    future.complete(false);
                });
            }).exceptionally(function(throwable) {
                that.showError("Unable to move email");
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
                that.showError("Unable to save email");
                console.log(throwable.getMessage());
            });
        },
        retrieveAttachment: function(uuid) {
            let path = this.context.username + '/.apps/email/data/default/attachments/' + uuid;
            return this.context.getByPath(path);
        },
        requestDownloadAttachment: function(emailClient, attachment) {
            let that = this;
            this.retrieveAttachment(attachment.uuid).thenApply(function(optFile) {
                    if (optFile.ref != null) {
                        that.downloadFile(optFile.ref, attachment.filename);
                    } else {
                        that.showError("Unable to find email attachment:" + attachment.filename);
                    }
                });
        },
        requestImportCalendarAttachment: function(attachment) {
            let path = this.context.username + '/.apps/email/data/default/attachments';
            this.openFileOrDir("Calendar", path, {filename:attachment.uuid});
        },
        buildEmailBytes: function(data) {
            let email = this.buildEmail(data, true);
            return email.toBytes();
        },

        buildEmail: function(data, recurse) {
            let that = this;
            let allAttachments = [];
            data.attachments.forEach(item => {
                let attachment = new peergos.shared.email.Attachment(item.filename, item.size,
                    item.type, item.uuid);
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
            let emailJava = new peergos.shared.email.EmailMessage(data.id, data.msgId, data.from, data.subject,
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
        requestSendEmail: function(email, emailClient, data) {
            let that = this;
            this.displaySpinner();
            //Note: msgId, timestamp and from email address are replaced serverside for security
            data.id = this.createUUID();
            data.msgId = this.createUUID();
            data.from = "";
            let timestamp = peergos.client.JsUtil.now();
            this.messageToTimestamp.set(data.id, timestamp);
            data.timestamp = timestamp.toString();
            this.uploadForwardedAttachments(email, data).thenApply(forwardedAttachments => {
                that.uploadAttachments(emailClient, data).thenApply(attachments => {
                    let javaEmail = that.buildEmail(data, true);
                    emailClient.send(javaEmail).thenApply(copiedToOutbox => {
                        that.removeSpinner();
                        if (copiedToOutbox) {
                            that.postMessage({type: 'respondToSendEmail'});
                        } else {
                            that.showError("Unable to Send Email to pending outbox");
                        }
                    });
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
                    that.showError("Unable to load file","Please close email client and try again");
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
                    {   id: emailJava.id, msgId: emailJava.msgId, from: emailJava.from, subject: emailJava.subject
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
                let attachment = {filename: item.filename, size: item.size, type: item.type, uuid: item.uuid};
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
        load: function(email, emailAddress) {
            let that = this;
            let userFolders = [];
            for(var i=0;i < that.emailClientProperties.userFolders.length;i++) {
                let folder = that.emailClientProperties.userFolders[i];
                userFolders.push({name: folder.name, path: folder.path});
            }
            that.postMessage({type: 'load',
                userFolders: userFolders, username: that.context.username, emailAddress: emailAddress,
                icalEventTitle: that.icalEventTitle, icalEvent: that.icalEvent
            });
            that.removeSpinner();
        },
        requestLoadFolder: function(email, folderName, filterStarredEmails) {
            let that = this;
            this.displaySpinner();
            let fullFolderPath = this.directoryPrefix + '/' + folderName;
            let directoryPath = peergos.client.PathUtils.directoryToPath(fullFolderPath.split('/'));
            email.dirInternal(directoryPath, this.context.username).thenApply(filenames => {
                that.loadEmails(email, fullFolderPath, filenames.toArray()).thenApply(results => {
                    that.postMessage({type: 'respondToLoadFolder', data: results, folderName: folderName, filterStarredEmails: filterStarredEmails});
                    that.removeSpinner();
                });
            });
        },
        requestNewFolder: function(email) {
            let that = this;
            this.prompt_placeholder = 'New Folder name';
            this.prompt_value = "";
            this.prompt_message = 'Enter a new folder name';
            this.prompt_max_input_size = 10;
            this.prompt_consumer_func = function(prompt_result) {
                if (prompt_result === null)
                    return;
                let newName = prompt_result.trim();
                if (newName === '')
                    return;
                if (newName === '.' || newName === '..')
                    return;
                if (!newName.match(/^[a-z\d\-_\s]+$/i)) {
                    that.showError("Invalid folder name. Use only alphanumeric characters plus space, dash and underscore");
                    return;
                }
                setTimeout(function(){
                    //make sure names are unique
                    if (that.isInbuiltFolderName(newName)) {
                        that.showError("Folder already exists!");
                        return;
                    }
                    for (var i=0;i < that.emailClientProperties.userFolders.length; i++) {
                        let folder = that.emailClientProperties.userFolders[i];
                        if (folder.name == newName) {
                            that.showError("Folder already exists!");
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
            let specialFolders = ['inbox','sent','trash','spam','archive','pending'];
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
                            that.showError("Unable to delete Folder");
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
        requestImportCalendarEvent: function(email, icalEvent) {
            //fixme. creating a temp file is not ideal
            console.log("import ical event:" + icalEvent);
            let encoder = new TextEncoder();
            let uint8Array = encoder.encode(icalEvent);
            let bytes = convertToByteArray(uint8Array);
            let path = 'default/attachments';
            let filename =  this.createUUID() + '.ics';
            let fullPath = path + '/' + filename;
            let icalFilePath = peergos.client.PathUtils.directoryToPath(fullPath.split('/'));
            let that = this;
            this.displaySpinner();
            email.writeInternal(icalFilePath, bytes).thenApply(done => {
                that.removeSpinner();
                that.openFileOrDir("Calendar", this.context.username + '/.apps/email/data/' + path, {filename:filename});
            });
        },
        requestRefreshSent: function(emailApp, emailClient, filterStarredEmails) {
            let that = this;
            this.displaySpinner();
            emailClient.getNewSent().thenApply(emails => {
                let emailsToRead = emails.toArray([]);
                let future = peergos.shared.util.Futures.incomplete();
                that.reduceMovingEmailsToSentFolder(emailClient, emailsToRead, 0, future);
                future.thenApply(done => {
                    that.removeSpinner();
                    that.requestLoadFolder(emailApp, 'sent', filterStarredEmails);
                });
            });
        },
        reduceMovingEmailsToSentFolder: function(emailClient, emailsToRead, index, future) {
            let that = this;
            if (index >= emailsToRead.length) {
                future.complete(true);
            } else {
                emailClient.moveToPrivateSent(emailsToRead[index]).thenApply(res => {
                    that.reduceMovingEmailsToSentFolder(emailClient, emailsToRead, ++index, future);
                });
            }
        },
        requestRefreshInbox: function(emailApp, emailClient, filterStarredEmails) {
            let that = this;
            this.displaySpinner();
            emailClient.getNewIncoming().thenApply(emails => {
                let emailsToRead = emails.toArray([]);
                let future = peergos.shared.util.Futures.incomplete();
                that.reduceMovingEmailsToInboxFolder(emailClient, emailsToRead, 0, future);
                future.thenApply(done => {
                    that.removeSpinner();
                    that.requestLoadFolder(emailApp, 'inbox', filterStarredEmails);
                });
            });
        },
        reduceMovingEmailsToInboxFolder: function(emailClient, emailsToRead, index, future) {
            let that = this;
            if (index >= emailsToRead.length) {
                future.complete(true);
            } else {
                emailClient.moveToPrivateInbox(emailsToRead[index]).thenApply(res => {
                    that.reduceMovingEmailsToInboxFolder(emailClient, emailsToRead, ++index, future);
                });
            }
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
        showError: function(message) {
            this.$toast.error(message, {timeout:false});
        },
        showToast: function(message) {
            this.$toast(message)
        },
        requestShowMessage: function(msg) {
            this.showMessage(msg);
        },
        close: function () {
            this.openFileOrDir("Drive", this.context.username, {filename:""});
        },
        uploadForwardedAttachments: function(email, data) {
            let future = peergos.shared.util.Futures.incomplete();
            if (data.forwardingToEmail == null) {
                future.complete(true);
            } else {
                this.reduceMovingForwardedAttachments(email, data.forwardingToEmail.attachments, 0, future);
            }
            return future;
        },
        reduceMovingForwardedAttachments: function(email, attachments, index, future) {
            let that = this;
            if (index >= attachments.length) {
                future.complete(true);
            } else {
                let attachment = attachments[index];
                let srcDirStr = this.directoryPrefix + '/attachments/' + attachment.uuid;
                let srcFilePath = peergos.client.PathUtils.directoryToPath(srcDirStr.split('/'));
                email.readInternal(srcFilePath).thenApply(bytes => {
                    let destDirStr = this.directoryPrefix + '/pending/outbox/attachments/' + attachment.uuid;
                    let destFilePath = peergos.client.PathUtils.directoryToPath(destDirStr.split('/'));
                    email.writeInternal(destFilePath, bytes).thenApply(res => {
                        that.reduceMovingForwardedAttachments(email, attachments, ++index, future);
                    }).exceptionally(function(throwable) {
                        that.showError("Unable to move attachment to pending outbox:" + destFilePath);
                        console.log(throwable.getMessage());
                        future.complete(false);
                    });
                }).exceptionally(function(throwable) {
                    that.showError("Unable to read existing attachment:" + srcFilePath);
                    console.log(throwable.getMessage());
                    future.complete(false);
                });
            }
        },
        uploadAttachments: function(emailClient, data) {
            let that = this;
            var totalSize = 0;
            for(var i=0; i < data.attachments.length; i++) {
                totalSize += data.attachments[i].size;
            }
            let spaceAfterOperation = this.checkAvailableSpace(totalSize);
            if (spaceAfterOperation < 0) {
                that.showError("Attachment(s) exceeds available Space",
                    "Please free up " + this.convertBytesToHumanReadable('' + -spaceAfterOperation) + " and try again");
                return;
            }
            let future = peergos.shared.util.Futures.incomplete();
            this.reduceUploadAllAttachments(emailClient, 0, data.attachments, future);
            let future2 = peergos.shared.util.Futures.incomplete();
            future.thenApply(done => {
                future2.complete(true);
            });
            return future2;
        },
        reduceUploadAllAttachments: function(emailClient, index, files, future) {
            let that = this;
            if (index == files.length) {
                future.complete(true);
            } else {
                let attachment = files[index];
                this.uploadAttachment(emailClient, attachment).thenApply(function(res){
                    if (res) {
                        that.reduceUploadAllAttachments(emailClient, ++index, files, future);
                    } else {
                        future.complete(false);
                    }
                });
            }
        },
        uploadAttachment: function(emailClient, attachment) {
            let future = peergos.shared.util.Futures.incomplete();
            let that = this;
            this.uploadFile(emailClient, attachment).thenApply(function(result) {
                if (result == null) {
                    future.complete(false);
                } else {
                    attachment.uuid = result;
                    attachment.data = null;
                    future.complete(true);
                }
            });
            return future;
        },
        uploadFile: function(emailClient, file) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            var data = convertToByteArray(file.data);
            emailClient.uploadAttachment(data).thenApply(function(uuid) {
                    future.complete(uuid);
            }).exceptionally(err => {
                that.showError("unable to upload file:" + file.filename);
                console.log(err);
                future.complete(null);
            });
            return future;
        },
    }
}

</script>

<style>
</style>
