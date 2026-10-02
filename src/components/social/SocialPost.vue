<template>
	<transition name="modal" appear>
		<div class="pg-dialog__mask social-post" @click="close()">
			<Spinner v-if="showSpinner"></Spinner>
			<div class="pg-dialog social-post__dialog" role="dialog" aria-modal="true" :aria-label="title" @click.stop>
				<header class="pg-dialog__head">
					<h3 class="pg-dialog__title">{{title}}</h3>
					<DialogClose @close="close()"/>
				</header>
				<div class="pg-dialog__body social-post__body">
					<textarea id="social-post-text" class="pg-input social-post__text" rows="6" :placeholder="textAreaPlaceholder" maxlength="1000" v-model="post"></textarea>
					<div v-if="socialPostAction=='add' || socialPostAction=='reply'" class="social-post__media">
						<button type="button" class="pg-btn" @click="triggerUpload">Upload Media</button>
						<ul v-if="mediaFilenames.length > 0" class="social-post__files">
							<li v-for="filename in mediaFilenames">{{filename}}</li>
						</ul>
						<input type="file" id="uploadInput" @change="uploadFiles" style="display:none;" multiple accept="audio/*,video/*,image/*" />
					</div>
					<fieldset v-if="isReady" class="social-post__share">
						<legend>{{ translate("NEWSFEED.POST.SHARE.WITH") }}</legend>
						<label v-if="shareWithSharerOnly" class="social-post__option" :class="{'social-post__option--on': shareWith == 'Sharer'}">
							<input :disabled="socialPostAction=='edit'" type="radio" id="sharer-option" value="Sharer" v-model="shareWith">
							<span class="social-post__mark" aria-hidden="true"></span>
							{{currentSocialPostEntry.sharer}}
						</label>
						<label v-if="!shareWithSharerOnly" class="social-post__option" :class="{'social-post__option--on': shareWith == 'Friends'}">
							<input :disabled="socialPostAction=='edit'" type="radio" id="friends-option" value="Friends" v-model="shareWith">
							<span class="social-post__mark" aria-hidden="true"></span>
							{{ translate("NEWSFEED.POST.SHARE.WITH.FRIENDS") }}
						</label>
						<label v-if="!shareWithSharerOnly" class="social-post__option" :class="{'social-post__option--on': shareWith == 'Followers', 'social-post__option--off': !allowFollowerSharingOption || socialPostAction=='edit'}">
							<input :disabled="!allowFollowerSharingOption || socialPostAction=='edit'" type="radio" id="followers-option" value="Followers" v-model="shareWith">
							<span class="social-post__mark" aria-hidden="true"></span>
							{{ translate("NEWSFEED.POST.SHARE.WITH.FOLLOWERS") }}
						</label>
					</fieldset>
				</div>
				<footer class="pg-dialog__foot">
					<div class="pg-dialog__actions">
						<span class="pg-dialog__spacer"></span>
						<button type="button" class="pg-btn" @click="close()">{{ translate("PROMPT.CANCEL") }}</button>
						<button type="button" id="prompt-button-id" class="pg-btn pg-btn--primary" :disabled="!isPostingAvailable()" @click="submitPost()">{{ translate("NEWSFEED.POST.BUTTON") }}</button>
					</div>
				</footer>
			</div>
		</div>
	</transition>
</template>

<script>
const i18n = require("../../i18n/index.js");
const DialogClose = require("../dialog/DialogClose.vue");
const helpers = require("../../mixins/storage/index.js");
const ProgressBar = require("../drive/ProgressBar.vue");
const Spinner = require("../spinner/Spinner.vue");

