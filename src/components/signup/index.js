var commonPasswords = require('passwords.json');
var bip39 = require('bip-0039-english.json');

module.exports = {
    template: require('signup.html'),
    data: function() {
        return {
            crypto: null,
            network: null,
            username: [],
	        passwordFieldType: "password",
	        password1: [],
            password2: [],
            checkPassword: false,
            isError: false,
            errorClass: "",
            error:"",
            passwordWarningThreshold: 12,
            commonPasswords: commonPasswords,
            email: [],
            showSpinner: false,
            spinnerMessage:'',
            errorTitle:'',
            errorBody:'',
            showError:false,
	        bannedUsernames:["ipfs", "ipns", "root", "http", "https", "admin", "administrator", "support", "mail", "www", "web", "onion", "i2p", "ftp", "sftp", "file", "mailto", "wss", "xmpp", "ssh", "smtp", "imap", "irc"],
	        tosAccepted:false
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
            if(!that.tosAccepted) {
                this.isError = true;
                this.error = "You must accept the Terms of Service";
            } else if (that.password1 != that.password2) {
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
                            that.$dispatch('child-msg', {
                                view:'filesystem',
                                props:{context: context}
                            });
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
        generatePassword() {
            var bytes = nacl.randomBytes(16);
            var wordIndices = [];
            for (var i=0; i < 7; i++)
            wordIndices[i] = bytes[2*i]*8 + (bytes[2*i + 1] & 7);
            var password = wordIndices.map(j => bip39[j]).join(" ");
            this.passwordFieldType = "text";
            this.password1 = password;
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
    },
    events: {
        'parent-msg': function (msg) {
            // `this` in event callbacks are automatically bound
            // to the instance that registered it
            this.username = msg.username;
            this.password1 = msg.password;
            this.crypto = msg.crypto;
            this.network = msg.network;
        }
    }
};
