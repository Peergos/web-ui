module.exports = {
    template: require('app.html'),
    data: function() {
        return {
            view:"login",
	    data: {}
        };
    },
    props: [],
    created: function() {
    },
    methods: {
        login: function(data) {
	    this.view = "login"
	    this.data = data;
	},

	signup: function(data) {
	    this.view = "signup"
	    this.data = data;
	},

	filesystem: function(data) {
	    this.view = "filesystem"
	    this.data = data;
	},
    },
};
