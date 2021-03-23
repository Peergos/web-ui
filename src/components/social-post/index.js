module.exports = {
    template: require('social-post.html'),
    data: function() {
        return {
            showSpinner: false,
            title: "Post a Message",
            textAreaPlaceholder: "Type in here...",
            shareWith: "Friends",
            post: "",
            isPosting: false,
            allowFollowerSharingOption: true,
            thumbnailImage: "",
            mediaFiles: [],
            mediaFilenames: "",
            progressMonitors: []
        }
    },
    props: ['closeSocialPostForm', 'socialFeed', 'context', 'showMessage', 'groups', 'socialPostAction', 'currentSocialPostEntry'],
    created: function() {
        let that = this;
        if (this.currentSocialPostEntry != null) {
            if (this.socialPostAction == 'reply') {
                this.title = "Post a Comment";
                if (this.currentSocialPostEntry.socialPost != null && this.currentSocialPostEntry.socialPost.shareTo == peergos.shared.social.SocialPost.Resharing.Friends) {
                    this.allowFollowerSharingOption = false;
                }
            }
        }
        if (this.socialPostAction == 'edit') {
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
                }
            });
        }
        Vue.nextTick(function() {
            document.getElementById("social-post-text").focus();
        });
    },
    methods: {
        uploadFile: function(evt) {
            let files = evt.target.files || evt.dataTransfer.files;
            this.mediaFiles = files;
            let mediaFilenames = [];
            for(var i = 0; i < files.length; i++) {
                mediaFilenames.push(files[i].name);
            };
            this.mediaFilenames = mediaFilenames.join(", ");
        },
        close: function (result) {
            this.closeSocialPostForm("", null, null, null, null);
        },
        getGroupUid: function(groupName) {
            return this.groups.groupsNameToUid[groupName];
        },
        submitPost: function() {
            if (this.isPosting) {
                return;
            }
            this.isPosting = true;
            let that = this;
            that.showSpinner = true;
            let groupUid = this.shareWith == 'Friends' ? this.getGroupUid(peergos.shared.user.SocialState.FRIENDS_GROUP_NAME)
                        : this.getGroupUid(peergos.shared.user.SocialState.FOLLOWERS_GROUP_NAME);
            let resharingType = this.shareWith == 'Friends' ? peergos.shared.social.SocialPost.Resharing.Friends
                                    : peergos.shared.social.SocialPost.Resharing.Followers;
            if (this.socialPostAction == 'add') {
                this.addPost(groupUid, resharingType);
            } else if(this.socialPostAction == 'edit') {
                this.editPost(groupUid);
            } else if(this.socialPostAction == 'reply') {
                this.replyToPost(groupUid, resharingType);
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
                    if (progress.done >= progress.max) {
                        progress.show = false;
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
                    show:true,
                    title:"Encrypting and uploading " + file.name,
                    done:0,
                    max:resultingSize
                };
                that.progressMonitors.push(progress);
                progressStore.push(progress);
            }
            that.reduceAllMediaUpload(0, [], progressStore, future);
            return future;
        },
        addPost: function(groupUid, resharingType) {
            let that = this;
            this.uploadAllMedia().thenApply(function(mediaResponseList) {
                if (mediaResponseList == null) {
                    that.showSpinner = false;
                    that.isPosting = false;
                } else if (mediaResponseList.length == 0) {
		            let body = peergos.client.JsUtil.asList([new peergos.shared.social.SocialPost.Content.Text(that.post)]);
                    let socialPost = peergos.shared.social.SocialPost.createInitialPost(that.context.username, body, resharingType);
                    that.savePost(socialPost, groupUid);
                } else {
                    let bodyItems = [new peergos.shared.social.SocialPost.Content.Text(that.post)];
                    mediaResponseList.forEach( mediaResponse => {
                        bodyItems.push(new peergos.shared.social.SocialPost.Content.Reference(mediaResponse.mediaItem));
                    });
                    let body = peergos.client.JsUtil.asList(bodyItems);
                    let socialPost = peergos.shared.social.SocialPost.createInitialPost(that.context.username, body, resharingType);
                    that.savePost(socialPost, groupUid);
                }
            });
        },
        editPost: function(groupUid) {
            let that = this;
            let postTime = peergos.client.JsUtil.now();
            let parts = this.currentSocialPostEntry.socialPost.body.toArray([]);
            // Assume element 0 is text for now
            parts[0] = new peergos.shared.social.SocialPost.Content.Text(this.post);
            let body = peergos.client.JsUtil.asList(parts);
            let socialPost = this.currentSocialPostEntry.socialPost.edit(body, postTime);
            let uuid = this.currentSocialPostEntry.path.substring(this.currentSocialPostEntry.path.lastIndexOf("/") + 1);
            this.updatePost(uuid, socialPost, groupUid);
        },
        replyToPost: function(groupUid, resharingType) {
            let that = this;
            let path = this.currentSocialPostEntry.path;
            let cap = this.currentSocialPostEntry.cap;
            this.generateContentHash().thenApply(function(hash) {
                let parent = new peergos.shared.social.SocialPost.Ref(path, cap, hash);
                that.uploadAllMedia().thenApply(function(mediaResponseList) {
                    if (mediaResponseList == null) {
                       that.showSpinner = false;
                       that.isPosting = false;
                    } else if (mediaResponseList.length == 0) {
                        let body = peergos.client.JsUtil.asList([new peergos.shared.social.SocialPost.Content.Text(that.post)]);
			            let replyPost = peergos.shared.social.SocialPost.createComment(parent, resharingType, that.context.username, body);
                        that.savePost(replyPost, groupUid);
                    } else {
                        let postItems = [new peergos.shared.social.SocialPost.Content.Text(that.post)];
                        mediaResponseList.forEach( mediaResponse => {
                            postItems.push(new peergos.shared.social.SocialPost.Content.Reference(mediaResponse.mediaItem));
                        });
                        let post = peergos.client.JsUtil.asList(postItems);
                        let replyPost = peergos.shared.social.SocialPost.createComment(parent, resharingType, that.context.username, post);
                        that.savePost(replyPost, groupUid);
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
        updatePost: function(uuid, socialPost, groupUid) {
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
        savePost: function(socialPost, groupUid) {
           let that = this;
           this.socialFeed.createNewPost(socialPost).thenApply(function(result) {
               that.context.shareReadAccessWith(result.left, peergos.client.JsUtil.asSet([groupUid])).thenApply(function(b) {
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
