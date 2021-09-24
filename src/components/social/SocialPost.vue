<template>
<transition name="modal">
	<div class="modal-mask" @click="close">
    	<meta http-equiv="content-type" content="text/html; charset=utf-8" />
    	<div style="height:20%"></div>
		<div class="modal-container" @click.stop style="height:70%;overflow-y:auto;width:60%;">
			<span @click="close()" tabindex="0" v-on:keyup.enter="close()" aria-label="close" class="close">&times;</span>
			<div class="modal-header">
					<h2>{{title}}</h2>
			</div>
			<spinner v-if="showSpinner"></spinner>
        <div class="modal-body">
            <div id="social-post-main">
                <p>
                    <span>
                    <button v-if="socialPostAction=='add' || socialPostAction=='reply'" class="btn btn-success" @click="triggerUpload">Upload Media</button>
                    &nbsp;{{mediaFilenames}}</span>
                    <input type="file" id="uploadInput" @change="uploadFiles" style="display:none;" multiple accept="audio/*,video/*,image/*" />
                </p>
                <p>
                    <textarea id="social-post-text" style="width:100%;resize: none;" rows=2 :placeholder="textAreaPlaceholder" maxlength="1000" v-model="post"></textarea>
                </p>
                <div v-if="isReady" class="flex-container">
                    <div class="hspace-15">
                        <label style="font-weight: normal;">Share post with:</label>
                    </div>
                    <div v-if="shareWithSharerOnly" class="hspace-15">
                        <input :disabled="socialPostAction=='edit'" type="radio" id="sharer-option" value="Sharer" v-model="shareWith">
                        <label for="sharer-option" style="font-weight: normal;">{{currentSocialPostEntry.sharer}}</label>
                    </div>
                    <div v-if="!shareWithSharerOnly" class="hspace-15">
                        <input :disabled="socialPostAction=='edit'" type="radio" id="friends-option" value="Friends" v-model="shareWith">
                        <label for="friends-option" style="font-weight: normal;">Friends</label>
                    </div>
                    <div v-if="!shareWithSharerOnly" class="hspace-15">
                        <input :disabled="!allowFollowerSharingOption || socialPostAction=='edit'" type="radio" id="followers-option" value="Followers" v-model="shareWith">
                        <label for="followers-option" style="font-weight: normal;">Followers (Includes Friends)</label>
                    </div>
                    <div class="hspace-15">
                        <button :disabled="!isPostingAvailable()" class="btn btn-success" @click="submitPost()">
                            Post
                        </button>
                    </div>
                </div>

                </p>
            </div>
        </div>
    </div>
</div>
</transition>

</template>

<script>
const ProgressBar = require("../drive/ProgressBar.vue");
module.exports = {
    components: {
		ProgressBar,
	},
	data: function() {
        return {
            showSpinner: false,
            title: "Post a Message",
            textAreaPlaceholder: "Type in here...",
            shareWith: "Friends",
            post: "",
            isPosting: false,
            allowFollowerSharingOption: true,
            shareWithSharerOnly: false,
            thumbnailImage: "",
            mediaFiles: [],
            mediaFilenames: "",
            progressMonitors: [],
            isReady: false
        }
    },
    props: ['closeSocialPostForm', 'socialFeed', 'context', 'showMessage', 'groups', 'socialPostAction'
        , 'currentSocialPostEntry', 'checkAvailableSpace', 'convertBytesToHumanReadable'],
    created: function() {
        let that = this;
        if (this.socialPostAction == 'reply') {
            if (this.currentSocialPostEntry != null) {
                this.title = "Post a Comment";
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
            this.title = "Edit a Post";
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
        uploadFiles: function(evt) {
            let files = evt.target.files || evt.dataTransfer.files;
            let totalSize = 0;
            for(var i=0; i < files.length; i++) {
                totalSize += files[i].size;
            }
            let spaceAfterOperation = this.checkAvailableSpace(totalSize);
            if (spaceAfterOperation < 0) {
                document.getElementById('uploadInput').value = "";
                this.showMessage("Media File(s) exceed available Space",
                    "Please free up " + this.convertBytesToHumanReadable('' + -spaceAfterOperation) + " and try again");
            } else {
                this.mediaFiles = files;
                let mediaFilenames = [];
                for(var i = 0; i < files.length; i++) {
                    mediaFilenames.push(files[i].name);
                };
                this.mediaFilenames = mediaFilenames.join(", ");
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
            if (this.isPosting) {
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
            if (mediaFile.size > 2147483647) {
                that.showMessage("Media file greater than 2GiB not currently supported!");
                future.complete(null);
            } else {
                this.context.getSpaceUsage().thenApply(usageBytes => {
                    that.context.getQuota().thenApply(quotaBytes => {
                        let spaceAfterOperation = Number(quotaBytes.toString()) - (Number(usageBytes.toString()) + mediaFile.size);
                        if (spaceAfterOperation <= 0) {
                            that.showMessage("Unable to proceed. " + mediaFile.name + " file size exceeds available space");
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
            }
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

                    that.$toast.update(progress.name,
                                       {content:
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
                var progress = {
                    title:"Encrypting and uploading " + file.name,
                    done:0,
                    max:resultingSize,
                    name: file.name
                };
                that.$toast({
		    component: ProgressBar,
		    props:  progress,
		} , { icon: false , timeout:false, id: file.name})
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
#social-post-text{
	color: var(--color);
	background-color: var(--bg);
}

</style>