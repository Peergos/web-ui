module.exports = {
    template: require('social.html'),
    data: function() {
        return {
	    targetUsername: ""
	}
    },
    props: ['show', 'data'],
    created: function() {
    },
    methods: {
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
	
        close: function () {
            this.show = false;
        }
    },
    computed: {
	usernames: function() {
	    return data.network.usernames.toArray([]);
	}
    }
}
