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
                that.$parent.currentView = 'filesystem';
                console.log(context);
                window.context = new UserContextWrapper(context);
                console.log("Signing up took " + (Date.now()-window.pageStart)+" mS from page start");
                console.log("Signing up took " + (Date.now()-creationStart)+" mS from function call");
            });
        }
    },
    computed: {

    }
};
