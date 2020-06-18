module.exports = {
    template: require('social.html'),
    data: function() {
        return {
            targetUsername: "",
            targetUsernames: [],
            showSpinner: false,
	    showFingerprint: false,
	    initialIsVerified: false,
	    fingerprint: null,
	    friendname: null
        }
    },
    props: ['data', 'context', 'externalchange', 'messages'],
    created: function() {
        Vue.nextTick(this.setTypeAhead);
    },
    methods: {
    setTypeAhead: function() {

        var usernames = this.usernames;
        // remove our username
        usernames.splice(usernames.indexOf(this.context.username), 1);

        this.data.friends.forEach(function(name){
            usernames.splice(usernames.indexOf(name), 1);
        });
        var engine = new Bloodhound({
          datumTokenizer: Bloodhound.tokenizers.whitespace,
          queryTokenizer: Bloodhound.tokenizers.whitespace,
          local: usernames
        });

        engine.initialize();

        $('#friend-name-input').tokenfield({
            minLength: 1,
            minWidth: 200,
            typeahead: [{hint: true, highlight: true, minLength: 1}, { source: engine }]
        });

        $('#friend-name-input').on('tokenfield:createtoken', function (event) {
            //only select from available items
        	var available_tokens = usernames;
        	var exists = true;
        	$.each(available_tokens, function(index, token) {
        		if (token === event.attrs.value)
        			exists = false;
        	});
        	if(exists === true) {
        		event.preventDefault();
            } else {
                //do not allow duplicates in selection
                var existingTokens = $(this).tokenfield('getTokens');
                $.each(existingTokens, function(index, token) {
                    if (token.value === event.attrs.value)
                        event.preventDefault();
                });
            }
        });
        let that = this;
        $('#friend-name-input').on('tokenfield:createdtoken', function (event) {
    	    that.targetUsernames.push(event.attrs.value);
        });

        $('#friend-name-input').on('tokenfield:removedtoken', function (event) {
    	    that.targetUsernames.pop(event.attrs.value);
        });
    },
    resetTypeahead: function() {
        this.targetUsernames = [];
        this.targetUsername = "";
        $('#friend-name-input').tokenfield('setTokens', []);
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

	hideFingerprint: function(isVerified) {
	    this.showFingerprint = false;
	    this.data.annotations[this.friendname] = new peergos.shared.user.FriendAnnotation(this.friendname, isVerified, this.fingerprint.left)
	},
	
	showFingerPrint: function(friendname) {
	    var that = this;
	    this.context.generateFingerPrint(friendname).thenApply(function(f) {
		that.fingerprint = f;
		that.friendname = friendname;
		that.initialIsVerified = that.isVerified(friendname);
		that.showFingerprint = true;
	    })
	},

	sendInitialFollowRequest: function() {
	        if(this.targetUsernames.length == 0) {
	            return;
	        }
            var that = this;
            console.log("sending follow request to " + name);
            that.showSpinner = true;
            that.context.sendInitialFollowRequests(this.targetUsernames)
                .thenApply(function(success) {
                    if(success) {
                        that.showMessage("Follow request(s) sent!", "");
                        that.resetTypeahead();
                        that.$emit("external-change");
                    } else {
                        that.showMessage("Follow request(s) failed!", "");
                        that.resetTypeahead();
                    }
                    that.showSpinner = false;
            }).exceptionally(function(throwable) {
                    that.showMessage(throwable.getMessage());
                    that.showSpinner = false;
            });
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
