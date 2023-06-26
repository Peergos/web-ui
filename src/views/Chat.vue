<template>
<article class="chat-app">
    <div class="modal-container" style="width:100%;height: 100%;" @click.stop >
        <div class="header">
            <span>
                <div id="chat-back-button" class="chat-top" style="display:none;">
                    <div>
                        <a @click="closeConversation()" style="cursor: pointer;"><i class="fa fa-arrow-left chat-back-button"></i></a>
                    </div>
                </div>
                <h3 v-if="chatTitle.length == 0" >&nbsp;</h3>
                <h3 v-if="chatTitle.length > 0" style="text-align: center;cursor: pointer;" v-on:click="editCurrentConversation()">{{ chatTitle }} &nbsp;<i class="fa fa-ellipsis-v" aria-hidden="true" style="font-size: 20px;"></i></h3>
            </span>
        </div>
        <div v-if="progressMonitors.length>0" class="progressholder">
            <progressbar
                    v-for="progress in progressMonitors" v-if="progress.show"
                    v-on:hide-progress="progressMonitors.splice(progressMonitors.indexOf(progress), 1)"
                    :title="progress.title"
                    :done="progress.done"
                    :max="progress.max" />
        </div>
        <Confirm
                v-if="showConfirm"
                v-on:hide-confirm="showConfirm = false"
                :confirm_message='confirm_message'
                :confirm_body="confirm_body"
                :consumer_cancel_func="confirm_consumer_cancel_func"
                :consumer_func="confirm_consumer_func">
        </Confirm>
        <Group
                v-if="showGroupMembership"
                v-on:hide-group="showGroupMembership = false"
                :groupId="groupId"
                :groupTitle="groupTitle"
                :existingGroupMembers="existingGroupMembers"
                :existingAdmins="existingAdmins"
                :friendNames="friendnames"
                :updatedGroupMembership="updatedGroupMembership"
                :existingGroups="existingGroups">
        </Group>
        <Message
                v-for="message in messages"
                v-on:remove-message="messages.splice(messages.indexOf(message), 1)"
                :title="message.title"
                :message="message.body">
        </Message>
        <Gallery
                v-if="showEmbeddedGallery"
                v-on:hide-gallery="showEmbeddedGallery = false"
                :files="filesToViewInGallery"
                :hideGalleryTitle="true"
                :context="context">
        </Gallery>
        <ViewProfile
            v-if="showProfileViewForm"
            v-on:hide-profile-view="showProfileViewForm = false"
            :profile="profile">
        </ViewProfile>
        <Spinner v-if="showSpinner" :message="spinnerMessage"></Spinner>
        <div class="chat-container">
            <div class="chat-messaging">
                <div class="chat-border">
                    <div id="chat-left-panel" class="chat-left-panel">
                        <div class="chat-actions">
                            <div class="chat-action-heading">
                                <h4>
                                    <button :disabled="executingCommands" class="btn btn-success" @click="fullRefresh()" >
                                        <i v-if="executingCommands" class="fa fa-sync-alt fa-spin" aria-hidden="true"></i>
                                        <i v-if="!executingCommands" class="fa fa-sync-alt" aria-hidden="true"></i>
                                    </button>
                                    <button class="btn btn-success" @click="newConversation()" >
                                        <i class="fa fa-user-plus" aria-hidden="true"></i>
                                    </button>
                                </h4>
                            </div>
                            <div class="chat-message-search">
                                <span class="input-group-addon">
                                    <input id="filter-conversations" type="text" style="line-height: 20px;" v-model="filterText" :maxlength="15"  v-on:keyup.enter="filterConversations()" placeholder="Filter">
                                    <button type="button" @click="filterConversations()"> <i class="fa fa-filter" aria-hidden="true"></i> </button>
                                </span>
                            </div>
                        </div>
                        <div id="conversations-container" class="conversations">
                            <div v-for="(status, idx) in statusMessages">
                                <div v-if="idx > 0" class="status-message-container">
                                    <div class="status-message">
                                        <p>{{status}}</p>
                                    </div>
                                </div>
                            </div>
                            <div v-for="conversation in conversations">
                                <div @click="selectConversation(conversation)" v-bind:class="{ conversationContainer: true, activeConversation: isConversationSelected(conversation) }">
                                    <div class="chat_img">
                                        <img v-if="conversation.hasProfileImage" v-on:click="viewProfile(conversation)" v-bind:src="conversation.profileImage" class="img-thumbnail-chat">
                                        <span v-if="!conversation.hasProfileImage && conversation.participants.length <= 1" v-on:click="viewProfile(conversation)" class="fa fa-user picon-chat img-thumbnail-chat"> </span>
                                        <span v-if="!conversation.hasProfileImage && conversation.participants.length > 1" class="fa fa-users picon-chat img-thumbnail-chat"> </span>
                                    </div>
                                    <div class="conversation" v-if="conversation.hasUnreadMessages">
                                        <h5><b>{{displayTitle(conversation)}}</b><span>{{conversation.lastModified}}</span></h5>
                                        <p v-if="!conversation.readonly">{{truncateText(conversation.blurb,40)}}</p>
                                        <p><b v-if="displayChatAccessRemoved(conversation)">Access Removed</b>
                                            <button :disabled="executingCommands" v-if="conversation.readonly" class="btn btn-danger" @click="removeConversation(conversation.id)" >Delete</button>
                                        </p>
                                    </div>
                                    <div class="conversation" v-if="!conversation.hasUnreadMessages">
                                        <h5>{{displayTitle(conversation)}}<span>{{conversation.lastModified}}</span></h5>
                                        <p v-if="!conversation.readonly">{{truncateText(conversation.blurb,40)}}</p>
                                        <p><b v-if="displayChatAccessRemoved(conversation)">Access Removed</b>
                                            <button v-if="conversation.readonly" class="btn btn-danger" @click="removeConversation(conversation.id)" >Delete</button>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="chat-messages" id="dnd-chat" @drop="dndChatDrop($event)" @dragover.prevent>
                        <div id="message-scroll-area" class="chat-messages-container">

                            <div v-for="(status, idx) in statusMessages">
                                <div v-if="idx == 0" class="status-message-container">
                                    <div class="status-message status-message-bold">
                                        <p>{{status}}</p>
                                    </div>
                                </div>
                            </div>
                            <div v-for="message in messageThread">
                                <div v-if="message.isStatusMsg" class="status-message-container">
                                    <div class="status-message">
                                        <p>{{message.sendTime}} - {{message.contents}}</p>
                                    </div>
                                </div>
                                <div v-if="message.parentMessage == null">
                                    <div v-if="!message.isStatusMsg && message.sender != context.username" class="received-message-container">
                                        <div class="received-message">
                                            <div v-for="(mediaFile, idx) in message.mediaFiles" class="attachment-view-container">
                                                <img v-if="mediaFile.hasThumbnail" v-on:click="view(message, idx)" v-bind:src="mediaFile.thumbnail" style="cursor: pointer; margin-bottom: 10px; margin-top: 10px;"/>
                                                <span v-if="!mediaFile.hasThumbnail">
                                                    <AppIcon style="height:100px" @click.stop.native="view(message, idx)" class="card__icon" :icon="getFileIcon(mediaFile.file, mediaFile.fileType)"></AppIcon>
                                                </span>
                                            </div>
                                            <p v-if="message.contents.length > 0">{{message.contents}}</p>
                                            <span v-if="message.sendTime.length == 0" class="chat-message-info"><i class="fa fa-reply" @click="reply(message)" style="cursor: pointer"></i> | {{message.sender}} | <i class="fa fa-spinner fa-spin"></i> <i v-if="message.edited && !message.deleted">&nbsp; [edited]</i></span>
                                            <span v-if="message.sendTime.length > 0" class="chat-message-info"><i class="fa fa-reply" @click="reply(message)" style="cursor: pointer"></i> | {{message.sender}} | {{message.sendTime}} <i v-if="message.edited && !message.deleted">&nbsp; [edited]</i></span>
                                        </div>
                                    </div>
                                    <div v-if="!message.isStatusMsg && message.sender == context.username" class="sent-message-container">
                                        <div class="sent-message">
                                            <div v-for="(mediaFile, idx) in message.mediaFiles" class="attachment-view-container">
                                                <img v-if="mediaFile.hasThumbnail" v-on:click="view(message, idx)" v-bind:src="mediaFile.thumbnail" style="cursor: pointer; margin-bottom: 10px; margin-top: 10px;"/>
                                                <span v-if="!mediaFile.hasThumbnail">
                                                    <AppIcon style="height:100px" @click.stop.native="view(message, idx)" class="card__icon" :icon="getFileIcon(mediaFile.file, mediaFile.fileType)"></AppIcon>
                                                </span>
                                            </div>
                                            <p v-if="message.contents.length > 0">{{message.contents}}</p>
                                            <span v-if="message.sendTime.length == 0" class="chat-message-info"><i class="fa fa-reply" @click="reply(message)" style="cursor: pointer"></i> <b>|</b> {{message.sender}} <b>|</b> <i class="fa fa-spinner fa-spin"></i> <b v-if="!message.deleted">|</b> <i v-if="!message.deleted" class="fa fa-edit" @click="edit(message)" style="cursor: pointer"></i> <b v-if="!message.deleted">|</b> <i v-if="!message.deleted" class="fa fa-trash-alt" @click="deleteMessage(message)" style="cursor: pointer"></i><i v-if="message.edited && !message.deleted">&nbsp; [edited]</i></span>
                                            <span v-if="message.sendTime.length > 0" class="chat-message-info"><i class="fa fa-reply" @click="reply(message)" style="cursor: pointer"></i> <b>|</b> {{message.sender}} <b>|</b>  {{message.sendTime}} <b v-if="!message.deleted">|</b> <i v-if="!message.deleted" class="fa fa-edit" @click="edit(message)" style="cursor: pointer"></i> <b v-if="!message.deleted">|</b> <i v-if="!message.deleted" class="fa fa-trash-alt" @click="deleteMessage(message)" style="cursor: pointer"></i><i v-if="message.edited && !message.deleted">&nbsp; [edited]</i></span>
                                        </div>
                                    </div>
                                </div>
                                <div v-if="message.parentMessage != null">
                                    <div v-if="!message.isStatusMsg && message.sender != context.username" style="margin-top: 10px;">
                                        <div class="parent-message">
                                            <div v-bind:class="[message.parentMessage.sender == context.username ? 'sent-message-container' : 'received-message-container']">
                                                <div v-bind:class="['parent-message', message.parentMessage.sender == context.username ? 'sent-message' : 'received-message']">
                                                    <div v-for="(mediaFile, idx) in message.parentMessage.mediaFiles" class="attachment-view-container">
                                                        <img v-if="mediaFile.hasThumbnail" v-on:click="view(message.parentMessage, idx)" v-bind:src="mediaFile.thumbnail" style="cursor: pointer; margin-bottom: 10px; margin-top: 10px;"/>
                                                        <span v-if="!mediaFile.hasThumbnail">
                                                            <AppIcon style="height:100px" @click.stop.native="view(message.parentMessage, idx)" class="card__icon" :icon="getFileIcon(mediaFile.file, mediaFile.fileType)"></AppIcon>
                                                        </span>
                                                    </div>
                                                    <p v-if="message.parentMessage.contents.length > 0" v-bind:class="[message.parentMessage.sender == context.username ? 'reply-to-own-message' : 'reply-to-others-message']">{{message.parentMessage.contents}}</p>
                                                    <span v-if="message.parentMessage.sendTime.length == 0" class="chat-message-info">Original message: {{message.parentMessage.sender}} | <i class="fa fa-spinner fa-spin"></i>  <i v-if="message.parentMessage.edited && !message.parentMessage.deleted">&nbsp; [edited]</i></span>
                                                    <span v-if="message.parentMessage.sendTime.length > 0" class="chat-message-info">Original message: {{message.parentMessage.sender}} | {{message.parentMessage.sendTime}}  <i v-if="message.parentMessage.edited && !message.parentMessage.deleted">&nbsp; [edited]</i></span>
                                                </div>
                                            </div>
                                            <div class="received-message-container">
                                                <div class="received-message">
                                                    <div v-for="(mediaFile, idx) in message.mediaFiles" class="attachment-view-container">
                                                        <img v-if="mediaFile.hasThumbnail" v-on:click="view(message, idx)" v-bind:src="mediaFile.thumbnail" style="cursor: pointer; margin-bottom: 10px; margin-top: 10px;"/>
                                                        <span v-if="!mediaFile.hasThumbnail">
                                                            <AppIcon style="height:100px" @click.stop.native="view(message, idx)" class="card__icon" :icon="getFileIcon(mediaFile.file, mediaFile.fileType)"></AppIcon>
                                                        </span>
                                                    </div>
                                                    <p v-if="message.contents.length > 0">{{message.contents}}</p>
                                                    <span v-if="message.sendTime.length == 0" class="chat-message-info"><i class="fa fa-reply" @click="reply(message)" style="cursor: pointer"></i> | {{message.sender}} | <i class="fa fa-spinner fa-spin"></i> <i v-if="message.edited && !message.deleted">&nbsp; [edited]</i></span>
                                                    <span v-if="message.sendTime.length > 0" class="chat-message-info"><i class="fa fa-reply" @click="reply(message)" style="cursor: pointer"></i> | {{message.sender}} | {{message.sendTime}} <i v-if="message.edited && !message.deleted">&nbsp; [edited]</i></span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div v-if="!message.isStatusMsg && message.sender == context.username" style="margin-top: 10px;">
                                        <div class="parent-message">
                                            <div v-bind:class="[message.parentMessage.sender == context.username ? 'sent-message-container' : 'received-message-container']">
                                                <div v-bind:class="['parent-message', message.parentMessage.sender == context.username ? 'sent-message' : 'received-message']">
                                                    <div v-for="(mediaFile, idx) in message.parentMessage.mediaFiles" class="attachment-view-container">
                                                        <img v-if="mediaFile.hasThumbnail" v-on:click="view(message.parentMessage, idx)" v-bind:src="mediaFile.thumbnail" style="cursor: pointer; margin-bottom: 10px; margin-top: 10px;"/>
                                                        <span v-if="!mediaFile.hasThumbnail">
                                                            <AppIcon style="height:100px" @click.stop.native="view(message.parentMessage, idx)" class="card__icon" :icon="getFileIcon(mediaFile.file, mediaFile.fileType)"></AppIcon>
                                                        </span>
                                                    </div>
                                                    <p v-if="message.parentMessage.contents.length > 0" v-bind:class="[message.parentMessage.sender == context.username ? 'reply-to-own-message' : 'reply-to-others-message']">{{message.parentMessage.contents}}</p>
                                                    <span v-if="message.parentMessage.sendTime.length == 0" class="chat-message-info">Original message: {{message.parentMessage.sender}} | <i class="fa fa-spinner fa-spin"></i> <i v-if="message.parentMessage.edited && !message.parentMessage.deleted">&nbsp; [edited]</i></span>
                                                    <span v-if="message.parentMessage.sendTime.length > 0" class="chat-message-info">Original message: {{message.parentMessage.sender}} |  {{message.parentMessage.sendTime}} <i v-if="message.parentMessage.edited && !message.parentMessage.deleted">&nbsp; [edited]</i></span>
                                                </div>
                                            </div>
                                            <div class="sent-message-container">
                                                <div class="sent-message">
                                                    <div v-for="(mediaFile, idx) in message.mediaFiles" class="attachment-view-container">
                                                        <img v-if="mediaFile.hasThumbnail" v-on:click="view(message, idx)" v-bind:src="mediaFile.thumbnail" style="cursor: pointer; margin-bottom: 10px; margin-top: 10px;"/>
                                                        <span v-if="!mediaFile.hasThumbnail">
                                                            <AppIcon style="height:100px" @click.stop.native="view(message, idx)" class="card__icon" :icon="getFileIcon(mediaFile.file, mediaFile.fileType)"></AppIcon>
                                                        </span>
                                                    </div>
                                                    <p v-if="message.contents.length > 0">{{message.contents}}</p>
                                                    <span v-if="message.sendTime.length == 0" class="chat-message-info"><i class="fa fa-reply" @click="reply(message)" style="cursor: pointer"></i> <b>|</b> {{message.sender}} <b>|</b> <i class="fa fa-spinner fa-spin"></i> <b v-if="!message.deleted">|</b> <i v-if="!message.deleted" class="fa fa-edit" @click="edit(message)" style="cursor: pointer"></i> <b v-if="!message.deleted">|</b> <i v-if="!message.deleted" class="fa fa-trash-alt" @click="deleteMessage(message)" style="cursor: pointer"></i><i v-if="message.edited && !message.deleted">&nbsp; [edited]</i></span>
                                                    <span v-if="message.sendTime.length > 0" class="chat-message-info"><i class="fa fa-reply" @click="reply(message)" style="cursor: pointer"></i> <b>|</b> {{message.sender}} <b>|</b>  {{message.sendTime}} <b v-if="!message.deleted">|</b> <i v-if="!message.deleted" class="fa fa-edit" @click="edit(message)" style="cursor: pointer"></i> <b v-if="!message.deleted">|</b> <i v-if="!message.deleted" class="fa fa-trash-alt" @click="deleteMessage(message)" style="cursor: pointer"></i><i v-if="message.edited && !message.deleted">&nbsp; [edited]</i></span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div v-if="replyToMessage != null" class="reply-draft-container">
                            <div class="reply-draft-message">
                                <div v-for="(mediaFile, idx) in replyToMessage.mediaFiles" class="attachment-view-container">
                                    <img v-if="mediaFile.hasThumbnail" v-on:click="view(replyToMessage, idx)" v-bind:src="mediaFile.thumbnail" style="cursor: pointer; margin-bottom: 10px; margin-top: 10px;"/>
                                    <span v-if="!mediaFile.hasThumbnail">
                                        <AppIcon style="height:100px" @click.stop.native="view(replyToMessage, idx)" class="card__icon" :icon="getFileIcon(mediaFile.file, mediaFile.fileType)"></AppIcon>
                                    </span>
                                </div>
                                <p v-if="replyToMessage.contents.length > 0" v-bind:class="[replyToMessage.sender == context.username ? 'reply-to-own-message' : 'reply-to-others-message']">{{replyToMessage.contents}}</p>
                                <span v-if="replyToMessage.sendTime.length == 0" class="chat-message-info">{{replyToMessage.sender}} | <i class="fa fa-spinner fa-spin"></i> <i v-if="replyToMessage.edited && !replyToMessage.deleted">&nbsp; [edited]</i></span>
                                <span v-if="replyToMessage.sendTime.length > 0" class="chat-message-info">{{replyToMessage.sender}} | {{replyToMessage.sendTime}} <i v-if="replyToMessage.edited && !replyToMessage.deleted">&nbsp; [edited]</i></span>
                                <p class="reply-to-delete-draft fa fa-trash-alt" @click="deleteReply()" style="cursor: pointer"></p>
                            </div>
                        </div>
                        <div v-if="editMessage != null" class="reply-draft-container">
                            <div class="reply-draft-message">
                                <p v-if="editMessage.contents.length > 0" class="reply-to-own-message">{{editMessage.contents}}</p>
                                <span  v-if="editMessage.sendTime.length == 0" class="chat-message-info"> <i class="fa fa-spinner fa-spin"></i> <i v-if="editMessage.edited && !editMessage.deleted">&nbsp; [edited]</i></span>
                                <span  v-if="editMessage.sendTime.length > 0" class="chat-message-info">{{editMessage.sendTime}} <i v-if="editMessage.edited && !editMessage.deleted">&nbsp; [edited]</i></span>
                                <p class="reply-to-delete-draft fa fa-trash-alt" @click="deleteEdit()" style="cursor: pointer"></p>
                            </div>
                        </div>
                        <div v-if="attachmentList.length > 0" class="attachment">
                            <div v-for="attachment in attachmentList" class="attachment-container">
                                <img v-if="attachment.mediaFile != null && attachment.mediaFile.getFileProperties().thumbnail.ref != null" v-bind:src="attachment.mediaFile.getBase64Thumbnail()" style="cursor: pointer; margin-bottom: 10px;"/>
                                <span v-if="attachment.mediaFile != null && attachment.mediaFile.getFileProperties().thumbnail.ref == null">
                                    <AppIcon style="height:100px" class="card__icon" :icon="getFileIcon(attachment.mediaFile, attachment.mediaFile.getFileProperties().getType())"></AppIcon>
                                </span>

                                <p class="attachment-delete-btn fa fa-trash-alt" @click="deleteAttachment(attachment)" style="cursor: pointer"></p>
                            </div>
                        </div>
                        <div id="new-message-id" class="new-message-container chat-hide">
                            <div class="new-message">
                                <span>
                                    <textarea id='message-input' rows="1" v-model="newMessageText"  v-on:keyup.enter="send()" placeholder="Type a message" class="prevent-resize"  @input="checkMessageLength"></textarea>
                                </span>
                                <div>
                                    <span>
                                        <button id="emojiBtn" :disabled="selectedConversationId == null || selectedConversationIsReadOnly" class="chat-btn btn-success emoji-btn" type="button" @click="launchEmojiPicker()">
                                            <i class="fa fa-smile" aria-hidden="true"></i>
                                        </button>
                                        <input type="file" id="uploadInput" @change="addAttachments" style="display:none;" multiple />
                                        <button id="attachmentBtn" :disabled="selectedConversationId == null || selectedConversationIsReadOnly" class="chat-btn btn-success attachment-btn" type="button" @click="launchUploadDialog()">
                                            <i class="fa fa-paperclip" aria-hidden="true"></i>
                                        </button>
                                        <button id="sendNewMessageBtn" :disabled="newMessageText.length == 0 || selectedConversationId == null || selectedConversationIsReadOnly" class="chat-btn btn-success send-new-message-btn" type="button" @click="send()">
                                            <i class="fa fa-paper-plane" aria-hidden="true"></i>
                                        </button>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</article>
