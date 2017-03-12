module.exports = {
    template: require('social.html'),
    data: function() {
        return {
	    targetUsername: ""
	}
    },
    props: ['show', 'data', 'context', 'externalchange', 'messages'],
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
	
	sendInitialFollowRequest: function(name) {
	    console.log("sending follow request to " + name);
	    var that = this;
	    this.context.sendInitialFollowRequest(name)
		.thenApply(function(success) {
		    that.targetUsername = "";
		    that.showMessage("Follow request sent!", "");
		    that.externalchange++;
		});
	},

	acceptAndReciprocate: function(req) {
	    var that = this;
	    this.context.sendReplyFollowRequest(req, true, true)
		.thenApply(function(success) {
		    that.showMessage("Follow request reciprocated!", "");
		    that.externalchange++;
		});
	},
	
        accept: function(req) {
	    var that = this;
	    this.context.sendReplyFollowRequest(req, true, false)
		.thenApply(function(success) {
		    that.showMessage("Follow request accepted!", "");
		    that.externalchange++;
		});
	},
	
        reject: function(req) {
	    var that = this;
	    this.context.sendReplyFollowRequest(req, false, false)
		.thenApply(function(success) {
		    this.showMessage("Follow request rejected!", "");
		    this.externalchange++;
		});
	},

	removeFollower: function(username) {
	    var that = this;
	    this.context.removeFollower(username)
		.thenApply(function(success) {
		    that.showMessage("Removed follower " + username, "");
		    that.externalchange++;
		});
	},
	
        unfollow: function(username) {
	    var that = this;
	    this.context.unfollow(username)
		.thenApply(function(success) {
		    that.showMessage("Stopped following " + username, "");
		    that.externalchange++;
		});
	},
	
        close: function () {
            this.show = false;
        }
    },
    computed: {
	usernames: function() {
	    return this.context.network.usernames.toArray([]);
	}
    }
}
