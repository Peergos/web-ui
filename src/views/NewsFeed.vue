<template>
<Article class="app-view newsfeed-view">
	<AppHeader>
		<template #primary>
			<h1>{{ translate("NEWSFEED.TITLE") }}</h1>
		</template>
		<template #tools>
			<AppButton
				aria-label="New Post"
				@click.native="addNewPost()"
				size="small"
				accent
			>
			{{ translate("NEWSFEED.NEW") }}
			</AppButton>
			<AppButton
				aria-label="Refresh"
				@click.native="refresh()"
				size="small"
				icon="refresh"
			></AppButton>
		</template>

	</AppHeader>

        <center v-if="buildingFeed">
            <h3>
                {{ translate("NEWSFEED.BUILDING") }}
                </h3>
            <h3>
                {{ translate("NEWSFEED.MINUTE") }}
            </h3>
        </center>
    <main v-else class="newsfeed__container">
            <Spinner v-if="showSpinner"></Spinner>
            <div @click="closeMenus($event)" style="flex-grow:1">
                <AppInstall
                    v-if="showAppInstallation"
                    v-on:hide-app-installation="closeAppInstallation"
                    :appInstallSuccessFunc="appInstallSuccess"
                    :appPropsFile="appInstallPropsFile"
                    :installFolder="appInstallFolder">
                </AppInstall>
                <SocialPost
                    v-if="showSocialPostForm"
                    :closeSocialPostForm="closeSocialPostForm"
                    :socialFeed="socialFeed"
                    :context="context"
                    :showMessage="showMessage"
                    :groups="groups"
                    :socialPostAction="socialPostAction"
                    :currentSocialPostEntry="currentSocialPostEntry"
                    :checkAvailableSpace="checkAvailableSpace"
                    :convertBytesToHumanReadable="convertBytesToHumanReadable">
                </SocialPost>
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
                <Confirm
                    v-if="showConfirm"
                    v-on:hide-confirm="showConfirm = false"
                    :confirm_message='confirm_message'
                    :confirm_body="confirm_body"
                    :consumer_cancel_func="confirm_consumer_cancel_func"
                    :consumer_func="confirm_consumer_func">
                </Confirm>
                <AppSandbox
                    v-if="showAppSandbox"
                    v-on:hide-app-sandbox="closeAppSandbox"
                    :sandboxAppName="sandboxAppName"
                    :sandboxAppChatId="sandboxAppChatId">
                </AppSandbox>
                <ul id="appMenu" v-if="showAppMenu" class="dropdown-menu" v-bind:style="{top:menutop, left:menuleft}" style="cursor:pointer;display:block;min-width:100px;padding: 10px;">
                    <li id='open-in-app' style="padding-bottom: 5px;" v-for="app in availableApps" v-on:keyup.enter="appOpen($event, app.name, app.path, app.file)" v-on:click="appOpen($event, app.name, app.path, app.file)">{{app.contextMenuText}}</li>
                </ul>
                <div id="scroll-area">
                    <center v-if="data.length==0">
                        <h3>
                            {{ translate("NEWSFEED.BUILT") }}
                        </h3>
                        <h3>
                            {{ translate("NEWSFEED.DESC") }}
                        </h3>
                    </center>
                    <ul id="editMenu" v-if="showEditMenu" class="dropdown-menu" v-bind:style="{top:menutop, left:menuleft}" style="cursor:pointer;display:block;min-width:100px;">
                        <li><a @click="editPost(currentRow)">{{ translate("DRIVE.EDIT") }}</a></li>
                        <li><a @click="deletePost(currentRow)">{{ translate("DRIVE.DELETE") }}</a></li>
                    </ul>
                    <ul id="friendMenu" v-if="showFriendMenu" class="dropdown-menu" v-bind:style="{top:menutop, left:menuleft}" style="cursor:pointer;display:block;min-width:100px;">
                        <li><a @click="sendFriendRequest(currentRow)">{{ translate("NEWSFEED.FRIEND") }}</a></li>
                    </ul>

                    <div id="feed" class="table table-responsive table-striped table-hover" style="border:none;">
                        <div v-for="entry in blocks">
                            <div v-if="entry[0].isLastEntry">
                                <center><span>{{ translate("NEWSFEED.END") }}</span></center>
                            </div>
                            <div v-if="!entry[0].isLastEntry && !entry[0].isPost && !entry[0].isMedia" style="border: 1px solid black;border-radius: 11px; margin-top:5px; padding: 2em;">
                                <a v-if="entry[0].sharer != context.username && canLoadProfile(entry[0].sharer)" v-on:click="displayProfile(entry[0].sharer)" style="cursor: pointer">
                                    <span>{{ entry[0].sharer }}</span>
                                </a>
                                <span v-if="entry[0].sharer != context.username && !canLoadProfile(entry[0].sharer)">{{ entry[0].sharer }}</span>
                                <span>{{ entry[0].info }}</span>
                                <a v-if="entry[0].displayFilename" v-on:click="viewFolder(entry[0])" style="cursor: pointer">
                                    <span :title="entry[0].link">{{ entry[0].name }}</span>
                                </a>
                                <div>
                                    <div v-if="!entry[0].isLastEntry">
                                        <div v-if="!entry[0].isPost && !entry[0].isMedia">
                                            <span class="grid_icon_wrapper fa">
                                                <a v-if="!entry[0].hasThumbnail && !entry[0].isChat">
                                                    <AppIcon style="height:100px" @click.stop.native="view($event, entry[0])" class="card__icon" :icon="getFileIconFromFileAndType(entry[0].file, entry[0].fileType)"></AppIcon>
                                                </a>
                                                <img v-if="entry[0].hasThumbnail && !entry[0].isChat" v-on:click="view($event, entry[0])" v-bind:src="entry[0].thumbnail" style="cursor: pointer"/>
                                                <button v-if="entry[0].isChat && entry[0].isNewChat" class="btn btn-success" @click="joinConversation(entry[0])" style="font-weight: bold;">{{ translate("NEWSFEED.JOIN") }}</button>
                                                <button v-if="entry[0].isChat && !entry[0].isNewChat" class="btn btn-success" @click="openConversation(entry[0])" style="font-weight: bold;">{{ translate("DRIVE.VIEW") }}</button>
                                            </span>
                                        </div>
                                    </div>
                                    <span v-if="!entry[0].isDirectory && entry[0].sharer != context.username && !entry[0].isMedia && canComment(entry[0])">
                                        <button class="btn btn-success" @click="addComment(entry[0])">{{ translate("NEWSFEED.ADD.COMMENT") }}</button>
                                    </span>
                                </div>

                                <div class="table-responsive table-striped table-hover" style="font-size: 1.0em;padding-left:0;margin-bottom:0;border:none;">
                                    <div v-for="(row, rowIndex) in entry">
                                        <div v-if="rowIndex >= 2 && row.isMedia">
                                            <div v-bind:style="{ marginLeft: indent(row) }">
                                                <div  v-for="(media, mediaIndex) in row.mediaList" class="grid_icon_wrapper fa" style="margin:0;margin-top:0.2em;">
                                                    <a v-if="!media.hasThumbnail">
                                                        <AppIcon style="height:100px" v-on:click="viewMediaList(row.mediaList, mediaIndex)" class="card__icon" :icon="getFileIconFromFileAndType(media.file, media.fileType)"> </AppIcon>
                                                    </a>
                                                    <img v-if="media.hasThumbnail" v-on:click="viewMediaList(row.mediaList, mediaIndex)" v-bind:src="media.thumbnail" style="cursor: pointer"/>
                                                </div>
                                            </div>
                                            <div v-bind:style="{ marginLeft: indent(entry[rowIndex-1]) }">
                                                <div style="margin-top: 10px; margin-bottom: 10px;">
                                                    <span v-if="entry[rowIndex-1].sharer != context.username && canComment(entry[rowIndex-1])">
                                                        <button class="btn btn-success" @click="addComment(entry[rowIndex-1])">{{ translate("NEWSFEED.COMMENT") }}</button>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div v-if="rowIndex >= 1 && row.isPost">
                                            <div v-bind:style="{ marginLeft: indent(row) }">
                                                <div style="display:flex;font-size: 1em;color: #7d7d7d;margin-right: 10px;">
                                                    <a v-if="row.sharer != context.username && canLoadProfile(row.sharer)" v-on:click="displayProfile(row.sharer)" style="cursor: pointer">
                                                        <span>{{ row.sharer }}&nbsp;</span>
                                                    </a>
                                                    <span v-if="row.sharer!= context.username && !canLoadProfile(row.sharer)">{{ row.sharer }}&nbsp;</span>
                                                    {{ row.info }}
                                                    <span style="flex-grow:1;">&nbsp&nbsp;{{ row.status}}</span>
                                                    <span v-if="row.sharer == context.username" class="fa fa-ellipsis-h" @click="displayEditMenu($event, row)"></span>
                                                </div>
                                                <div class="post-content" v-if="row.name.length > 0">{{ row.name }}</div>
                                            </div>
                                            <div v-if="!(rowIndex + 1 < entry.length && entry[rowIndex+1].isMedia)" v-bind:style="{ marginLeft: indent(row) }">
                                                <div style="margin-top: 10px; margin-bottom: 10px;">
                                                    <span v-if="row.sharer != context.username && canComment(row)">
                                                        <button class="btn btn-success" @click="addComment(row)">{{ translate("NEWSFEED.COMMENT") }}</button>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                            </div>
                            <div v-if="!entry[0].isLastEntry && (entry[0].isPost || entry[0].isMedia)" class="entry">
                                <div class="table-responsive table-striped table-hover" style="font-size: 1.0em;padding-left:0;margin-bottom:0;border:none;">
                                    <div v-for="(row, rowIndex) in entry">
                                        <div v-if="row.isMedia">
                                            <div v-bind:style="{ marginLeft: indent(row) }">
                                                <div  v-for="(media, mediaIndex) in row.mediaList" class="grid_icon_wrapper fa" style="margin:0;margin-top:0.2em;">
                                                    <a v-if="!media.hasThumbnail">
                                                        <AppIcon style="height:100px" v-on:click="viewMediaList(row.mediaList, mediaIndex)" class="card__icon" :icon="getFileIconFromFileAndType(media.file, media.fileType)"> </AppIcon>
                                                    </a>
                                                    <img v-if="media.hasThumbnail" v-on:click="viewMediaList(row.mediaList, mediaIndex)" v-bind:src="media.thumbnail" style="cursor: pointer"/>
                                                </div>
                                            </div>
                                            <div v-bind:style="{ marginLeft: indent(entry[rowIndex-1]) }">
                                                <div style="margin-top: 10px; margin-bottom: 10px;">
                                                    <span v-if="canComment(entry[rowIndex-1])">
                                                        <button class="btn btn-success" @click="addComment(entry[rowIndex-1])">{{ translate("NEWSFEED.COMMENT") }}</button>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        <div v-if="row.isPost">
                                            <div v-bind:style="{ marginLeft: indent(row) }">
                                                <div style="display:flex;font-size: 1em;color: #7d7d7d;margin-right: 10px;">
                                                    <a v-if="row.sharer != context.username && canLoadProfile(row.sharer)" v-on:click="displayProfile(row.sharer)" style="cursor: pointer">
                                                        <span>{{ row.sharer }}&nbsp;</span>
                                                    </a>
                                                    <a
                                                        v-if="row.sharer!= context.username && !canLoadProfile(row.sharer)"
                                                        v-on:click="displayFriendMenu($event, row)"
                                                        style="cursor: pointer">
                                                        <span>{{ row.sharer }}&nbsp;</span>
                                                    </a>
                                                    {{ row.info }}
                                                    <span style="flex-grow:1;">&nbsp&nbsp;{{ row.status}}</span>
                                                    <span v-if="row.sharer == context.username" class="fa fa-ellipsis-h" @click="displayEditMenu($event, row)"></span>
                                                </div>
                                                <div class="post-content" v-if="row.name.length > 0">{{ row.name }}</div>
                                            </div>
                                            <div v-if="!(rowIndex + 1 < entry.length && entry[rowIndex+1].isMedia)" v-bind:style="{ marginLeft: indent(row) }">
                                                <div style="margin-top: 10px; margin-bottom: 10px;">
                                                    <span v-if="canComment(row)">
                                                        <button class="btn btn-success" @click="addComment(row)">{{ translate("NEWSFEED.COMMENT") }}</button>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <center>
                        <button :disabled="requestingMoreResults" v-if="hasLoadedInitialResults && !noMoreResults" class="btn btn-success" v-on:click="requestMoreResults()">{{ translate("NEWSFEED.MORE") }}</button>
                    </center>
                </div>
            </div>
        </main>
	</Article>
