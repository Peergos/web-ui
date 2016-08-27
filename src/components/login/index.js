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
	var that = this;
	Vue.nextTick(function() {
	    document.getElementById("username").focus();
	});
    },
    methods: {
        login : function() {
            const creationStart = Date.now();
	    const that = this;
            JavaPoly.type("peergos.user.UserContext").then(function(UserContext) {
                return UserContext.ensureSignedUp(that.username, that.password, 8000, true);
            }).then(function(context) {
                that.$dispatch('child-msg', {
		    view:'filesystem', 
		    props:{context:new UserContextWrapper(context)}
		});
                console.log("Signing in/up took " + (Date.now()-window.pageStart)+" mS from page start");
                console.log("Signing in/up took " + (Date.now()-creationStart)+" mS from function call");
            });
        },
	showSignup : function() {
	    this.$dispatch('child-msg', {view:"signup", props:{username:this.username, password:this.password}})
	}
    },
    computed: {

    }
};