module.exports = {
    components: {
        DialogClose,
        ProgressBar,
        Spinner
    },
    mixins:[i18n],
	data() {
		return {
            title: "Post a Message",
            textAreaPlaceholder: "Type in here...",
			prompt_result: '',
            showSpinner: false,
            shareWith: "Friends",
            post: "",
            isPosting: false,
            allowFollowerSharingOption: true,
            shareWithSharerOnly: false,
            thumbnailImage: "",
            mediaFiles: [],
            mediaFilenames: [],
            progressMonitors: [],
            isReady: false,
		}
	},
    props: ['closeSocialPostForm', 'socialFeed', 'socialPostAction', 'currentSocialPostEntry'],
    computed: {
        ...Vuex.mapState([
            'quotaBytes',
            'usageBytes',
            'context',
            'socialData',
        ]),
        groups: function() {
            return {groupsNameToUid: this.socialData.groupsNameToUid, groupsUidToName: this.socialData.groupsUidToName};
        },
    },
    created: function() {
        let that = this;
        if (this.socialPostAction == 'reply') {
            if (this.currentSocialPostEntry != null) {
                this.title = this.translate("NEWSFEED.POST.REPLY");
                if (this.currentSocialPostEntry.socialPost != null) {
                    if (this.currentSocialPostEntry.socialPost.shareTo == peergos.shared.social.SocialPost.Resharing.Author) {
                        that.shareWith = "Sharer";
                        that.shareWithSharerOnly = true;
                    } else if (this.currentSocialPostEntry.socialPost.shareTo == peergos.shared.social.SocialPost.Resharing.Friends) {
                        this.allowFollowerSharingOption = false;
                    }
                } else {
                    that.shareWith = "Sharer";
                    that.shareWithSharerOnly = true;
                }
            }
            this.isReady = true;
        } else if (this.socialPostAction == 'edit') {
            this.title = this.translate("NEWSFEED.POST.EDIT");
            this.post = this.currentSocialPostEntry.socialPost.body.toArray([])[0].inlineText();
            let pathStr = this.currentSocialPostEntry.path;
            let dirWithoutLeadingSlash = pathStr.startsWith("/") ? pathStr.substring(1) : pathStr;
            let path = peergos.client.PathUtils.directoryToPath(dirWithoutLeadingSlash.split('/'));
            this.context.sharedWith(path).thenApply(function(sharedWith) {
                let readAccess = sharedWith.readAccess.toArray([]);
                if (readAccess[0] == that.getGroupUid(peergos.shared.user.SocialState.FRIENDS_GROUP_NAME)) {
                    that.shareWith = "Friends";
                } else if(readAccess[0] == that.getGroupUid(peergos.shared.user.SocialState.FOLLOWERS_GROUP_NAME)) {
                    that.shareWith = "Followers";
                } else {
                    that.shareWith = "Sharer";
                    that.shareWithSharerOnly = true;
                }
                that.isReady = true;
            });
        } else if (this.socialPostAction == 'add') {
            this.isReady = true;
        }
        Vue.nextTick(function() {
            document.getElementById("social-post-text").focus();
        });
    },
	methods: {
        checkAvailableSpace: function(fileSize) {
            return Number(this.quotaBytes.toString()) - (Number(this.usageBytes.toString()) + fileSize);
        },
	    showMessage: function(msg) {
	        this.$toast.error(msg, {timeout:false});
	    },
        uploadFiles: function(evt) {
            let files = evt.target.files || evt.dataTransfer.files;
            let totalSize = 0;
            for(var i=0; i < files.length; i++) {
                totalSize += files[i].size;
            }
            let spaceAfterOperation = this.checkAvailableSpace(totalSize);
            if (spaceAfterOperation < 0) {
                document.getElementById('uploadInput').value = "";
                let amountToFree = helpers.convertBytesToHumanReadable('' + -spaceAfterOperation);
                let errMsg = this.translate("NEWSFEED.POST.UPLOAD.SPACE.ERROR").replace("$SPACE", amountToFree);
                this.showMessage(errMsg);
            } else {
                this.mediaFiles = files;
                let mediaFilenames = [];
                for(var i = 0; i < files.length; i++) {
                    mediaFilenames.push(files[i].name);
                };
                this.mediaFilenames = mediaFilenames;
            }
        },
        triggerUpload: function() {
            document.getElementById('uploadInput').click()
        },
        close: function (result) {
            this.closeSocialPostForm("", null, null, null, null);
        },
        getGroupUid: function(groupName) {
            return this.groups.groupsNameToUid[groupName];
        },
        readerToAdd: function() {
            let readerToAdd = null;
            if (this.shareWith == 'Friends') {
                readerToAdd = this.getGroupUid(peergos.shared.user.SocialState.FRIENDS_GROUP_NAME);
            } else if(this.shareWith == 'Followers') {
                readerToAdd = this.getGroupUid(peergos.shared.user.SocialState.FOLLOWERS_GROUP_NAME);
            } else if(this.shareWith == 'Sharer') {
                readerToAdd = this.currentSocialPostEntry.sharer;
            }
            return readerToAdd;
        },
        fromShareWithToResharingType: function() {
            let resharingType = null;
            if (this.shareWith == 'Friends') {
                resharingType = peergos.shared.social.SocialPost.Resharing.Friends;
            } else if(this.shareWith == 'Followers') {
                resharingType = peergos.shared.social.SocialPost.Resharing.Followers;
            } else if(this.shareWith == 'Sharer') {
                resharingType = peergos.shared.social.SocialPost.Resharing.Author;
            }
            return resharingType;
        },
        isPostingAvailable: function() {
            return this.isReady && !this.isPosting;
        },
        submitPost: function() {
            if (this.isPosting || (this.mediaFiles.length == 0 && this.post == '')) {
                return;
            }
            this.isPosting = true;
            let that = this;
            that.showSpinner = true;
            let resharingType = this.fromShareWithToResharingType();
            if (this.socialPostAction == 'add') {
                this.addPost(resharingType);
            } else if(this.socialPostAction == 'edit') {
                this.editPost();
            } else if(this.socialPostAction == 'reply') {
                this.replyToPost(resharingType);
            }
        },
        uploadMedia: function(mediaFile, updateProgressBar) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let reader = new browserio.JSFileReader(mediaFile);
            let java_reader = new peergos.shared.user.fs.BrowserFileReader(reader);
            this.context.getSpaceUsage(false).thenApply(usageBytes => {
                that.context.getQuota().thenApply(quotaBytes => {
                    let spaceAfterOperation = Number(quotaBytes.toString()) - (Number(usageBytes.toString()) + mediaFile.size);
                    if (spaceAfterOperation <= 0) {
                        let errMsg = that.translate("NEWSFEED.POST.UPLOAD.SPACE.ERROR2").replace("$NAME", mediaFile.name);
                        that.showMessage(errMsg);
                        future.complete(null);
                    } else {
                        let postTime = peergos.client.JsUtil.now();
                        that.socialFeed.uploadMediaForPost(java_reader, mediaFile.size, postTime, updateProgressBar).thenApply(function(pair) {
                            var thumbnailAllocation = Math.min(100000, mediaFile.size / 10);
                            updateProgressBar({ value_0: thumbnailAllocation});
                            future.complete({mediaItem: pair.right});
                        });
                    }
                });
            });
            return future;
        },
        clearProgressStore: function(progressStore) {
            let that = this;
             progressStore.forEach(progress => {
                 let idx = that.progressMonitors.indexOf(progress);
                 if(idx >= 0) {
                     that.progressMonitors.splice(idx, 1);
                 }
             });
             document.getElementById('uploadInput').value = "";
             this.mediaFilenames = "";
        },
        reduceAllMediaUpload: function(index, accumulator, progressStore, future) {
            let that = this;
            if (index == this.mediaFiles.length) {
                this.clearProgressStore(progressStore);
                future.complete(accumulator);
            } else {
                let progress = progressStore[index];
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
                this.uploadMedia(this.mediaFiles[index], updateProgressBar).thenApply(result => {
                    if (result != null) {
                        accumulator.push(result);
                        that.reduceAllMediaUpload(index+1, accumulator, progressStore, future);
                    } else {
                        that.clearProgressStore(progressStore);
                        future.complete(null);
                    }
                });
            }
        },
        uploadAllMedia: function() {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let progressStore = [];
            for(var i = 0; i < this.mediaFiles.length; i++) {
                let file = this.mediaFiles[i];
                var thumbnailAllocation = Math.min(100000, file.size / 10);
                var resultingSize = file.size + thumbnailAllocation;
                let title = this.translate("NEWSFEED.POST.UPLOAD") + " " + file.name;
                var progress = {
                    title:title,
                    done:0,
                    max:resultingSize,
                    name: file.name
                };
                that.$toast({ component: ProgressBar, props:  progress} , { icon: false , timeout:false, id: file.name});
                that.progressMonitors.push(progress);
                progressStore.push(progress);
            }
            that.reduceAllMediaUpload(0, [], progressStore, future);
            return future;
        },
        addPost: function(resharingType) {
            let that = this;
            this.uploadAllMedia().thenApply(function(mediaResponseList) {
                if (mediaResponseList == null) {
                    that.showSpinner = false;
                    that.isPosting = false;
                } else if (mediaResponseList.length == 0) {
		            let body = peergos.client.JsUtil.asList([new peergos.shared.display.Text(that.post)]);
                    let socialPost = peergos.shared.social.SocialPost.createInitialPost(that.context.username, body, resharingType);
                    that.savePost(socialPost);
                } else {
                    let bodyItems = [new peergos.shared.display.Text(that.post)];
                    mediaResponseList.forEach( mediaResponse => {
                        bodyItems.push(new peergos.shared.display.Reference(mediaResponse.mediaItem));
                    });
                    let body = peergos.client.JsUtil.asList(bodyItems);
                    let socialPost = peergos.shared.social.SocialPost.createInitialPost(that.context.username, body, resharingType);
                    that.savePost(socialPost);
                }
            });
        },
        editPost: function() {
            let that = this;
            let postTime = peergos.client.JsUtil.now();
            let parts = this.currentSocialPostEntry.socialPost.body.toArray([]);
            // Assume element 0 is text for now
            parts[0] = new peergos.shared.display.Text(this.post);
            let body = peergos.client.JsUtil.asList(parts);
            let socialPost = this.currentSocialPostEntry.socialPost.edit(body, postTime);
            let uuid = this.currentSocialPostEntry.path.substring(this.currentSocialPostEntry.path.lastIndexOf("/") + 1);
            this.updatePost(uuid, socialPost);
        },
        replyToPost: function(resharingType) {
            let that = this;
            let path = this.currentSocialPostEntry.path;
            let cap = this.currentSocialPostEntry.cap;
            this.generateContentHash().thenApply(function(hash) {
                let parent = new peergos.shared.display.FileRef(path, cap, hash);
                that.uploadAllMedia().thenApply(function(mediaResponseList) {
                    if (mediaResponseList == null) {
                       that.showSpinner = false;
                       that.isPosting = false;
                    } else if (mediaResponseList.length == 0) {
                        let body = peergos.client.JsUtil.asList([new peergos.shared.display.Text(that.post)]);
			            let replyPost = peergos.shared.social.SocialPost.createComment(parent, resharingType, that.context.username, body);
                        that.savePost(replyPost);
                    } else {
                        let postItems = [new peergos.shared.display.Text(that.post)];
                        mediaResponseList.forEach( mediaResponse => {
                            postItems.push(new peergos.shared.display.Reference(mediaResponse.mediaItem));
                        });
                        let post = peergos.client.JsUtil.asList(postItems);
                        let replyPost = peergos.shared.social.SocialPost.createComment(parent, resharingType, that.context.username, post);
                        that.savePost(replyPost);
                    }
                });
            });
        },
        generateContentHash: function() {
            let future = peergos.shared.util.Futures.incomplete();
            if (this.currentSocialPostEntry.socialPost != null) {
                this.currentSocialPostEntry.socialPost.contentHash(this.context.crypto.hasher).thenApply(function(hash) {
                    future.complete(hash);
                });
            } else {
                this.currentSocialPostEntry.file.getContentHash(this.context.network, this.context.crypto).thenApply(function(hash) {
                    future.complete(hash);
                });
            }
            return future;
        },
        updatePost: function(uuid, socialPost) {
           let that = this;
           this.socialFeed.updatePost(uuid, socialPost).thenApply(function(result) {
                   that.showSpinner = false;
                   that.closeSocialPostForm("edit", result.left.toString(), socialPost, result.right
                        , that.currentSocialPostEntry == null ? null : that.currentSocialPostEntry.path);
                   that.isPosting = false;
            }).exceptionally(function(throwable) {
                that.showMessage(throwable.getMessage());
                that.showSpinner = false;
                that.isPosting = false;
            });
        },
        savePost: function(socialPost) {
            let that = this;
            let readerToAdd = this.readerToAdd();
            this.socialFeed.createNewPost(socialPost).thenApply(function(result) {
                that.context.shareReadAccessWith(result.left, peergos.client.JsUtil.asSet([readerToAdd])).thenApply(function(b) {
                    that.showSpinner = false;
                    that.closeSocialPostForm("save", result.left.toString(), socialPost, result.right
                        , that.currentSocialPostEntry == null ? null : that.currentSocialPostEntry.path);
                    that.isPosting = false;
                }).exceptionally(function(err) {
                    that.showSpinner = false;
                    that.showMessage(err.getMessage());
                    that.isPosting = false;
                });
            }).exceptionally(function(throwable) {
                that.showMessage(throwable.getMessage());
                that.showSpinner = false;
                that.isPosting = false;
            });
        },
	}
}
</script>
<style>
.modal-mask {
  position: fixed;
  z-index: 2500;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, .5);
  transition: opacity .3s ease;
}

