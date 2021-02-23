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
            allowFollowerSharingOption: true
        }
    },
    props: ['closeSocialPostForm', 'socialFeed', 'context', 'showMessage', 'groups', 'socialPostAction', 'currentSocialPostEntry'],
    created: function() {
        let that = this;
        if (this.currentSocialPostEntry != null) {
            if (this.socialPostAction == 'reply') {
                if (this.currentSocialPostEntry.socialPost.shareTo == peergos.shared.social.SocialPost.Resharing.Friends) {
                    this.allowFollowerSharingOption = false;
                } else {
                    this.shareWith = "Followers";
                }
            }
        }
        if (this.socialPostAction == 'edit') {
            this.title = "Edit a Post";
            this.post = this.currentSocialPostEntry.socialPost.body;
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
        addPost: function(groupUid, resharingType) {
           let tags = peergos.client.JsUtil.emptyList();
           let type = peergos.shared.social.SocialPost.Type.Text;
           let socialPost = new peergos.shared.social.SocialPost.createInitialPost(type, this.context.username, this.post, tags, resharingType);
           this.savePost(socialPost, groupUid);
        },
        editPost: function(groupUid) {
            let that = this;
            let tags = peergos.client.JsUtil.emptyList();
            let postTime = peergos.client.JsUtil.now();
            let references = peergos.client.JsUtil.emptyList();
            let socialPost = this.currentSocialPostEntry.socialPost.edit(this.post, tags, postTime, references);
            let uuid = this.currentSocialPostEntry.path.substring(this.currentSocialPostEntry.path.lastIndexOf("/") + 1);
            this.updatePost(uuid, socialPost, groupUid);
        },
        replyToPost: function(groupUid, resharingType) {
            let that = this;
            let type = peergos.shared.social.SocialPost.Type.Text;
            let path = this.currentSocialPostEntry.path;
            let cap = this.currentSocialPostEntry.cap;
            this.generateContentHash().thenApply(function(hash) {
                let tags = peergos.client.JsUtil.emptyList();
                let parent = new peergos.shared.social.SocialPost.Ref(path, cap, hash);
                let replyPost = peergos.shared.social.SocialPost.createComment(parent, resharingType, type, that.context.username, that.post, tags);
                that.savePost(replyPost, groupUid);
            });
        },
        generateContentHash: function() {
            let future = peergos.shared.util.Futures.incomplete();
            if (this.currentSocialPostEntry.socialPost != null) {
                this.currentSocialPostEntry.socialPost.contentHash(this.context.crypto.hasher).thenApply(function(hash) {
                    future.complete(hash);
                });
            } else {
                //TODO create hash for files
               let tags = peergos.client.JsUtil.emptyList();
               let type = peergos.shared.social.SocialPost.Type.Text;
               let resharingWith = peergos.shared.social.SocialPost.Resharing.Followers;
               let dummySocialPost = new peergos.shared.social.SocialPost.createInitialPost(type, this.context.username,
                    "", tags, resharingWith);
                dummySocialPost.contentHash(this.context.crypto.hasher).thenApply(function(hash) {
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
