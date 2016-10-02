var isDemo = window.location.hostname == "demo.peergos.net";
module.exports = {
    template: require('login.html'),
    data: function() {
        return {
            username: [],
            password: [],
	    network: null,
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
            return peergos.shared.user.UserContext.signIn(that.username, that.password, that.network, that.crypto).thenApply(function(context) {
                that.$dispatch('child-msg', {
		    view:'filesystem', 
		    props:{
			context: context
		    }
		});
                console.log("Signing in/up took " + (Date.now()-creationStart)+" mS from function call");
            });
        },
	showSignup : function() {
	    this.$dispatch('child-msg', {view:"signup", props:{
		username:this.username,
		password:this.password,
		crypto: this.crypto,
		network: this.network
	    }})
	}
    },
    computed: {
	crypto: function() {
	    return peergos.shared.Crypto.initJS();
	}
    },
    asyncComputed: {
	network: function() {
	    return new Promise(function(resolve, reject) {
		peergos.shared.NetworkAccess.buildJS()
		    .thenApply(network => resolve(network));
	    });
	}
    }
};