</template>

<script>
import AppHeader from "../components/AppHeader.vue";
import AppIcon from "../components/AppIcon.vue";
import Confirm from "../components/confirm/Confirm.vue";
import Gallery from "../components/drive/DriveGallery.vue";
import ViewProfile from "../components/profile/ViewProfile.vue";
import Group from "../components/Group.vue";
import mixins from "../mixins/mixins.js";
import routerMixins from "../mixins/router/index.js";
import downloaderMixins from "../mixins/downloader/index.js";
import ProgressBar from "../components/drive/ProgressBar.vue";
import Message from "../components/message/Message.vue";
import Spinner from "../components/spinner/Spinner.vue";

import Vuex from "vuex"

export default {
    components: {
        AppIcon,
        Confirm,
		Gallery,
		ViewProfile,
		Group,
        ProgressBar,
		AppHeader,
		Message,
		Spinner
    },
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
            showProfileViewForm:false,
            profile: {
                firstName: "",
                lastName: "",
                biography: "",
                primaryPhone: "",
                primaryEmail: "",
                profileImage: "",
                status: "",
                webRoot: ""
            },
            hideAppToAppConversations: true
        }
    },
    props: [],
    computed: {
		...Vuex.mapState([
            'quotaBytes',
            'usageBytes',
		    'context',
            "socialData"
		]),
        friendnames: function() {
            return this.socialData.friends;
        },
    },
    mixins:[mixins, routerMixins, downloaderMixins],
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
        viewAction: function(path, file) {
            let app = this.getApp(file, path)
            this.openFileOrDir(app, path, {filename:file.isDirectory() ? "" : file.getName()})
        },
        displayProfile: function(username){
            this.showSpinner = true;
            let that = this;
            let context = this.context;
            peergos.shared.user.ProfilePaths.getProfile(username, context).thenApply(profile => {
                var base64Image = "";
                if (profile.profilePhoto.isPresent()) {
                    var str = "";
                    let data = profile.profilePhoto.get();
                    for (let i = 0; i < data.length; i++) {
                        str = str + String.fromCharCode(data[i] & 0xff);
                    }
                    if (data.byteLength > 0) {
                        base64Image = "data:image/png;base64," + window.btoa(str);
                    }
                }
                that.profile = {
                    firstName: profile.firstName.isPresent() ? profile.firstName.get() : "",
                    lastName: profile.lastName.isPresent() ? profile.lastName.get() : "",
                    biography: profile.bio.isPresent() ? profile.bio.get() : "",
                    primaryPhone: profile.phone.isPresent() ? profile.phone.get() : "",
                    primaryEmail: profile.email.isPresent() ? profile.email.get() : "",
                    profileImage: base64Image,
                    status: profile.status.isPresent() ? profile.status.get() : "",
                    webRoot: profile.webRoot.isPresent() ? profile.webRoot.get() : ""
                };
                that.showSpinner = false;
                that.showProfileViewForm = true;
            });
        },
        getFileIconFromFileAndType: function(file, type) {
            // TODO unify this with the one on DriveGridCard
            if (type == 'dir') 	return 'folder--72';
            if (type == 'image') 	return 'file-image--72';
            if (type == 'text') 	return 'file-text--72';
            if (type == 'audio') 	return 'file-audio--72';
            if (type == 'video') 	return 'file-video--72';
            if (type == 'pdf') 	return 'file-pdf--72';
            if (type == 'zip') 	return 'file-zip--72';
            if (type == 'todo') 	return 'tasks--72';
            if (type == 'calendar') 	return 'calendar--72';
            if (type == 'contact file') 	return 'file-card--72';
            if (type == 'powerpoint presentation' || type == 'presentation') 	return 'file-powerpoint--72';
            if (type == 'word document' || type == 'text document') 	return 'file-word--72';
            if (type == 'excel spreadsheet' || type == 'spreadsheet') 	return 'file-excel--72';
                return 'file-generic--72';
        },
        checkAvailableSpace: function(fileSize) {
            return Number(this.quotaBytes.toString()) - (Number(this.usageBytes.toString()) + fileSize);
        },
        checkMessageLength: function(e) {
            let newMessageValue = e.target.value;
            if (newMessageValue.length > this.newMessageMaxLength) {
                this.newMessageText = this.truncateText(newMessageValue, this.newMessageMaxLength);
                this.showToastWarning("Message has been truncated to " + this.newMessageMaxLength + " characters");
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
        showToastError: function(title, message) {
            let bodyContents = body == null ? '' : ' ' + body;
            this.$toast.error(title + bodyContents, {timeout:false});
        },
        showToastWarning: function(title, message) {
            let bodyContents = body == null ? '' : ' ' + body;
            this.$toast(title + bodyContents);
        },
        resizeHandler: function() {
            var left = document.getElementById("chat-left-panel");
            if (left == null) {
                return;
            }
            var right = document.getElementById("dnd-chat");

            var conversationsContainer = document.getElementById("conversations-container");
            conversationsContainer.style.height = window.innerHeight - 160 + 'px';
            var chatContainer = document.getElementById("message-scroll-area");
            chatContainer.style.height = window.innerHeight - 165 + 'px';

            let closeConversationEl = document.getElementById('chat-back-button');
            if (this.displayingMessages) {
                left.classList.remove("chat-full-width");
                right.classList.remove("chat-hide");

                let emojiBtn = document.getElementById('emojiBtn');
                let attachmentBtn = document.getElementById('attachmentBtn');
                let sendNewMessageBtn = document.getElementById('sendNewMessageBtn');

                if(window.innerWidth >= 900) {
                    left.classList.remove("chat-hide");
                    right.classList.remove("chat-full-width");
                    closeConversationEl.style.display = 'none';

                    emojiBtn.style.position ='absolute';
                    attachmentBtn.style.position ='absolute';
                    sendNewMessageBtn.style.position ='absolute';
                } else if(window.innerWidth <= 900) {
                    left.classList.add("chat-hide");
                    right.classList.add("chat-full-width");
                    closeConversationEl.style.display = '';

                    emojiBtn.style.position ='inherit';
                    attachmentBtn.style.position ='inherit';
                    sendNewMessageBtn.style.position ='inherit';
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
            that.checkChatState(conversation);
            that.loadOutstandingMediaForConversation(conversation);
        },
        loadOutstandingMediaForConversation: function(conversation) {
            let that = this;
            let chatController = this.allChatControllers.get(conversation.id);
            if (chatController.pendingAttachmentRefs.length > 0) {
                this.loadAttachments(chatController).thenApply(attachmentMap => {
                    let currentMessageThread = that.allMessageThreads.get(conversation.id);
                    for(var i = 0; i < currentMessageThread.length; i++) {
                        let entry = currentMessageThread[i];
                        if (entry.mediaFiles != null && entry.mediaFiles.length > 0) {
                            for(var j = 0; j < entry.mediaFiles.length; j++) {
                                let item = entry.mediaFiles[j];
                                if (!item.loaded) {
                                    let mediaFile = attachmentMap.get(item.path);
                                    if (mediaFile != null) {
                                        let fileType = mediaFile.getFileProperties().getType();
                                        let thumbnail = mediaFile.getFileProperties().thumbnail.ref != null ? mediaFile.getBase64Thumbnail() : "";
                                        item.fileType = fileType;
                                        item.file = mediaFile;
                                        item.thumbnail = thumbnail;
                                        item.hasThumbnail = thumbnail.length > 0;
                                        item.loaded = true;
                                    }
                                }
                            }
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
                item.triedLoadingProfileImage = true;
                peergos.shared.user.ProfilePaths.getProfilePhoto(item.participants[0], this.context).thenApply(result => {
                    if (result.ref != null) {
                        item.profileImage = that.toBase64Image(result.ref);
                        item.hasProfileImage = true;
                    } else {
                        item.hasProfileImage = false;
                    }
                    that.reduceLoadAllConversationIcons(index+1, items);
                }).exceptionally(function(throwable) {
                    item.hasProfileImage = false;
                    that.reduceLoadAllConversationIcons(index+1, items);
                });
            }
        },
        loadConversationIcons: function(items) {
            this.reduceLoadAllConversationIcons(0, items);
        },
        launchEmojiPicker: function() {
            this.emojiPicker.togglePicker(this.emojiChooserBtn);
            var emojiElement = document.getElementsByClassName("wrapper");
            emojiElement[0].classList.add("emoji-position");
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
                        that.showToastError("error deleting attachment");
                        future.complete(false);
                    });
                }).exceptionally(function(throwable) {
                    console.log(throwable);
                    that.showToastError("error finding attachment");
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
        viewProfile: function(conversation) {
            this.displayProfile(conversation.participants[0], false);
        },
        launchUploadDialog: function() {
            document.getElementById('uploadInput').click();
        },
        dndChatDrop: function(evt) {
            evt.preventDefault();
            if (this.selectedConversationId == null) {
                this.showToastError("Select chat before adding media");
                return;
            }
            let entries = evt.dataTransfer.items;
            for(var i=0; i < entries.length; i++) {
                let entry = entries[i].webkitGetAsEntry();
                if (entry.isDirectory || !entry.isFile) {
                    this.showToastError("Only files can be dragged and dropped");
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
            } else {
                let slash = currentMediaItem.path.lastIndexOf('/');
                let dir = currentMediaItem.path.substring(0, slash);
                let filename = currentMediaItem.path.substring(slash +1);
                if(currentMediaItem.fileType == 'pdf' || currentMediaItem.fileType == 'text' || currentMediaItem.fileType == 'calendar'){
                    this.viewAction(dir, currentMediaItem.file);
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
                that.showToastError("Media file greater than 200 MiB not currently supported!", "Instead, you can upload a larger file to your drive and share it with a secret link here");
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
                        that.showToastError("unable to get uploaded media");
                        console.log(err);
                        future.complete(null);
                    });
                }).exceptionally(err => {
                    that.showToastError("unable to upload media");
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
                    title:"Encrypting and uploading " + mediaFile.name,
                    done:0,
                    max:resultingSize,
                    name: mediaFile.name
                };
                this.$toast({component: ProgressBar,props:  progress,}
                    , { icon: false , timeout:false, id: mediaFile.name})
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
                that.showToastError("Attachment(s) exceeds available Space",
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
                that.$toast.update(progress.name, {content:
                    {
                        component: ProgressBar,
                        props:  {
                        title: progress.title,
                        done: progress.done,
                        max: progress.max
                        },
                    }
                });
                if (progress.done >= progress.max) {
                    that.$toast.dismiss(progress.name);
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
            let currentMembers = conversation.currentMembers;
            for(var j = 0; j < messagePairs.length; j++) {
                let chatEnvelope = messagePairs[j].message;
                let messageHash = messagePairs[j].hash;
                let payload = chatEnvelope.payload;
                let type = payload.type().toString();
                let author = chatController.controller.getUsername(chatEnvelope.author);
                if (type == 'GroupState') {//type
                    if(payload.key == "title") {
                        messageThread.push(this.createStatusMessage(chatEnvelope.creationTime, "Chat name changed to " + payload.value));
                        let conversation = this.allConversations.get(conversationId);
                        conversation.title = payload.value;
                    } else if(payload.key == "admins") {
                        messageThread.push(this.createStatusMessage(chatEnvelope.creationTime, "Chat admins changed to " + payload.value));
                        let conversation = this.allConversations.get(conversationId);
                        conversation.currentAdmins = payload.value.split(",");
                    }
                } else if(type == 'Invite') {
                    let username = chatEnvelope.payload.username;
                    messageThread.push(this.createStatusMessage(chatEnvelope.creationTime, author + " invited " + username));
                    currentMembers.push(username);
                } else if(type == 'RemoveMember') {
                    let username = chatController.controller.getUsername(chatEnvelope.payload.memberToRemove);
                    if (author == username) {
                        messageThread.push(this.createStatusMessage(chatEnvelope.creationTime, username + " left"));
                    } else {
                        messageThread.push(this.createStatusMessage(chatEnvelope.creationTime, author + " removed " + username));
                    }
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
            setTimeout(intervalFunc, 10 * 1000);
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

            this.listChats().thenApply(function(allChats) {
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
                        let conversation = that.allConversations.get(conversationId);
                        that.checkChatState(conversation);
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
        listChats: function() {
            let future = peergos.shared.util.Futures.incomplete();
            this.messenger.listChats().thenApply(function(chats) {
                let allChats = chats.toArray();
                let filteredChats = [];
                for(var i = 0; i < allChats.length; i++) {
                    let chat = allChats[i];
                    if(!chat.chatUuid.startsWith("chat-")) {
                        filteredChats.push(chat);
                    }
                }
                future.complete(filteredChats);
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
            if (!conversation.readonly && ! conversation.chatVisibilityWarningDisplayed) {
                let participants = conversation.participants;
                let friendsInChat = this.friendnames.filter(friend => participants.findIndex(v => v === friend) > -1);
                if (friendsInChat.length == 0) {
                    conversation.chatVisibilityWarningDisplayed = true;
                    this.showToastError("Chat no longer contains any of your friends. Your messages will not be seen by others");
                }
            }
        },
        displayChatAccessRemoved: function(conversation) {
            if (this.showSpinner) {
                return false;
            }
            let currentAdmins = conversation.currentAdmins;
            if (currentAdmins.length == 0 || (currentAdmins.length == 1 && currentAdmins[0] == this.context.username
                && conversation.participants.length == 0)) {
                return false;
            }
            return conversation.readonly;
        },
        refreshConversation: function(conversationId) {
            var that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let chatController = this.allChatControllers.get(conversationId);
            that.messenger.mergeAllUpdates(chatController.controller, this.socialData).thenApply(latestController => {
                chatController.controller = latestController;
                let origParticipants = latestController.getMemberNames().toArray();
                let participants = that.removeSelfFromParticipants(origParticipants);
                let conversation = that.allConversations.get(conversationId);
                conversation.participants = participants;
                conversation.readonly = origParticipants.length == participants.length || participants.length == 0;
                that.checkChatState(conversation);
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
                that.showToastError("error deleting chat");
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
                        {controller: controller, startIndex: 0, pendingAttachmentRefs: []});
                    let item = {id: conversationId, title: updatedGroupTitle, participants: updatedMembers
                        , readonly: false, currentAdmins: [that.context.username], currentMembers: [that.context.username]
                        , hasUnreadMessages: false, chatVisibilityWarningDisplayed: false, triedLoadingProfileImage: false, hasProfileImage: false };
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
                    that.showToastError("Unable to create chat");
                    that.spinner(false);
                    console.log(err);
                    future.complete(false);
                });
            } else {
                conversation.hasProfileImage = false;
                conversation.profileImage = "";
                if (updatedMembers.length == 1) {
                    conversation.triedLoadingProfileImage = false;
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
                if (this.displayChatAccessRemoved(conversation)) {
                    return;
                }
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
                        that.showToastError("Unable to add members to chat");
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
                    that.showToastError("Unable to remove " + username + " from chat");
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
                    that.showToastError("Unable to add " + username + " as chat admin");
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
                    that.showToastError("Unable to remove " + username + " as chat admin");
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
        initialiseChats: function(controllers) {
            let that = this;
            controllers.forEach(controller => {
                chatController = {controller:controller, startIndex: 0, pendingAttachmentRefs: []};
                that.allChatControllers.set(controller.chatUuid, chatController);
                that.allMessageThreads.set(controller.chatUuid, []);
                let origParticipants = controller.getMemberNames().toArray();
                let participants = that.removeSelfFromParticipants(origParticipants);
                let readonly = origParticipants.length == participants.length || participants.length == 0;
                let conversation = {id: controller.chatUuid, participants: participants, readonly: readonly
                    , title: controller.getTitle(), currentAdmins: [], currentMembers: [], hasUnreadMessages: false
                    , chatVisibilityWarningDisplayed: false};
                let recentMessages = controller.getRecent().toArray();
                let latestMessage = recentMessages.length == 0 ? null : recentMessages[recentMessages.length-1];
                if (latestMessage != null) {
                    conversation.blurb = that.decodeLatestMessage(latestMessage);
                    conversation.lastModified = that.fromUTCtoLocal(latestMessage.creationTime);
                } else {
                    conversation.blurb = "";
                    conversation.lastModified = "";
                }
                conversation.triedLoadingProfileImage = false;
                conversation.hasProfileImage = false;
                that.allConversations.set(controller.chatUuid, conversation);
            });
        },
        readChatMessages: function(controller) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let chatController = this.allChatControllers.get(controller.chatUuid);
            let conversation = this.allConversations.get(controller.chatUuid);
            that.messenger.mergeAllUpdates(controller, this.socialData).thenApply(updatedController => {
                chatController.controller = updatedController;
                let origParticipants = updatedController.getMemberNames().toArray();
                let participants = that.removeSelfFromParticipants(origParticipants);
                conversation.participants = participants;
                conversation.readonly = origParticipants.length == participants.length || participants.length == 0;
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
        replaceOwnerInPath: function(owner, path) {
            let pathWithoutLeadingSlash = path.startsWith("/") ? path.substring(1) : path;
            let pathWithoutOwner = pathWithoutLeadingSlash.substring(pathWithoutLeadingSlash.indexOf("/"));
            return owner + pathWithoutOwner;
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
                    //Load media from local mirror
                    let mirrorPath = that.replaceOwnerInPath(that.context.username, ref.path);
                    that.context.getByPath(mirrorPath).thenApply(function(optFile) {
                        loadedCount++;
                        let mediaFile = optFile.ref;
                        if (mediaFile != null) {
                            let fullPath = ref.path.startsWith("/") ? ref.path : "/" + ref.path;
                            attachmentMap.set(fullPath, mediaFile);
                            if (loadedCount == refs.length) {
                                chatController.pendingAttachmentRefs = [];
                                future.complete(attachmentMap);
                            }
                        } else {
                            //fallback to attachment sender
                            let owner = that.extractOwnerFromPath(ref.path);
                            that.context.network.getFile(ref.cap, owner).thenApply(optFile => {
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
                                if (loadedCount == refs.length) {
                                    chatController.pendingAttachmentRefs = [];
                                    future.complete(attachmentMap);
                                }
                            });
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
                    if (val.participants.length == 1 && !val.triedLoadingProfileImage) {
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
                that.loadConversationIcons(conversationIconCandidates);
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
                        participants = " - you," + participants;
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
            var text = this.newMessageText;
            that.newMessageText = "";
            while (text.endsWith("\n")) {
                text = text.substring(0, text.length - 1);
                if (text.length == 0) {
                    return;
                }
            }
            let conversationId = this.selectedConversationId;
            let msg = this.attachmentList.length > 0 ?
                peergos.shared.messaging.messages.ApplicationMessage.attachment(text, this.buildAttachmentFileRefList())
                : peergos.shared.messaging.messages.ApplicationMessage.text(text);
            let attachmentMap = new Map();
            for(var i = 0; i < this.attachmentList.length; i++) {
                let mediaPath = this.attachmentList[i].mediaItem.path;
                let path = mediaPath.startsWith("/") ? mediaPath : "/" + mediaPath;
                attachmentMap.set(path, this.attachmentList[i].mediaFile);
            }
            that.attachmentList = [];
            let editMessage = this.editMessage;
            that.editMessage = null;
            let replyToMessage = this.replyToMessage;
            that.replyToMessage = null;
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
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let chatController = this.allChatControllers.get(conversationId);
            let controller = chatController.controller;
            this.messenger.sendMessage(controller, msg).thenApply(function(updatedController) {
                chatController.controller = updatedController;
                future.complete(true);
            }).exceptionally(function(throwable) {
                console.log(throwable);
                that.showToastError("Unable to send message");
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
                that.showToastError("Unable to change Title");
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
            for(var i = 1; i < body.length; i++) {
                let refPath = body[i].reference().ref.path;
                let path = refPath.startsWith("/") ? refPath : "/" + refPath;
                let mediaFile = attachmentMap.get(path);
                if (mediaFile != null) {
                    let fileType = mediaFile.getFileProperties().getType();
                    let thumbnail = mediaFile.getFileProperties().thumbnail.ref != null ? mediaFile.getBase64Thumbnail() : "";
                    mediaFiles.push({loaded: true, path: path, file: mediaFile, fileType: fileType, thumbnail: thumbnail, hasThumbnail: thumbnail.length > 0});
                } else {
                    mediaFiles.push({loaded: false, path: path, file: null, fileType: null, thumbnail: "", hasThumbnail: false});
                }
            }
            let timestamp = messageEnvelope == null ? "" : this.fromUTCtoLocal(messageEnvelope.creationTime);
            let entry = {isStatusMsg: false, mediaFiles: mediaFiles,
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

</script>

<style>
.picon-chat {
    font-size: 3em;
}
.img-thumbnail-chat {
    height: 50px;
    width: 50px;
    border-radius: 50%;
    color: darkgray;
}
 .chat-top{
    position:fixed;
}

 .chat-back-button{
    color: black;
    font-size: 20px;
    margin: 5px;
}

.chat-hide{
    display: none;
}

.chat-full-width{
    width:100% !important;
}

.emoji-position {
    position: absolute;
    bottom: 40px;
    right: 160px;
}
.prevent-resize{
    resize: none
}

.chat-container{
  margin:auto;
}

.chat-left-panel {
  background: var(--bg) none repeat scroll 0 0;
  float: left;
  overflow: hidden;
  width: 35%;
  border-right:1px solid #c4c4c4;
}
.chat-border {
  border: 1px solid #c4c4c4;
  clear: both;
  overflow: hidden;
}

.chat-actions{
  padding:10px 29px 10px 20px;
  overflow:hidden;
  border-bottom:1px solid #c4c4c4;
}

.chat-action-heading {
  float: left;
  width:40%;
}

.chat-action-heading h4 {
  color: #05728f;
  font-size: 21px;
  margin: auto;
}

.chat_img {
    float: left;
    width: 11%;
}

.chat-message-search {
}

.chat-message-search input{
    border:1px solid #cdcdcd;
    border-width:0 0 1px 0;
    width:80%;
    padding:2px 0 4px 6px;
    background:none;
}

.chat-message-search .input-group-addon button {
  background: rgba(0, 0, 0, 0) none repeat scroll 0 0;
  border: medium none;
  padding: 0px;
  color: #707070;
  font-size: 18px;
}

.chat-message-search .input-group-addon {
  margin: 0 0 0 -27px;
}

.conversation h5{
  font-size:15px;
  color:#464646;
  margin:0 0 8px 0;
  padding: 10px;
}

.conversation h5 span{
  font-size:13px;
  float:right;
}

.conversation p{
  font-size:14px;
  color:#989898;
  margin:auto
}

.conversation {
  float: left;
  padding: 0 0 0 15px;
  width: 88%;
}

.conversationContainer{
  overflow:hidden;
  clear:both;
  border-bottom: 1px solid #c4c4c4;
  margin: 0;
  padding: 18px 16px 10px;
}

.conversations {
  overflow-y: scroll;
}

.activeConversation{ background:#ebebeb;}

.received-message-container {
  display: inline-block;
  padding: 0 0 0 10px;
  vertical-align: top;
  width: 92%;
  margin:16px 0 16px;
 }

.received-message {
    width: 70%;
}

.received-message p {
  background: #ebebeb none repeat scroll 0 0;
  border-radius: 3px;
  color: #000000;
  font-size: 14px;
  margin: 0;
  padding: 5px 10px 5px 12px;
  width: 100%;
  white-space:pre-wrap;
}
/*
.received-message img {
  background: #ebebeb none repeat scroll 0 0;
  border-radius: 3px;
  color: #646464;
  font-size: 14px;
  margin: 0;
  padding: 5px 10px 5px 12px;
  width: 100%;
}
*/

.parent-message {
    border: 1px solid #c4c4c4;
    border-radius: 6px;
}

.reply-message-container {
  display: inline-block;
  padding: 0 0 0 10px;
  vertical-align: top;
  width: 92%;
 }

.reply-message {
    width: 57%;
    border: 3px solid #c4c4c4;
    border-radius: 3px;
    margin: 20px;
    padding: 5px;
}

.reply-message p {
  border-radius: 3px;
  font-size: 14px;
  margin: 0;
  padding: 5px 10px 5px 12px;
  width: 100%;
}

.reply-to-others-message {
    background: #ebebeb none repeat scroll 0 0 !important;
    color: #000000 !important;
    white-space:pre-wrap;
}
.reply-to-own-message {
    background: #26b99a none repeat scroll 0 0 !important;
    color:#fff !important;
    white-space:pre-wrap;
}
.attachment-view-container {
  display: inline-block;
  vertical-align: middle;
}

.attachment-container {
  display: inline-block;
  vertical-align: middle;
  margin-right: 20px;
}

.attachment {
    position: fixed;
    background-color: white;
    bottom: 100px;
    border: 1px solid #c4c4c4;
    border-radius: 5px;
    margin-bottom: 15px;
    padding: 5px;
}

.attachment-delete-btn {
    color: #000;
}

.reply-draft-container {
  overflow:hidden;
}

.reply-draft-message {
  position: fixed;
  background-color: white;
  bottom: 100px;
  right: 100px;
  border: 1px solid #c4c4c4;
  border-radius: 5px;
  margin-bottom: 15px;
  padding: 10px;
}

.reply-draft-message p {
    padding: 5px 20px 5px 12px;
}

.reply-to-delete-draft {
    left: 95%;
    position: absolute;
}

.status-message-container {
  display: inline-block;
  padding: 0 0 0 10px;
  vertical-align: top;
  width: 92%;
 }

.status-message { width: 100%;}

.status-message p {
  margin: 0;
  padding: 5px 10px 5px 12px;
  text-align: center;
}

.status-message-bold {
    font-size: 1.7em
}

.chat-message-info {
  color: #747474;
  display: block;
  font-size: 12px;
  margin: 8px 0 0;
}

.chat-messages {
  float: left;
  padding: 30px 15px 0 25px;
  width: 65%;
}

.sent-message {
  float: right;
  width: 70%;
  margin-right: 10px;
}

.sent-message-reply {
  float: right;
  width: 100%;
}

.sent-message p {
  background: #26b99a none repeat scroll 0 0;
  border-radius: 3px;
  font-size: 14px;
  margin: 0; color:#fff;
  padding: 5px 10px 5px 12px;
  width:100%;
  white-space:pre-wrap;
}
/*
.sent-message img {
  background: #26b99a none repeat scroll 0 0;
  border-radius: 3px;
  font-size: 14px;
  margin: 0; color:#fff;
  padding: 5px 10px 5px 12px;
  width:100%;
}*/

.sent-message-container{
  overflow:hidden;
  margin:26px 0 26px;
}

.new-message textarea {
  background: rgba(0, 0, 0, 0) none repeat scroll 0 0;
  border: medium none;
  color: #4c4c4c;
  font-size: 15px;
  min-height: 48px;
  width: 100%;
}

.new-message-container {
  border-top: 1px solid #c4c4c4;
  position: relative;
}

.emoji-btn {
    border: medium none;
    border-radius: 50%;
    color: #fff;
    font-size: 17px;
    height: 33px;
    position: absolute;
    right: 80px;
    top: 11px;
    width: 33px;
}

.send-new-message-btn {
  border: medium none;
  border-radius: 50%;
  color: #fff;
  font-size: 17px;
  height: 33px;
  position: absolute;
  right: 0px;
  top: 11px;
  width: 33px;
}

.attachment-btn {
  border: medium none;
  border-radius: 50%;
  color: #fff;
  font-size: 17px;
  height: 33px;
  position: absolute;
  right: 40px;
  top: 11px;
  width: 33px;
}

.chat-btn {
    display: inline-block;
    margin-bottom: 0;
    text-align: center;
    white-space: nowrap;
    vertical-align: middle;
    -ms-touch-action: manipulation;
    touch-action: manipulation;
    cursor: pointer;
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    background-image: none;
}

.chat-messaging {
  padding: 0 0 0px 0;
}

.chat-messages-container {
  overflow-y: auto;
}

</style>
