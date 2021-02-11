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
    props: ['closeSocialPostForm', 'socialFeed', 'context', 'showMessage', 'groups'],
    created: function() {
    },
    methods: {
        close: function () {
            this.closeSocialPostForm();
        },
        getGroupUid: function(groupName) {
            return this.groups.groupsNameToUid[groupName];
        },
        submitPost: function() {
            let that = this;
            that.showSpinner = true;
            let resharingAllowed = true;
            let isPublic = true;
            let parent = peergos.client.JsUtil.emptyOptional();
            let references = peergos.client.JsUtil.emptyList();
            let previousVersions = peergos.client.JsUtil.emptyList();
            let postTime = peergos.client.JsUtil.now();
            let groupUid = this.shareWith == 'Friends' ? this.getGroupUid(peergos.shared.user.SocialState.FRIENDS_GROUP_NAME)
                        : this.getGroupUid(peergos.shared.user.SocialState.FOLLOWERS_GROUP_NAME);
            let socialPost = new peergos.shared.social.SocialPost(this.context.username,
                                this.post, postTime, resharingAllowed, isPublic,
                                parent, references, previousVersions);
            this.socialFeed.createNewPost(socialPost).thenApply(function(result) {
                that.context.shareReadAccessWith(result.left, peergos.client.JsUtil.asSet([groupUid]))
                .thenApply(function(b) {
                        that.showSpinner = false;
                        that.close();
                    }).exceptionally(function(err) {
                        that.showSpinner = false;
                        that.showMessage(err.getMessage());
                });
             }).exceptionally(function(throwable) {
                 that.showMessage(throwable.getMessage());
                 that.showSpinner = false;
             });
        }
    }
}
