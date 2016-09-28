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
	var that = this;
	Vue.nextTick(function() {
	    if (that.username.length == 0)
		document.getElementById("username").focus();
	    else if (that.password1.length == 0)
		document.getElementById("password1").focus();
	    else
		document.getElementById("password2").focus();
	});
    },
    methods: {
        signup : function() {
            const creationStart = Date.now();
	    const that = this;
	    return peergos.shared.user.UserContext.ensureSignedUp(that.username, that.password1, 8000, true).thenApply(function(context) {
                that.$dispatch('child-msg', {
		    view:'filesystem', 
		    props:{context: context}
		});
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
