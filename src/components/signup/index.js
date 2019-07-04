module.exports = {
    template: require('signup.html'),
    data: function() {
        return {
            passwordFieldType: "password",
	    password1: "",
            password2FieldType: "password",
	    password2: "",
            checkPassword: false,
            isError: false,
            errorClass: "",
            error:"",
            passwordWarningThreshold: 12,
            email: [],
            showSpinner: false,
            spinnerMessage:'',
            errorTitle:'',
            errorBody:'',
            showError:false,
	        bannedUsernames:["ipfs", "ipns", "root", "http", "https", "admin", "administrator", "support", "mail", "www", "web", "onion", "i2p", "ftp", "sftp", "file", "mailto", "wss", "xmpp", "ssh", "smtp", "imap", "irc"],
	    tosAccepted:false,
	    safePassword:false
        };
    },
    props: ["username", "password1", "crypto", "network"],
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
	lowercaseUsername: function() {
	    this.username = this.username.toLocaleLowerCase();
	},

	togglePassword1: function() {
	    this.passwordFieldType = this.passwordFieldType == "text" ? "password" : "text";
	},
	
        togglePassword2: function() {
	    this.password2FieldType = this.password2FieldType == "text" ? "password" : "text";
	},
	
        signup : function() {
            const creationStart = Date.now();
            const that = this;
            if(!that.tosAccepted) {
                this.errorClass = "has-error has-feedback alert alert-danger";
                this.isError = true;
                this.error = "You must accept the Terms of Service";
            } else if (that.password1 != that.password2) {
                this.errorClass = "has-error has-feedback alert alert-danger";
                this.isError = true;
                this.error = "Passwords do not match!";
            } else {
                let usernameRegEx = /^[a-z0-9](?:[a-z0-9]|[_-](?=[a-z0-9])){0,31}$/;
                if(!usernameRegEx.test(that.username)) {
                    that.errorTitle = 'Invalid username';
                    that.errorBody = "Usernames must consist of between 1 and 32 characters, containing only digits, lowercase letters, underscore and hyphen. They also cannot have two consecutive hyphens or underscores, or start or end with a hyphen or underscore.";
                    that.showError = true;
                } else if (this.bannedUsernames.includes(that.username)) {
                    that.errorTitle = 'Banned username';
                    that.errorBody = "A few usernames are not allowed: " + that.bannedUsernames;
                    that.showError = true;
                } else {
                    this.showSpinner = true;
                    this.spinnerMessage = "signing up!";
                    return peergos.shared.user.UserContext.signUp(that.username, that.password1, that.network, that.crypto
                    , {"accept" : x => that.spinnerMessage = x})
                        .thenApply(function(context) {
                            that.$emit("filesystem", {context: context});
                            console.log("Signing in/up took " + (Date.now()-creationStart)+" mS from function call");
                            this.showSpinner = false;
                        }).exceptionally(function(throwable) {
                            console.log('Error signing up: ' + throwable);
                            that.errorTitle = 'Error signing up'
                                that.errorBody = throwable.getMessage();
                            that.showError = true;
                            that.showSpinner = false;
                        });
                }
            }
        },
        validatePassword: function(inFirstField) {
            if (inFirstField && !this.checkPassword)
                return;
            // after one failed attempt update the status after each keystroke
            var passwd = this.password1;
            var index = this.commonPasswords.indexOf(passwd);
            var suffix = ["th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th"][(index+1) % 10];
            if (index != -1) {
                this.checkPassword = true;
                this.isError = true;
                this.errorClass = "has-error has-feedback alert alert-danger";
                this.error = "Warning: your password is the " + (index+1) + suffix + " most common password!";
            } else if (passwd.length < this.passwordWarningThreshold) {
                this.checkPassword = true;
                this.isError = true;
                this.errorClass = "has-error has-feedback alert alert-danger";
                this.error = "Warning: passwords less than "+ this.passwordWarningThreshold +" characters are considered unsafe.";
            }
            else {
                this.errorClass = this.checkPassword ? "alert alert-success" : "";
                this.error = this.checkPassword ? "That's a better password." : "";
            }
        }
    },
    computed: {
	host: function() {
	    return window.location.origin;
	}
    }
};
