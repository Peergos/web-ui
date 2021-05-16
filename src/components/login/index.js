var isDemo = window.location.hostname == "demo.peergos.net";
module.exports = {
    template: require('login.html'),
    data: function() {
        return {
            username: "",
            passwordFieldType: "password",
            password: [],
	    token: "",
            demo: isDemo,
            showSpinner: false,
            showError:false,
            errorTitle:'',
            errorBody:'',
            spinnerMessage:''
        };
    },
    props: ["network"],
    created: function() {
        Vue.nextTick(function() {
            document.getElementById("username").focus();
	});
    },
    methods: {
	togglePassword: function() {
            this.passwordFieldType = this.passwordFieldType == "text" ? "password" : "text";
        },

        lowercaseUsername: function() {
            return this.username.toLocaleLowerCase();
        },

        displayDemoWarning: function() {
	    if (this.demo == true) {
                if(this.isSecretLink == true) {
                    return false;
                }
                return true;
            } else {
                return false;
            }
        },
        
        login : function() {
            const creationStart = Date.now();
            const that = this;
            this.showSpinner = true;
            return peergos.shared.user.UserContext.signIn(
                    that.lowercaseUsername(), that.password, that.network, that.crypto, {"accept" : x => that.spinnerMessage = x}).thenApply(function(context) {
                that.$emit("filesystem", {context: context})
                console.log("Signing in/up took " + (Date.now()-creationStart)+" mS from function call");
                that.showSpinner = false;
            }).exceptionally(function(throwable) {
                        console.log('Error logging in: '+throwable);
                        var msg = throwable.getMessage();
                        that.errorTitle = 'Error logging-in'
                        that.errorBody = throwable.getMessage();
                        that.showSpinner = false;
                        that.showError = true;
                    });
        },

        showSignup : function() {
            this.$emit("signup", {
                username:this.lowercaseUsername(),
                password1:this.password,
                crypto: this.crypto,
                network: this.network,
		token: this.token
            })
        }
    },
    computed: {
        crypto: function() {
            return peergos.shared.Crypto.initJS();
        }
    }
};