/* A post, a reply or an edit, on the surface the other dialogs use: the words, what goes
   with them, and who sees it, as one row of choices. */

.social-post__dialog {
	width: 480px;
}

.social-post__body {
	display: flex;
	flex-direction: column;
	gap: 14px;
}

/* over the page-wide textarea rules this file has long carried, which ring it in green and
   paint a wide inset shadow on focus: here it is a field like the others */
.social-post .social-post__text,
.social-post .social-post__text:focus,
.social-post .social-post__text:active,
.social-post .social-post__text:focus-visible {
	width: 100%;
	min-height: 140px;
	padding: 10px 12px;
	resize: vertical;
	font-size: 15px;
	line-height: 1.4;
	color: var(--color);
	-webkit-text-fill-color: var(--color);
	background-color: var(--bg-2);
	border: 1px solid var(--border-color);
	border-radius: var(--radius-control);
	box-shadow: none;
	-webkit-box-shadow: none;
}

.social-post .social-post__text:focus-visible {
	outline: 2px solid var(--green-500);
	outline-offset: 1px;
}

.social-post__media {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 6px;
}

.social-post__files {
	margin: 0;
	padding: 0;
	list-style: none;
	font-size: var(--text-small);
	color: var(--pg-muted);
	overflow-wrap: anywhere;
}

