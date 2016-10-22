module.exports = {
    template: require('social.html'),
    data: function() {
        return {
	    targetUsername: "",
	    initialized: false
	}
    },
    props: ['show', 'data'],
    created: function() {
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
            const usernames =  this.usernames;
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
	
	keypress: function() {
	    if (!this.initialized) {
		this.setTypeAhead();
		this.initialized = true;
	    }
	},
	
	sendInitialFollowRequest: function(name) {
	    console.log("sending follow request to " + name);
	    this.data.context.sendInitialFollowRequest(name)
		.thenApply(success => {
		    alert("Follow request sent!");
		    this.targetUsername = "";
		});
	},

	acceptAndReciprocate: function(req) {
	    this.data.context.sendReplyFollowRequest(req, true, true)
		.thenApply(success => {
		    alert("Follow request reciprocated!");
		});
	},
	
        accept: function(req) {
	    this.data.context.sendReplyFollowRequest(req, true, false)
		.thenApply(success => {
		    alert("Follow request accepted!");
		});
	},
	
        reject: function(req) {
	    this.data.context.sendReplyFollowRequest(req, false, false)
		.thenApply(success => {
		    alert("Follow request rejected!");
		});
	},

	removeFollower: function(username) {
	    this.data.context.removeFollower(username)
		.thenApply(success => {
		    alert("Removed follower " + username);
		});
	},
	
        unfollow: function(username) {
	    this.data.context.unfollow(username)
		.thenApply(success => {
		    alert("Stopped following " + username);
		});
	},
	
        close: function () {
            this.show = false;
        }
    },
    computed: {
	usernames: function() {
	    if (this.data.network == null)
		return [];
	    return this.data.network.usernames.toArray([]);
	}
    }
}
