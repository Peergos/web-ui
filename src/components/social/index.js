module.exports = {
    template: require('social.html'),
    data: function() {
        return {
            targetUsername: "",
            showSpinner: false,
	    showFingerprint: false,
	    fingerprint:null,
	    friendname:null
        }
    },
    props: ['data', 'context', 'externalchange', 'messages'],
    created: function() {
        Vue.nextTick(this.setTypeAhead);
    },
    methods: {
        setTypeAhead: function() {
            var substringMatcher = function(strs) {
                return function findMatches(q, cb) {
                    var matches, substringRegex;

                    //an array that will be populated with substring matches
                    matches = [];

                    // regex used to determine if a string contains the substring `q`
                    substrRegex = new RegExp(q, 'i');

                    // iterate through the pool of strings and for any string that
                    // contains the substring `q`, add it to the `matches` array
                    $.each(strs, function(i, str) {
                        if (substrRegex.test(str)) {
                            matches.push(str);
                        }
                    });

                    cb(matches);
                };
            };
            var usernames = this.usernames;
            // remove our username
            usernames.splice(usernames.indexOf(this.context.username), 1);
            console.log("TYPEAHEAD:");
            console.log(usernames);
            $('#friend-name-input')
                .typeahead(
                        {
                            hint: true,
                            highlight: true,
                            minLength: 1
                        },
                        {
                            name: 'usernames',
                            source: substringMatcher(usernames)
                        });
        },

        showMessage: function(title, body) {
            this.messages.push({
                title: title,
                body: body,
                show: true
            });
        },

	isVerified: function(username) {
	    var annotations = this.data.annotations[username]
	    if (annotations == null)
		return false;
	    return annotations.isVerified();
	},
	
	showFingerPrint: function(friendname) {
	    var that = this;
	    this.context.generateFingerPrint(friendname).thenApply(function(f) {
		that.fingerprint = f;
		that.friendname = friendname;
		that.showFingerprint = true;
	    })
	},

	sendInitialFollowRequest: function() {
	    var name = this.targetUsername;
            if(name !== this.context.username) {
                var that = this;
                console.log("sending follow request to " + name);
                that.showSpinner = true;
                that.context.sendInitialFollowRequest(name)
                    .thenApply(function(success) {
                        if(success) {
                            that.showMessage("Follow request sent!", "");
                            that.targetUsername = "";
                            that.$emit("external-change");
                        } else {
                            that.showMessage("Follow request failed!", "");
                        }
                        that.showSpinner = false;
                }).exceptionally(function(throwable) {
                        that.showMessage(throwable.getMessage());
                        that.targetUsername = "";
                        that.showSpinner = false;
                });
            }
        },

        acceptAndReciprocate: function(req) {
            var that = this;
            this.showSpinner = true;
            this.context.sendReplyFollowRequest(req, true, true)
                .thenApply(function(success) {
                    that.showMessage("Follow request reciprocated!", "");
                    that.showSpinner = false;
                    that.$emit("external-change");
                });
        },

        accept: function(req) {
            var that = this;
            this.showSpinner = true;
            this.context.sendReplyFollowRequest(req, true, false)
                .thenApply(function(success) {
                    that.showMessage("Follow request accepted!", "");
                    that.showSpinner = false;
                    that.$emit("external-change");
                });
        },

        reject: function(req) {
            var that = this;
            this.showSpinner = true;
            this.context.sendReplyFollowRequest(req, false, false)
                .thenApply(function(success) {
                    that.showMessage("Follow request rejected!", "");
                    that.showSpinner = false;
                    that.$emit("external-change");
                });
        },

        removeFollower: function(username) {
            var that = this;
            this.showSpinner = true;
            this.context.removeFollower(username)
                .thenApply(function(success) {
                    that.showMessage("Removed follower " + username, "");
                    that.showSpinner = false;
                    that.$emit("external-change");
                });
        },

        unfollow: function(username) {
            var that = this;
            this.showSpinner = true;
            this.context.unfollow(username)
                .thenApply(function(success) {
                    that.showMessage("Stopped following " + username, "");
                    that.showSpinner = false;
                    that.$emit("external-change");
                });
        },

        close: function () {
            this.$emit("hide-social");
        }
    },
    computed: {
        usernames: function() {
            return this.context.network.usernames.toArray([]);
        }
    }
}
