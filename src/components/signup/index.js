module.exports = {
    template: require('signup.html'),
    data: function() {
        return {
            username: [],
            password1: [],
	    password2: [],
	    email: []
        };
    },
    props: {

    },
    created: function() {
        console.debug('Signup module created!');
    },
    methods: {
        signup : function() {
            const creationStart = Date.now();
	    const that = this;
            JavaPoly.type("peergos.user.UserContext").then(function(UserContext) {
                return UserContext.ensureSignedUp(that.username, that.password1, 8000, true);
            }).then(function(context) {
                that.$dispatch('child-msg', {
		    view:'filesystem', 
		    props:{context:new UserContextWrapper(context)}
		});
                console.log("Signing in/up took " + (Date.now()-window.pageStart)+" mS from page start");
                console.log("Signing in/up took " + (Date.now()-creationStart)+" mS from function call");
            });
        }
    },
    computed: {

    },
    events: {
	'parent-msg': function (msg) {
	    // `this` in event callbacks are automatically bound
	    // to the instance that registered it
	    this.username = msg.username;
	    this.password1 = msg.password;
	}
    }
};
