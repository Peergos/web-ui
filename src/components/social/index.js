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