</template>

<script>
const AppButton = require("../components/AppButton.vue");
const AppHeader = require("../components/AppHeader.vue");
const AppIcon = require("../components/AppIcon.vue");
const AppInstall = require("../components/sandbox/AppInstall.vue");
const Confirm = require("../components/confirm/Confirm.vue");
const SocialPost = require("../components/social/SocialPost.vue");
const Gallery = require("../components/drive/DriveGallery.vue");
const ViewProfile = require("../components/profile/ViewProfile.vue");
const AppSandbox = require("../components/sandbox/AppSandbox.vue");
const Spinner = require("../components/spinner/Spinner.vue");
const i18n = require("../i18n/index.js");

const routerMixins = require("../mixins/router/index.js");
const mixins = require("../mixins/mixins.js");

module.exports = {
    components: {
		SocialPost,
		Gallery,
		ViewProfile,
		AppButton,
		AppSandbox,
		AppHeader,
		AppIcon,
		AppInstall,
		Confirm,
		Spinner,
    },
    data: function() {
        return {
            buildingFeed: true,
            showSpinner: false,
            data: [],
            pageEndIndex : 0,
            pageSize: 40,
            requestingMoreResults: false,
            noMoreResults: false,
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
            showSocialPostForm: false,
            socialPostAction: '',
            currentSocialPostEntry: null,
            showEmbeddedGallery: false,
            filesToViewInGallery: [],
            showEditMenu: false,
            showFriendMenu: false,
            showAppMenu: false,
            menutop:"",
            menuleft:"",
            currentRow: {},
            showConfirm: false,
            confirm_message: "",
            confirm_body: "",
            confirm_consumer_cancel_func: () => {},
            confirm_consumer_func: () => {},
            hasLoadedInitialResults: false,
            socialFeed: null,
            seenPosts: new Map(),
            knownChats: [],
            messenger: null,
            sharedItemsProcessedMap: new Map(),
            entryTree: null,
            showAppSandbox: false,
            sandboxAppName: '',
            sandboxAppChatId: '',
            showAppInstallation: false,
            appInstallPropsFile: null,
            appInstallFolder: '',
            appInstalledEntry: null,
            availableApps: []
        }
    },
    props: [],
	mixins:[routerMixins, mixins, i18n],
  	created: function() {
        let that = this;
        this.entryTree = new this.Tree(this);
        this.context.getSocialFeed().thenCompose(function(socialFeed) {
                return socialFeed.update().thenApply(function(updated) {
                    that.socialFeed = updated;
                    that.messenger = new peergos.shared.messaging.Messenger(that.context);
                    that.init();
                    that.buildingFeed = false;
                    that.showSpinner = false;
                });
            }).exceptionally(function(throwable) {
                that.showMessage(throwable.getMessage());
                that.spinnerMessage = "";
                that.showSpinner = false;
            });
    },
	mounted(){
	},
    methods: {
        updateSocialFeedInstance: function(updated) {
            // TODO put this in vuex store
            this.socialFeed = updated;
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
        checkAvailableSpace: function(fileSize) {
            return Number(this.quotaBytes.toString()) - (Number(this.usageBytes.toString()) + fileSize);
        },
        addNewPost: function() {
            this.currentSocialPostEntry = null;
            this.socialPostAction = 'add';
            this.showSocialPostForm = true;
        },
        closeSocialPostForm: function(action, newPath, newSocialPost, newFile, originalPath) {
            if (newPath != null && !newPath.startsWith("/")) {
                newPath = "/" + newPath;
            }
            this.showSocialPostForm = false;
            this.currentSocialPostEntry = null;
            let that = this;
            if (action == 'edit') {
                var index = this.data.findIndex(v => v.link === originalPath);
                if (index != -1) { //could have been deleted
		            // assume only 1 text item in body for now
                    this.data[index].name = newSocialPost.body.toArray([])[0].inlineText();
                    this.data[index].socialPost = newSocialPost;
                    this.data[index].status = newSocialPost.previousVersions.toArray([]).length > 0 ? "[" + this.translate("NEWSFEED.EDITED") + "]" : "";
                }
            } else {
                if (newSocialPost != null) {
                    this.refresh();
                }
            }
        },
        getPosition: function(e) {
			var posx = 0;
			var posy = 0;

			if (!e) var e = window.event;
			// var body = document.getElementById("modal-body");
			// var feed = document.getElementById("feed")

			if (e.clientX || e.clientY) {
				// posx = e.clientX - feed.offsetLeft + document.body.scrollLeft + document.documentElement.scrollLeft;
				// posy = e.clientY - body.offsetTop + document.body.scrollTop + document.documentElement.scrollTop;
				posx = e.clientX - document.body.scrollLeft + document.documentElement.scrollLeft;
				posy = e.clientY - document.body.scrollTop + document.documentElement.scrollTop;

			}
			return {
				x: posx,
				y: posy
			}
		},
	closeMenus: function(e) {
	    this.showEditMenu = false;
        this.showFriendMenu = false;
        this.showAppMenu = false;
        if (e != null) {
	        e.stopPropagation();
	    }
	},
	displayEditMenu: function(event, row) {
            this.currentRow = row;
	    var pos = this.getPosition(event);
	    Vue.nextTick(function() {
		var top = pos.y + 10;
		var left = pos.x - 100;
		this.menutop = top + 'px';
		this.menuleft = left + 'px';
	    }.bind(this));
            this.showEditMenu = true;
	    event.stopPropagation();
        },
        editPost: function(entry) {
            this.socialPostAction = 'edit';
            let parentPostAuthor = "";
            if (entry.socialPost.parent.ref != null) {
                parentPostAuthor = this.extractOwnerFromPath(entry.socialPost.parent.ref.path);
            }
            this.currentSocialPostEntry = {path: entry.link, socialPost: entry.socialPost, sharer: parentPostAuthor};
            this.showSocialPostForm = true;
            this.showEditMenu = false;
        },
        sendFriendRequest: function(entry) {
            let ctx = this.context;
            ctx.getSocialState().thenCompose(function(social) {
                var pendingOutgoingUsernames = [];
		social.pendingOutgoing.toArray([]).map(u => pendingOutgoingUsernames.push(u));
                if (pendingOutgoingUsernames.indexOf(entry.owner) < 0)
                    ctx.sendInitialFollowRequest(entry.owner);
            });
	    this.showFriendMenu = false;
        },
        displayFriendMenu: function(event, row) {
            this.currentRow = row;
	    var pos = this.getPosition(event);
	    Vue.nextTick(function() {
		var top = pos.y + 10;
		var left = pos.x - 100;
		this.menutop = top + 'px';
		this.menuleft = left + 'px';
	    }.bind(this));
            this.showFriendMenu = true;
	    event.stopPropagation();
        },
        removeItemFromDisplay: function(entry) {
            let index = this.data.findIndex(v => v.link === entry.link);
            if (index > -1) {
                this.data.splice(index, 1);
                if (entry.socialPost != null) {
                    let references = entry.socialPost.references().toArray([]);
                    if (references.length > 0) {
                        for(var j = 0 ; j < references.length; j++) {
                            let refPath = references[j].path;
                            let refIndex = this.data.findIndex(v => v.link === refPath);
                            if (refIndex > -1) {
                                this.data.splice(refIndex, 1);
                            }
                        }
                    }
                }
                var i = index;
                for(;i < this.data.length;) {
                    if (this.data[i].indent != null && this.data[i].indent > entry.indent){
                        this.data.splice(index, 1);
                    } else {
                        break;
                    }
                }
            }
        },
        confirmDeletePost: function(message, deletePostFunction, cancelFunction) {
            this.confirm_message= message;
            this.confirm_body='';
            this.confirm_consumer_cancel_func = cancelFunction;
            this.confirm_consumer_func = deletePostFunction;
            this.showConfirm = true;
        },
        deletePost: function(entry) {
            let that = this;
            var msg = that.translate("NEWSFEED.DELETE.CONFIRM");
            if (entry.indent == 1) {
                msg = msg + that.translate("NEWSFEED.POST") + "?";
            } else {
                msg = msg + that.translate("NEWSFEED.COMMENT") + "?";
            }
            this.confirmDeletePost(msg,
                () => { that.showConfirm = false;
                    that.deleteSocialPost(entry);
                },
                () => { that.showConfirm = false;}
            );
        },
        reduceDeletingAllMediaReferences: function(entry, references, index, future) {
            let that = this;
            if (index == references.length) {
                future.complete(true);
            } else {
                let ref = references[index];
                this.context.getByPath(ref.path).thenApply(function(optFile){
                    let mediaFile = optFile.ref;
                    if (mediaFile != null) {
                        var parentPath = entry.link.substring(0, entry.link.lastIndexOf('/'));
                        parentPath = parentPath.substring(0, parentPath.lastIndexOf('/'));
                        that.deleteFile(parentPath + "/media/" + mediaFile.props.name, mediaFile).thenApply(function(res){
                            that.reduceDeletingAllMediaReferences(entry, references, index + 1, future);
                        }).exceptionally(function(throwable) {
                            that.showMessage(that.translate("NEWSFEED.ERROR.MEDIA.DELETE"));
                            that.reduceDeletingAllMediaReferences(entry, references, index + 1, future);
                        });
                    } else {
                        that.reduceDeletingAllMediaReferences(entry, references, index + 1, future);
                    }
                });
            }
        },
        deleteMediaReferences: function(entry, references) {
            let future = peergos.shared.util.Futures.incomplete();
            this.reduceDeletingAllMediaReferences(entry, references, 0, future);
            return future;
        },
        deleteSocialPost: function(entry) {
            let that = this;
            that.showSpinner = true;
            let socialPost = entry.socialPost;
	    let refs = socialPost.references().toArray([])
            if (refs.length > 0) {
                this.deleteMediaReferences(entry, refs).thenApply(function(result){
                    that.deleteFile(entry.link, entry.file).thenApply(function(res2){
                        if (res2) {
                            that.showSpinner = false;
                            that.removeItemFromDisplay(entry);
                        }
                    });
                });
            } else {
                this.deleteFile(entry.link, entry.file).thenApply(function(res){
                    if (res) {
                        that.showSpinner = false;
                        that.removeItemFromDisplay(entry);
                    }
                });
            }
	    this.showEditMenu = false;
        },
        deleteFile: function(filePathStr, file) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let filePath = this.convertToPath(filePathStr);
            let parentPath = filePathStr.substring(0, filePathStr.lastIndexOf('/'));
            this.context.getByPath(parentPath).thenApply(function(optParent){
                that.context.getByPath(filePathStr).thenApply(function(updatedFileOpt){
                    if (updatedFileOpt.ref != null) {
                        updatedFileOpt.ref.remove(optParent.get(), filePath, that.context).thenApply(function(b){
                            future.complete(true);
                        }).exceptionally(function(throwable) {
                            that.showMessage(that.translate("NEWSFEED.ERROR.POST.DELETE"));
                            that.showSpinner = false;
                            future.complete(false);
                        });
                    } else {
                        future.complete(true);
                    }
                });
            }).exceptionally(function(throwable) {
                that.showMessage(that.translate("NEWSFEED.ERROR.POST.DELETE"));
                that.showSpinner = false;
                future.complete(false);
            });
            return future;
        },
        getGroupUid: function(groupName) {
            return this.groups.groupsNameToUid[groupName];
        },
        addComment: function(entry) {
            this.socialPostAction = 'reply';
            var cap = entry.cap;
            if (cap == null) {
                cap = entry.file.readOnlyPointer();
            }
            this.currentSocialPostEntry = {path: entry.link, socialPost: entry.socialPost, file: entry.file, cap: cap, sharer: entry.sharer};
            this.showSocialPostForm = true;
        },
        getFileSize: function(props) {
                var low = props.sizeLow();
                if (low < 0) low = low + Math.pow(2, 32);
                return low + (props.sizeHigh() * Math.pow(2, 32));
        },
        loadPost: function(file, future) {
            let that = this;
            const props = file.getFileProperties();
            file.getInputStream(this.context.network, this.context.crypto, props.sizeHigh(), props.sizeLow(), function(read){})
                .thenApply(function(reader) {
                    var size = that.getFileSize(props);
                    var data = convertToByteArray(new Int8Array(size));
                    reader.readIntoArray(data, 0, data.length).thenApply(function(read){
                        let socialPost = peergos.shared.util.Serialize.parse(data, c => peergos.shared.social.SocialPost.fromCbor(c));
                        future.complete({socialPost: socialPost, file: file});
                    });
            }).exceptionally(function(throwable) {
                that.showMessage(that.translate("NEWSFEED.ERROR.POST.LOAD"));
                future.complete(null);
            });
        },
        loadFile: function(path, file) {
            let future = peergos.shared.util.Futures.incomplete();
            let isPost = path.includes("/.posts/");
            if (isPost) {
                this.loadPost(file, future);
            } else {
                future.complete(null);
            }
            return future;
        },
        loadFiles: function(incomingPairs) {
            let future = peergos.shared.util.Futures.incomplete();
            let that = this;
            let accumulator = [];
            let pairs = incomingPairs.filter(pair => !that.alreadySeen(pair.left.path));
            if (pairs.length == 0) {
                future.complete(accumulator);
            } else {
                pairs.forEach(currentPair => {
                    that.loadFile(currentPair.left.path, currentPair.right).thenApply(result => {
                        that.addToSeen(currentPair.left.path);
                        let socialPost = result ? result.socialPost : null;
                        let fullPath = that.toPathKey(currentPair.left.path);
                        let isChat = fullPath.includes("/.messaging/") ? true : false;
                        accumulator = accumulator.concat({isChat: isChat, entry: currentPair.left, path: fullPath, socialPost: socialPost, file: currentPair.right});
                        if (accumulator.length == pairs.length) {
                            future.complete(accumulator);
                        }
                    });
                });
            }
            return future;
        },
        comparePaths: function(path1, path2) {
            let left = this.toPathKey(path1);
            let right = this.toPathKey(path2);
            return left == right;
        },
        convertToPath: function(dir) {
            let pathKey = this.toPathKey(dir);
            return peergos.client.PathUtils.directoryToPath(pathKey.split('/'));
        },
        toPathKey: function(path) {
            return path.startsWith("/") ? path.substring(1) : path;
        },
        addToSeen: function(path) {
            let fullPath = this.toPathKey(path);
            this.seenPosts.set(fullPath, "");
        },
        alreadySeen: function(path) {
            let fullPath = this.toPathKey(path);
            return this.seenPosts.get(fullPath) != null;
        },
        extractOwnerFromPath: function(path) {
            let fullPath = this.toPathKey(path);
            return fullPath.substring(0, fullPath.indexOf("/"));
        },
        loadAllMediaPosts: function(refs, future) {
            let that = this;
            let mediaMap = new Map();
            if (refs.length == 0) {
                future.complete(mediaMap);
            } else {
                var loadedCount = 0;
                refs.forEach(ref => {
                    let owner = that.extractOwnerFromPath(ref.path);
                    that.context.network.getFile(ref.cap, owner).thenApply(optFile => {
                        loadedCount++;
                        let mediaFile = optFile.ref;
                        if (mediaFile != null) {
                            let fullPath = that.toPathKey(ref.path);
                            mediaMap.set(fullPath, {cap: ref.cap, path: fullPath, socialPost: null, file: mediaFile});
                        }
                        if (loadedCount == refs.length) {
                            future.complete(mediaMap);
                        }
                    });
                });
            }
        },
        loadMediaPosts: function(sharedPosts) {
            let future = peergos.shared.util.Futures.incomplete();
            let refs = [];
            let that = this;
            for(var i = 0; i < sharedPosts.length; i++) {
                let post = sharedPosts[i].socialPost;
                if (post != null) {
                    if (post.parent.ref != null) {
                        let isPost = post.parent.ref.path.includes("/.posts/");
                        if (!isPost) {
                            let path = post.parent.ref.path;
                            let index = sharedPosts.findIndex(v => that.comparePaths(v.path, path));
                            if (index == -1) {
                                //eg we shared a file that another has commented on
                                if (refs.findIndex(v => that.comparePaths(v.path, path)) == -1) {
                                    refs.push(post.parent.ref);
                                }
                            }
                        }
                    }
                    let references = post.references().toArray([]);
                    if (references.length > 0) {
                        references.forEach(mediaRef => {
                            if (refs.findIndex(v => that.comparePaths(v.path, mediaRef.path)) == -1) {
                                refs.push(mediaRef);
                            }
                        });
                    }
                }
            }
            this.loadAllMediaPosts(refs, future);
            return future;
        },
        loadAllCommentPosts: function(refs, future) {
            let that = this;
            let accumulator = [];
            if (refs.length == 0) {
                future.complete(accumulator);
            } else {
                var loadCount = 0;
                refs.forEach(ref => {
                    that.loadFileFromRef(ref).thenApply(result => {
                        if (result == null) {
                            loadCount++;
                            if (loadCount == refs.length) {
                                future.complete(accumulator);
                            }
                        } else {
                            let fullPath = that.toPathKey(ref.path);
                            that.addToSeen(fullPath);
                            let socialPost = result.socialPost;
                            accumulator = accumulator.concat({cap: ref.cap, path: fullPath, socialPost: socialPost, file: result.file});
                            let references = socialPost.comments.toArray([]);
                            let future2 = peergos.shared.util.Futures.incomplete();
                            that.loadAllCommentPosts(references.slice(), future2);
                            future2.thenApply(result => {
                                loadCount++;
                                if (loadCount == refs.length) {
                                    future.complete(accumulator.concat(result));
                                }
                            });
                        }
                    });
                });
            }
        },
        loadFileFromRef: function(ref) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let owner = that.extractOwnerFromPath(ref.path);
            that.context.network.getFile(ref.cap, owner).thenApply(optFile => {
                let file = optFile.ref;
                if (file != null) {
                    that.loadFile(ref.path, file).thenApply(result => {
                        future.complete(result);
                    });
                } else {
                    future.complete(null);
                }
            });
            return future;
        },
        loadCommentPosts: function(sharedPosts) {
            let future = peergos.shared.util.Futures.incomplete();
            let refs = [];
            let that = this;
            for(var i = 0; i < sharedPosts.length; i++) {
                let post = sharedPosts[i].socialPost;
                if (post != null) {
                    let references = post.comments.toArray([]);
                    references.forEach(ref => {
                        let fullRefPath = that.toPathKey(ref.path);
                        if (refs.findIndex(v => that.comparePaths(v.path, fullRefPath)) == -1
                            && sharedPosts.findIndex(v => that.comparePaths(v.path, fullRefPath)) == -1) {
                            refs.push(ref);
                        }
                    });
                }
            }
            this.loadAllCommentPosts(refs, future);
            return future;
        },
        loadAllParentPosts: function(incomingSharedPosts, future) {
            let that = this;
            let accumulator = [];
            let sharedPosts = incomingSharedPosts.filter(s => s.socialPost.parent.ref != null
                && s.socialPost.parent.ref.path.includes("/.posts/")
                && !that.alreadySeen(s.socialPost.parent.ref.path));

            if (sharedPosts.length == 0) {
                future.complete(accumulator);
            } else {
                var loadCount = 0;
                sharedPosts.forEach(sharedPost => {
                    let post = sharedPost.socialPost;
                    that.loadFileFromRef(post.parent.ref).thenApply(result => {
                        if (result == null) {
                            loadCount++;
                            if (loadCount == sharedPosts.length) {
                                future.complete(accumulator);
                            }
                        } else {
                            let fullPath = that.toPathKey(post.parent.ref.path);
                            that.addToSeen(fullPath);
                            let sharedPost = {cap: post.parent.ref.cap, path: fullPath, socialPost: result.socialPost, file: result.file};
                            accumulator = accumulator.concat(sharedPost);

                            let future2 = peergos.shared.util.Futures.incomplete();
                            that.loadAllParentPosts([sharedPost], future2);
                            future2.thenApply(result => {
                                loadCount++;
                                if (loadCount == sharedPosts.length) {
                                    future.complete(accumulator.concat(result));
                                }
                            });
                        }
                    });
                });
            }
        },
        loadParentPosts: function(sharedPosts) {
            let future = peergos.shared.util.Futures.incomplete();
            let filteredSharedPosts = [];
            for(var i = 0; i < sharedPosts.length; i++) {
                let post = sharedPosts[i].socialPost;
                if (post != null) {
                    filteredSharedPosts.push(sharedPosts[i]);
                }
            }
            this.loadAllParentPosts(filteredSharedPosts, future);
            return future;
        },
        processItems: function(items) {
            var that = this;
            var future = peergos.shared.util.Futures.incomplete();
            if (items.length == 0 ) {
                future.complete(0);
            } else {
                that.buildTimeline(items).thenApply(function(allTimelineEntries) {
                    that.data = allTimelineEntries;
                    future.complete(allTimelineEntries.length);
                });
            }
            return future;
        },
        filterSharedItems: function(items) {
            let filteredSharedItems = [];
            for(var i=0; i < items.length; i++) {
                let currentSharedItem = items[i];
                if (!currentSharedItem.path.startsWith("/" + currentSharedItem.owner + "/.profile/")
                    && !currentSharedItem.path.startsWith("/" + currentSharedItem.owner + "/shared/.")) { //groups
                    filteredSharedItems.push(currentSharedItem);
                }
            }
            return filteredSharedItems;
        },
        requestMoreResults: function() {
            let that = this;
            if (that.noMoreResults || that.requestingMoreResults) {
                return;
            }
            that.showSpinner = true;
            that.requestingMoreResults = true;
            this.requestMoreResultsRecursive(0);
        },
        requestMoreResultsRecursive: function(itemCount) {
            let that = this;
            let startIndex = Math.max(0, this.pageEndIndex - this.pageSize);
            this.retrieveResults(startIndex, this.pageEndIndex).thenApply(function(additionalItems) {
               that.pageEndIndex = startIndex;
               let items = that.filterSharedItems(additionalItems.reverse());
               if (items.length == 0 && that.pageEndIndex == 0) {
                    that.showSpinner = false;
                    that.requestingMoreResults = false;
                    that.noMoreResults = true;
                    that.data = that.data.concat({isLastEntry: true});
               } else {
                    that.processItems(items).thenApply(function(addedCount) {
                        let itemsAddedSoFar = addedCount + itemCount;
                        if (itemsAddedSoFar < that.pageSize) {
                            that.requestMoreResultsRecursive(itemsAddedSoFar);
                        } else {
                            that.requestingMoreResults = false;
                            that.showSpinner = false;
                        }
                    });
               }
            }).exceptionally(function(throwable) {
                that.showMessage(throwable.getMessage());
                that.showSpinner = false;
                that.requestingMoreResults = false;
            });
        },
        showMessage: function(title, body) {
            let bodyText = body == null ? '' : body;
            this.$toast.error(title + bodyText, {timeout:false, id: 'error'})
        },
        joinConversation: function (entry) {
            let that = this;
            that.showSpinner = true;
            this.messenger.cloneLocallyAndJoin(entry.file).thenApply(res => {
                that.showSpinner = false;
                entry.isNewChat = false;
                that.openConversation(entry);
            }).exceptionally(function(throwable) {
                that.showSpinner = false;
                if (throwable.getMessage().startsWith('Child already exists with name:')) {
                    that.openConversation(entry);
                } else {
                    console.log("Unable to join Chat. Error:" + throwable.getMessage());
                    that.showMessage(that.translate("NEWSFEED.ERROR.CHAT.JOIN"));
                }
            });
        },
        openConversation: function (entry) {
            let that = this;
            let app = this.sandboxedApps.appsInstalled.slice().filter(app => app.name == entry.appName);
            if (app.length == 0) {
                var pathStr = '/peergos/recommended-apps/' + entry.appName + '/';
                this.context.getByPath(pathStr + 'peergos-app.json').thenApply(propsFileOpt => {
                    if (propsFileOpt.ref != null) {
                        that.appInstallPropsFile = propsFileOpt.ref;
                        that.appInstallFolder = pathStr;
                        that.showAppInstallation = true;
                        that.appInstalledEntry = entry;
                    } else {
                        that.showMessage(that.translate("NEWSFEED.APP.ABSENT").replace("$NAME", entry.appName));
                    }
                });
            } else {
                this.launchApp(entry.appName, entry.path);
            }
        },
        appInstallSuccess(appName) {
            this.launchApp(this.appInstalledEntry.appName, this.appInstalledEntry.path);
        },
        closeAppInstallation() {
            this.showAppInstallation = false;
        },
        launchApp: function(appName, path) {
            this.showAppSandbox = true;
            this.sandboxAppName = appName;
            this.sandboxAppChatId = this.extractChatUUIDFromPath(path);
        },
        closeAppSandbox() {
            this.showAppSandbox = false;
            this.sandboxAppName = '';
            this.sandboxAppChatId = '';
        },
        viewFolder: function (entry) {
            this.openFileOrDir("Drive", entry.path, {filename:""})
        },
        view: function (event, entry) {
            let type = entry.file.props.getType();
            if(type == "image" || type == "audio" || type == "video") {
                this.openInGallery(entry);
            } else {
                this.viewAction(event, entry.path, entry.file);
            }
        },
        viewAction: function(event, path, file) {
            if (file.isDirectory()) {
                let pathParts = ('/' + path).split("/");
                if (pathParts.length == 6 && pathParts[0] == '' &&
                    pathParts[2] == '.apps' &&
                    pathParts[3] == 'calendar' &&
                    pathParts[4] == 'data') {
                    this.openFileOrDir("Calendar", path, {filename:""});
                } else {
                    this.openFileOrDir("Drive", path, {filename:""});
                }
            } else {
                let userApps = this.availableAppsForFile(file);
                let inbuiltApps = this.getInbuiltApps(file);
                if (userApps.length == 0) {
                    if (inbuiltApps.length == 1) {
                        if (inbuiltApps[0].name == 'hex') {
                            this.openFileOrDir("Drive", path, {filename:""});
                        } else {
                            this.openFileOrDir(inbuiltApps[0].name, path, {filename:file.isDirectory() ? "" : file.getName()})
                        }
                    } else {
                        this.showAppContextMenu(event, inbuiltApps, userApps, path, file);
                    }
                } else {
                    this.showAppContextMenu(event, inbuiltApps, userApps, path, file);
                }
            }
        },
        showAppContextMenu(event, inbuiltApps, userApps, path, file) {
            let appOptions = [];
            for(var i = 0; i < userApps.length; i++) {
                let app = userApps[i];
                let option = {'name': app.name, 'path': path, 'file': file, 'contextMenuText': app.contextMenuText};
                appOptions.push(option);
            }
            for(var i = 0; i < inbuiltApps.length; i++) {
                let app = inbuiltApps[i];
                let option = {'name': app.name, 'path': path, 'file': file, 'contextMenuText': app.contextMenuText};
                appOptions.push(option);
            }
            this.availableApps = appOptions;
            var pos = this.getPosition(event);
            Vue.nextTick(function() {
                var top = pos.y;
                var left = pos.x;
                this.menutop = top + 'px';
                this.menuleft = left + 'px';
            }.bind(this));
            this.showAppMenu = true;
            event.stopPropagation();
        },
        appOpen(event, appName, path, file) {
            this.closeMenus(event);
            this.availableApps = [];
            this.openFileOrDir(appName, path, {filename:file.isDirectory() ? "" : file.getName()})
        },
        viewMediaList: function (mediaList, mediaIndex) {
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
        openInGallery: function (entry) {
            this.filesToViewInGallery = [entry.file];
            this.showEmbeddedGallery = true;
        },
        canComment: function(item) {
            if (item.isDirectory) {
                return false;
            }
            let isFriend = this.friendnames.indexOf(item.sharer) > -1;
            let isFollower = this.followernames.indexOf(item.sharer) > -1;
            return item.sharer == this.context.username || isFriend || isFollower;
        },
        canLoadProfile: function(sharer) {
            let isFriend = this.friendnames.indexOf(sharer) > -1;
            let isFollowing = this.followingnames.indexOf(sharer) > -1;
            return isFriend || isFollowing;
        },
        indent: function(item) {
            let calcMargin = (item.indent * 20) + 10;
            return "" +  calcMargin + "px";
        },
        fromUTCtoLocal: function(dateTime) {
            let date = new Date(dateTime.toString() + "+00:00");//adding UTC TZ in ISO_OFFSET_DATE_TIME ie 2021-12-03T10:25:30+00:00
            let formatted = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate()
                + ' ' + (date.getHours() < 10 ? '0' : '') + date.getHours()
                + ':' + (date.getMinutes() < 10 ? '0' : '') + date.getMinutes()
                + ':' + (date.getSeconds() < 10 ? '0' : '') + date.getSeconds();
            return formatted;
        },
        isNewChat: function(filePath, isChat) {
            let pathParts = filePath.split('/').filter(n => n.length > 0);
            if (pathParts[1] != ".messaging") {
                return false;
            }
            let uuid = pathParts[2];
            if(this.knownChats.findIndex(v => v.chatUuid == uuid) == -1) {
                return true;
            } else {
                return false;
            }
        },
        isSharedCalendar: function(path) {
            //TODO move this into the universal get icon for file method
            let pathParts = path.split("/");
            return pathParts.length == 5 &&
                pathParts[1] == '.apps' &&
                pathParts[2] == 'calendar' &&
                pathParts[3] == 'data';
        },

        createTimelineEntry: function(filePath, entry, socialPost, file, isChat) {
            var displayFilename = true;
            let info = " shared";
            let isMedia = entry== null && socialPost == null  && filePath.includes("/.posts/") && filePath.includes("/media/") ? true : false;

            let sharer = entry != null ? entry.sharer : this.extractOwnerFromPath(filePath);
            if (sharer == this.context.username) {
                info = this.translate("NEWSFEED.YOU") + info;
            }
            let owner = entry != null ? entry.owner : this.extractOwnerFromPath(filePath);
            if (socialPost == null && filePath.includes("/.posts/")) {
                displayFilename = false;
            }
            if(entry != null && entry.cap.isWritable() ) {
                info = info + " " + this.translate("NEWSFEED.WRITEACCESS");
            }
            let props = file.props;
            var isSharedCalendar = false;
            if (this.isSharedCalendar(filePath)) {
                isSharedCalendar = true;
            }
            var appName = "";
            if (props.isDirectory) {
                if (isSharedCalendar) {
                    info = info + " " + this.translate("NEWSFEED.ACAL"); // - " + props.name;
                    displayFilename = false;
                } else if(isChat) {
                    appName = this.extractChatApp(filePath);
                    let app = this.sandboxedApps.appsInstalled.slice().filter(app => app.name == appName);
                    if (app.length > 0) {
                        info = this.translate("NEWSFEED.INVITED.APP") + " " + app[0].displayName;
                    } else {
                        info = this.translate("NEWSFEED.INVITED.APP") + " " + appName;
                    }
                    displayFilename = false;
                } else {
                    info = info + " " + this.translate("NEWSFEED.FOLDER");
                }
            } else if (props.getType() == 'calendar') {
                info = info + " " + this.translate("NEWSFEED.ANEVENT");
                displayFilename = false;
            } else {
                info = info + " " + this.translate("NEWSFEED.FILE");
            }
            if (entry !=null && entry.sharer != entry.owner) {
                info = info + " " + this.translate("NEWSFEED.OWNED") + " " + entry.owner;
            }
            if (!isChat) {
                info = info + ": ";
            }
            let path = props.isDirectory ? filePath : filePath.substring(0, filePath.lastIndexOf(props.name) -1);
            let name = props.name.length > 30 ? props.name.substring(0,27) + '...' : props.name;
            let fileType = isSharedCalendar ? 'calendar' : props.getType();
            let isPost = socialPost != null;
            var status = "";
            if (isPost) {
                let isReply = socialPost.parent.ref != null;
                var identity = socialPost.author == this.context.username ? this.translate("NEWSFEED.YOU")+" " : "";

                info = isReply ? "commented at " : "posted at ";
                info = identity + info;
                info = info + this.fromUTCtoLocal(socialPost.postTime);
                name = socialPost.body.toArray([])[0].inlineText();
                if (socialPost.previousVersions.toArray([]).length > 0) {
                    status = "["+this.translate("NEWSFEED.EDITED")+"]";
                }
            }
            let isNewChat = this.isNewChat(filePath, isChat);
            let item = {
                sharer: sharer,
                owner: owner,
                info: info,
                link: filePath,
                cap: entry == null ? null : entry.cap,
                path: path,
                name: name,
                fullName: props.name,
                hasThumbnail: props.thumbnail.ref != null,
                thumbnail: props.thumbnail.ref == null ? null : file.getBase64Thumbnail(),
                isDirectory: props.isDirectory,
                file: file,
                isLastEntry: false,
                displayFilename: displayFilename,
                fileType: fileType,
                isPost: isPost,
                socialPost: socialPost,
                indent: 1,
                status: status,
                isMedia: isMedia,
                isChat: isChat,
                isNewChat: isNewChat,
                appName: appName
            };
            return item;
        },
        getFileIconClass: function(file) {
            return this.getFileIcon(file);
        },
	    retrieveUnSeen: function(startIndex, requestSize, results) {
	        var future = peergos.shared.util.Futures.incomplete();
	        this.retrieveUnSeenWithFuture(startIndex, requestSize, results, future);
	        return future;
        },
	    retrieveUnSeenWithFuture: function(startIndex, requestSize, results, future) {
	        if (! this.socialFeed.hasUnseen() ) {
	            future.complete(results);
	        } else {
                var ctx = this.context;
                let that = this;
                this.socialFeed.getShared(startIndex, startIndex + requestSize, ctx.crypto, ctx.network).thenApply(function(items) {
                    let allEntries = items.toArray();
                    let newIndex = startIndex + allEntries.length;
                    that.socialFeed.setLastSeenIndex(newIndex).thenApply(function(res) {
                        that.retrieveUnSeenWithFuture(newIndex, requestSize, results.concat(allEntries), future);
                    }).exceptionally(function(throwable) {
                        that.showMessage(throwable.getMessage());
                        that.showSpinner = false;
                    });
                }).exceptionally(function(throwable) {
                    that.showMessage(throwable.getMessage());
                    that.showSpinner = false;
                });
            }
            return future;
        },
	    retrieveResults: function(startIndex, endIndex) {
	        var future = peergos.shared.util.Futures.incomplete();
	        if(startIndex < 0 || startIndex >= endIndex) {
    	        future.complete([]);
	            return future;
	        }
            var ctx = this.context;
            this.socialFeed.getShared(startIndex, endIndex, ctx.crypto, ctx.network).thenApply(function(items) {
                future.complete(items.toArray());
            }).exceptionally(function(throwable) {
                that.showMessage(throwable.getMessage());
                that.showSpinner = false;
            });
            return future;
	    },
        populateTimeline: function(entries) {
            let allTimelineEntries = [];
            for(var j = 0; j < entries.length; j++) {
                let indentedRow = entries[j];
                let item = indentedRow.item;
                let timelineEntry = this.createTimelineEntry(item.path, item.entry, item.socialPost, item.file, item.isChat);
                timelineEntry.indent = indentedRow.indent;
                allTimelineEntries.push(timelineEntry);
                let mediaList = indentedRow.mediaList;
                if (mediaList.length > 0) {
                    for(var k=0; k < mediaList.length; k++) {
                        let mediaTimelineEntry = this.createTimelineEntry(mediaList[k].path, null, null, mediaList[k].file, null);
                        mediaTimelineEntry.indent = indentedRow.indent;
                        allTimelineEntries.push(mediaTimelineEntry);
                    }
                }
            }
            return allTimelineEntries;
        },
        Tree: function(thisRef) {
            this.methodCtx = thisRef;
            this.root = new this.methodCtx.TreeNode(null, "", null, null);
            this.nodeLookupMap = new Map();
            this.lookup = function(path) {
                return path == null ? this.root : this.nodeLookupMap.get(path);
            }
            this.addChild = function(parentPath, item, mediaList) {
                let parent = this.lookup(parentPath);
                if (parent == null) {
                    return null;
                }
                let path = this.methodCtx.toPathKey(item.path);
                let node = new this.methodCtx.TreeNode(parent, path, item, mediaList);
                this.nodeLookupMap.set(path, node);
                parent.addChild(node);
                return node;
            }
            this.collect = function() {
                let accumulator = [];
                this.recurseCollect(this.root, 0, accumulator);
                return accumulator.slice(1);
            }
            this.recurseCollect = function(node, depth, accumulator) {
                accumulator.push(new this.methodCtx.IndentedRow(depth, node.item, node.mediaList));
                let that = this;
                let sortedChildren = node.children.sort(function (a, b) {
                    let aVal = a.item.socialPost != null ? that.methodCtx.extractSocialPostCreationTimestamp(a.item.socialPost)
                        : a.item.file.getFileProperties().created;
                    let bVal = b.item.socialPost != null ? that.methodCtx.extractSocialPostCreationTimestamp(b.item.socialPost)
                        : b.item.file.getFileProperties().created;
                    if (depth == 0) {
                        return bVal.compareTo(aVal);
                    } else {
                        return aVal.compareTo(bVal);
                    }
                });
                node.children = sortedChildren;
                node.children.forEach(each => {
                    that.recurseCollect(each, depth + 1, accumulator);
                });
            }
        },
        TreeNode: function(parent, path, item, mediaList) {
            this.path = path;
            this.item = item;
            this.mediaList = mediaList;
            this.children = [];
            this.parent = parent;
            this.addChild = function(node) {
                this.children.push(node);
            }
        },
        IndentedRow: function(indent, item, mediaList) {
            this.indent = indent;
            this.item = item;
            this.mediaList = mediaList;
        },
        isStartOfThread: function(item) {
            if (item.socialPost.parent.ref != null) {
                return false;
            }
            return true;
        },
        organiseEntries: function(sharedItems, mediaMap) {
            let that = this;
            let sharedItemsMap = new Map();
            sharedItems.forEach(item => {
                if (item.socialPost == null) {
                    sharedItemsMap.set(that.toPathKey(item.path), item);
                }
            });
            sharedItems.reverse().forEach(item => {
                if (that.sharedItemsProcessedMap.get(that.toPathKey(item.path)) != null) {
                    //already processed, skip to next
                } else if (item.socialPost == null) {
                    that.entryTree.addChild(null, item, []);
                } else {
                    let wasCommentOnSharedItem = false;
                    if (item.socialPost.parent.ref != null && !item.socialPost.parent.ref.path.includes("/.posts/")) {
                        let path = that.toPathKey(item.socialPost.parent.ref.path);
                        if (that.entryTree.lookup(path) == null) {
                            var sharedItemParent = mediaMap.get(path);
                            if (sharedItemParent == null) {
                                sharedItemParent = sharedItemsMap.get(path);
                                if (sharedItemParent != null) {
                                    that.sharedItemsProcessedMap.set(that.toPathKey(sharedItemParent.path), sharedItemParent);
                                    that.entryTree.addChild(null, sharedItemParent, []);
                                }
                            } else {
                                that.entryTree.addChild(null, sharedItemParent, []);
                                that.sharedItemsProcessedMap.set(that.toPathKey(sharedItemParent.path), sharedItemParent);
                            }
                        }
                        wasCommentOnSharedItem = true;
                    }

                    let references = item.socialPost.references().toArray([]);
                    var mediaList = [];
                    if (references.length > 0){
                        for(var j = 0; j < references.length; j++) {
                            let media = mediaMap.get(that.toPathKey(references[j].path));
                            if (media != null) {
                                mediaList.push(media);
                            }
                        }
                    }
                    if (!wasCommentOnSharedItem && that.isStartOfThread(item)) {
                        that.entryTree.addChild(null, item, mediaList);
                    } else {
                        let parentPath = that.toPathKey(item.socialPost.parent.ref.path);
                        that.entryTree.addChild(parentPath, item, mediaList);
                    }
                }
            });
            return that.entryTree.collect();
        },
        extractSocialPostCreationTimestamp(socialPost) {
            if (socialPost.previousVersions.isEmpty()) {
                return socialPost.postTime;
            } else {
                let previousVersions = socialPost.previousVersions.toArray();
                return previousVersions[0].postTime;
            }
        },
        mergeAndSortPosts: function(sharedItems, parentPosts, commentPosts) {
            let combinedPosts = commentPosts.concat(parentPosts).concat(sharedItems);
            let that = this;
            let sortedList = combinedPosts.sort(function (a, b) {
                let aVal = a.socialPost != null ? that.extractSocialPostCreationTimestamp(a.socialPost)
                    : a.file.getFileProperties().created;
                let bVal = b.socialPost != null ? that.extractSocialPostCreationTimestamp(b.socialPost)
                    : b.file.getFileProperties().created;
                return bVal.compareTo(aVal);
            });
            let dedupedItems = [];
            sortedList.forEach(item => {
                let foundIndex = dedupedItems.findIndex(v => v.path === item.path);
                if (foundIndex == -1) {
                    dedupedItems.push(item);
                }
            });
            return dedupedItems;
        },
        extractChatUUIDFromPath: function(path) {
            let pathParts = path.split('/').filter(n => n.length > 0);
            return pathParts[pathParts.length -2];
        },
        extractChatOwner: function(chatUuid) {
            let withoutPrefix = chatUuid.substring(chatUuid.indexOf("$") +1);
            return withoutPrefix.substring(0,withoutPrefix.indexOf("$"));
        },
        extractChatApp: function(filePath) {
            let chatUuid = this.extractChatUUIDFromPath(filePath);
            if (chatUuid.startsWith("chat-")) {
                let prefix = chatUuid.substring(chatUuid.indexOf("-") + 1, chatUuid.indexOf("$"));
                return prefix;
            } else {
                return "chat";
            }
        },
        filterOutOwnChats: function(allPairs) {
            let remainingSharedItems = [];
            for(var i = 0; i < allPairs.length; i++) {
                let currentSharedItem = allPairs[i];
                if (currentSharedItem.left.path.includes("/.messaging/")) {
                    let uuid = this.extractChatUUIDFromPath(currentSharedItem.left.path);
                    let chatOwner = this.extractChatOwner(uuid);
                    if(chatOwner != this.context.username) {
                        remainingSharedItems.push(currentSharedItem);
                    }
                } else {
                    remainingSharedItems.push(currentSharedItem);
                }
            }
            return remainingSharedItems;
        },
        buildTimeline: function(items) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            this.context.getFiles(peergos.client.JsUtil.asList(items)).thenApply(function(pairs) {
                let allPairs = pairs.toArray();
                that.messenger.listChats().thenApply(function(chats) {
                    that.knownChats = chats.toArray();
                    let remainingPairs = that.filterOutOwnChats(allPairs);
                    that.loadFiles(remainingPairs).thenApply(function(sharedItems) {
                        that.loadParentPosts(sharedItems).thenApply(function(parentPosts) {
                            that.loadCommentPosts(sharedItems.concat(parentPosts)).thenApply(function(commentPosts) {
                                let sortedList = that.mergeAndSortPosts(sharedItems, parentPosts, commentPosts);
                                that.loadMediaPosts(sortedList).thenApply(function(mediaPosts) {
                                    let entries = that.organiseEntries(sortedList, mediaPosts);
                                    let allTimelineEntries = that.populateTimeline(entries);
                                    future.complete(allTimelineEntries);
                                });
                            });
                        });
                    });
                });
            });
            return future;
        },
        refresh: function() {
            this.seenPosts = new Map();
            var that = this;
            that.showSpinner = true;
            let lastSeenIndex = this.socialFeed.getLastSeenIndex();
            this.entryTree = new this.Tree(this);
            this.sharedItemsProcessedMap = new Map();
            this.socialFeed.update().thenApply(function(updated) {
                that.socialFeed = updated;
                that.updateSocialFeedInstance(updated);
                that.retrieveUnSeen(lastSeenIndex, 100, []).thenApply(function(unseenItems) {
                    that.retrieveResults(that.pageEndIndex, lastSeenIndex, []).thenApply(function(additionalItems) {
                        let items = that.filterSharedItems(unseenItems.reverse().concat(additionalItems.reverse()));
                        var numberOfEntries = items.length;
                        if (numberOfEntries == 0) {
                            that.data = [];
                            that.showSpinner = false;
                        } else {
                            that.buildTimeline(items).thenApply(function(timelineEntries) {
                                that.data = timelineEntries;
                                that.showSpinner = false;
                            });
                        }
                    }).exceptionally(function(throwable) {
                        that.showMessage(throwable.getMessage());
                        that.showSpinner = false;
                    });
                }).exceptionally(function(throwable) {
                    that.showMessage(throwable.getMessage());
                    that.showSpinner = false;
                });
            });
        },
        buildInitialTimeline: function(items) {
            var that = this;
            var future = peergos.shared.util.Futures.incomplete();
            that.buildTimeline(items).thenApply(function(timelineEntries) {
                that.data = timelineEntries;
                that.showSpinner = false;
                that.hasLoadedInitialResults = true;
                future.complete(timelineEntries.length);
            });
            return future;
        },
	    init: function() {
            var that = this;
            that.showSpinner = true;
            this.pageEndIndex = this.socialFeed.getLastSeenIndex();
            this.retrieveUnSeen(this.pageEndIndex, 100, []).thenApply(function(unseenItems) {
                let items = that.filterSharedItems(unseenItems.reverse());
                if (items.length > 0) {
                    that.buildInitialTimeline(items).thenApply(function(addedItems) {
                        if (addedItems == 0) {
                            that.requestMoreResults();
                        }
                    });
                } else {
                    let startIndex = Math.max(0, that.pageEndIndex - that.pageSize);
                    that.retrieveResults(startIndex, that.pageEndIndex, []).thenApply(function(additionalItems) {
                        that.pageEndIndex = startIndex;
                        items = items.concat(that.filterSharedItems(additionalItems.reverse()));
                        var numberOfEntries = items.length;
                        if (numberOfEntries == 0 && startIndex > 0) {
                            that.requestMoreResults();
                        } else {
                            that.buildInitialTimeline(items);
                        }
                    }).exceptionally(function(throwable) {
                        that.showMessage(throwable.getMessage());
                        that.showSpinner = false;
                    });
                }
            }).exceptionally(function(throwable) {
                that.showMessage(throwable.getMessage());
                that.showSpinner = false;
            });
        }
    },
    computed: {
		...Vuex.mapState([
		    'quotaBytes',
		    'usageBytes',
                    'context',
                    'socialData',
                    'path',
                    "sandboxedApps",
		]),
		...Vuex.mapGetters([
			'isSecretLink',
			'getPath'
		]),
        friendnames: function() {
            return this.socialData.friends;
        },
    	followingnames: function() {
            return this.socialData.following;
        },
    	followernames: function() {
            return this.socialData.followers;
        },
        groups: function() {
	    return {groupsNameToUid: this.socialData.groupsNameToUid, groupsUidToName: this.socialData.groupsUidToName};
	},
    	blocks: function() {
            if (this.data == null || this.data.length == 0) {
                return [];
            }
            let blocks = [];
            let thread = [];
            let associatedMedia = {isMedia: true, mediaList: []};
            this.data.forEach(timelineEntry => {
                let isSharedItem = !timelineEntry.isMedia && timelineEntry.entry == null && timelineEntry.socialPost == null;
                if (isSharedItem || timelineEntry.isLastEntry) {
                    if (thread.length > 0) {
                        thread.push(associatedMedia);
                        blocks.push(thread);
                        thread = [];
                    }
                    thread.push(timelineEntry);
                    associatedMedia = {isMedia: true, mediaList: []};
                } else {
                    if (!timelineEntry.isMedia) {
                        if (timelineEntry.indent == 1 && thread.length > 0) {
                            thread.push(associatedMedia);
                            blocks.push(thread);
                            thread = [];
                            associatedMedia = {isMedia: true, mediaList: []};
                            thread.push(timelineEntry);
                        } else {
                            if (associatedMedia.mediaList.length > 0) {
                                thread.push(associatedMedia);
                                associatedMedia = {isMedia: true, mediaList: []};
                            }
                            thread.push(timelineEntry);
                        }
                    } else {
                        associatedMedia.indent = timelineEntry.indent;
                        associatedMedia.mediaList.push(timelineEntry);
                    }
                }
            });
            if (thread.length > 0) {
                thread.push(associatedMedia);
                blocks.push(thread);
            }
            return blocks;
        }
    }
}
</script>

<style>



.newsfeed-view {
    min-height: 100vh;
}
.newsfeed__container{
	width:100%;
	min-height: 100vh;
	padding: 0 32px;
	margin-top: 32px;
}


.newsfeed-view .card__icon {
	width:72px;
	height: 72px;
	color: var(--color-2);
	transform: scale(1);
	transition: transform 0.2s;
        font-size: 5em;
        word-wrap: break-word;
        max-width: 5em;
        cursor: pointer;
}

.newsfeed-view .entry{
	color:var(--color);
    background-color:var(--bg-2);
	border-radius: 12px;
	margin-top:5px;
	padding: 16px;


}
.post-content {
    white-space:pre-wrap;
    margin-bottom:0;
    margin-right: 10px;

    border-radius: 4px;
    padding: 5px;
    font-size: 1.2em;
    overflow-wrap: break-word;
}

@media (max-width: 1024px) {
	.newsfeed__container{
		padding: 0 16px;
	}
}
</style>
