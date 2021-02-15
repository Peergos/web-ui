module.exports = {
    template: require('social-post.html'),
    data: function() {
        return {
            showSpinner: false,
            title: "Post a Message",
            textAreaPlaceholder: "Type in here...",
            shareWith: "Friends",
            post: ""
        }
    },
    props: ['closeSocialPostForm', 'socialFeed', 'context', 'showMessage', 'groups', 'socialPostAction', 'currentSocialPostTriple'],
    created: function() {
        let that = this;
        if (this.socialPostAction == 'edit') {
            this.post = this.currentSocialPostTriple.middle.body;
            this.context.sharedWith(this.currentSocialPostTriple.left).thenApply(function(sharedWith) {
                let readAccess = sharedWith.readAccess.toArray([]);
                if (readAccess[0] == that.getGroupUid(peergos.shared.user.SocialState.FRIENDS_GROUP_NAME)) {
                    that.shareWith = "Friends";
                } else if(readAccess[0] == that.getGroupUid(peergos.shared.user.SocialState.FOLLOWERS_GROUP_NAME)) {
                    that.shareWith = "Followers";
                }
            });
        }
    },
    methods: {
        close: function () {
            this.closeSocialPostForm(this.currentSocialPostTriple);
        },
        getGroupUid: function(groupName) {
            return this.groups.groupsNameToUid[groupName];
        },
        submitPost: function() {
            let that = this;
            that.showSpinner = true;
            let groupUid = this.shareWith == 'Friends' ? this.getGroupUid(peergos.shared.user.SocialState.FRIENDS_GROUP_NAME)
                        : this.getGroupUid(peergos.shared.user.SocialState.FOLLOWERS_GROUP_NAME);
            if (this.socialPostAction == 'add') {
                this.addPost(groupUid);
            } else if(this.socialPostAction == 'edit') {
                this.editPost(groupUid);
            }
        },
        addPost: function(groupUid) {
           let tags = peergos.client.JsUtil.emptyList();
           let socialPost = new peergos.shared.social.SocialPost.createInitialPost(this.context.username, this.post, tags);
           this.savePost(socialPost, groupUid);
        },
        editPost: function(groupUid) {
            let that = this;
            let tags = peergos.client.JsUtil.emptyList();
            let postTime = peergos.client.JsUtil.now();
            let references = peergos.client.JsUtil.emptyList();
            let socialPost = this.currentSocialPostTriple.middle.edit(this.post, tags, postTime, references);
            this.savePost(socialPost, groupUid);
        },
        savePost: function(socialPost, groupUid) {
           let that = this;
           this.socialFeed.createNewPost(socialPost).thenApply(function(result) {
               that.context.shareReadAccessWith(result.left, peergos.client.JsUtil.asSet([groupUid])).thenApply(function(b) {
                       that.showSpinner = false;
                       that.currentSocialPostTriple = {left: result.left, middle: socialPost, right: result.right};
                       that.close();
                   }).exceptionally(function(err) {
                       that.showSpinner = false;
                       that.showMessage(err.getMessage());
               });
            }).exceptionally(function(throwable) {
                that.showMessage(throwable.getMessage());
                that.showSpinner = false;
            });
        },
    }
}
