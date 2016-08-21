var isDemo = window.location.hostname == "demo.peergos.net";
module.exports = {
    template: require('login.html'),
    data: function() {
        return {
            username: [],
            password: [],
	    demo: isDemo
        };
    },
    props: {

    },
    created: function() {
        console.debug('Login module created!');
    },
    methods: {
        login : function() {
            const creationStart = Date.now();
	    const that = this;
            JavaPoly.type("peergos.user.UserContext").then(function(UserContext) {
                return UserContext.ensureSignedUp(that.username, that.password, 8000, true);
            }).then(function(context) {
                that.$parent.currentView = 'filesystem';
                console.log(context);
                window.context = new UserContextWrapper(context);
                console.log("Signing in/up took " + (Date.now()-window.pageStart)+" mS from page start");
                console.log("Signing in/up took " + (Date.now()-creationStart)+" mS from function call");
            });
        },
	showSignup : function() {
	    this.$parent.currentView = "signup";
	}
    },
    computed: {

    }
};
