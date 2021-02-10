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
    props: ['closeSocialPostForm', 'socialFeed', 'context', 'showMessage'],
    created: function() {
    },
    methods: {
        close: function () {
            this.closeSocialPostForm();
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
            console.log("post=" + this.post + " with=" + this.shareWith);
            let socialPost = new peergos.shared.social.SocialPost(this.context.username,
                                this.post, postTime,
                                resharingAllowed, isPublic,
                                parent, references, previousVersions);
            this.socialFeed.createNewPost(socialPost).thenApply(function(result) {
                 that.showSpinner = false;
                 that.close();
             }).exceptionally(function(throwable) {
                 that.showMessage(throwable.getMessage());
                 that.showSpinner = false;
             });
            //this.postSocialMessage(this.post, this.shareWith);
        }
    }
}