.social-post__share {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin: 0;
	padding: 0;
	border: 0;
}

.social-post__share legend {
	width: 100%;
	margin: 0 0 2px;
	padding: 0;
	border: 0;
	font-size: 10px;
	text-transform: uppercase;
	letter-spacing: .07em;
	color: var(--pg-muted);
}

.social-post__option {
	position: relative;
	display: inline-flex;
	align-items: center;
	gap: 8px;
	min-height: 40px;
	margin: 0;
	padding: 6px 14px 6px 10px;
	font-size: var(--text-small);
	font-weight: var(--regular);
	border: 1px solid var(--border-color);
	border-radius: var(--radius-pill);
	cursor: pointer;
}

.social-post__option--on {
	border-color: var(--green-500);
	background-color: var(--pg-tint-ok);
}

.social-post__option--off {
	opacity: .55;
	cursor: default;
}

.social-post__option input {
	position: absolute;
	opacity: 0;
	width: 0;
	height: 0;
}

.social-post__mark {
	position: relative;
	flex: none;
	width: 16px;
	height: 16px;
	border: 2px solid var(--pg-muted);
	border-radius: 50%;
}

.social-post__option--on .social-post__mark {
	border-color: var(--green-500);
}

.social-post__option--on .social-post__mark:after {
	content: "";
	position: absolute;
	top: 2px;
	left: 2px;
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background-color: var(--green-500);
}

.social-post__option input:focus-visible + .social-post__mark {
	outline: 2px solid var(--green-500);
	outline-offset: 2px;
}


textarea {
	width:100%;

	font-size: var(--text);
	border-radius: 4px;

	-webkit-appearance:none;
    -moz-appearance:none;
    appearance: none;

	outline: none;
	box-shadow: none;

	border: 2px solid var(--green-500);
	color: var(--color);
    background-color: var(--bg);
}
textarea:focus,
textarea:active,
textarea:focus-visible{
	outline:none;
	border: 2px solid var(--green-500)!important;
}
/* TODO: quick reset, we shopuld properly remove other styles */
textarea:-webkit-autofill,
textarea:-webkit-autofill:hover,
textarea:-webkit-autofill:focus,
textarea:-webkit-autofill:active,
textarea:focus,
textarea:active,
textarea:focus-visible{
	color:var(--color);
	font-size: var(--text);
	box-shadow:none;
	-webkit-text-fill-color: var(--color);
	-webkit-box-shadow:0 0 0 30px var(--bg-2) inset;
	border-color: var(--bg-2);
}

</style>