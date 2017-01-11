var isDemo = window.location.hostname == "demo.peergos.net";
module.exports = {
    template: require('login.html'),
    data: function() {
        return {
            username: [],
            password: [],
	        demo: isDemo,
    	    showSpinner: false,
            showError:false,
            errorTitle:'',
            errorBody:''
        };
    },
    props: {

    },
    created: function() {
        console.debug('Login module created!');
	var that = this;
	var href = window.location.href;
	const fragment = href.includes("#") ? href.substring(href.indexOf("#") + 1) : "";
	if (fragment.length > 0) {
	    // this is a public link
	    Vue.nextTick(function() {
		that.gotoPublicLink(fragment);
	    });
	} else
	    Vue.nextTick(function() {
		document.getElementById("username").focus();
	    });
    },
    methods: {
	gotoPublicLink: function(link) {
	    var that = this;
	    peergos.shared.NetworkAccess.buildJS()
		.thenApply(network => {
		    peergos.shared.user.UserContext.fromPublicLink(link, network, that.crypto).thenApply(function(context) {
			that.$dispatch('child-msg', {
			    view:'filesystem', 
			    props:{
				context: context
			    }
			});
		    });
		});
	},
	
        login : function() {
            const creationStart = Date.now();
	    const that = this;
	    this.showSpinner = true;
        return peergos.shared.user.UserContext.signIn(that.username, that.password, that.network, that.crypto).thenApply(function(context) {
                that.$dispatch('child-msg', {
		    view:'filesystem', 
		    props:{
			context: context
		    }
		})
        console.log("Signing in/up took " + (Date.now()-creationStart)+" mS from function call");
		that.showSpinner = false;
        }).exceptionally(function(throwable) {
            var msg = throwable.getMessage();
            that.errorTitle = 'Error logging-in'
            //todo fix GTV  throwable.getMessage
            that.errorBody = 'Bad luck old chum';
       		that.showSpinner = false;
            that.showError = true;
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
