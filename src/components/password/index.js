module.exports = {
    template: require('password.html'),
    data: function() {
        return {
            existing: "",
            password1: "",
            password2: "",
            passwordFieldType: "password",
	    password2FieldType: "password",
	    passwordWarningThreshold: 12,
            checkPassword: false,
            error: "",
            isError:false,
            errorClass: ""
        };
    },
    props: ['changepassword', 'username'],
    created: function() {
    },
    methods: {
        togglePassword1: function() {
	    this.passwordFieldType = this.passwordFieldType == "text" ? "password" : "text";
	},
	
        togglePassword2: function() {
	    this.password2FieldType = this.password2FieldType == "text" ? "password" : "text";
	},
	
        validatePassword: function(inFirstField) {
            if (inFirstField && !this.checkPassword)
                return;
            // after one failed attempt update the status after each keystroke
            var passwd = this.password1;
            var index = this.commonPasswords.indexOf(passwd);
            var suffix = ["th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th"][(index+1) % 10];
	    console.log(this.username);
            if (passwd === this.username) {
                this.checkPassword = true;
                this.isError = true;
                this.errorClass = "has-error has-feedback alert alert-danger";
                this.error = "Warning: password cannot be the same as your username.";
            } else if (index != -1) {
                this.checkPassword = true;
                this.isError = true;
                this.errorClass = "has-error has-feedback alert alert-danger";
                this.error = "Warning: your password is the " + (index+1) + suffix + " most common password!";
            } else if (passwd.length < this.passwordWarningThreshold) {
                this.checkPassword = true;
                this.isError = true;
                this.errorClass = "has-error has-feedback alert alert-danger";
                this.error = "Warning: passwords less than "+ this.passwordWarningThreshold +" characters are considered unsafe.";
            } else {
                this.errorClass = this.checkPassword ? "alert alert-success" : "";
                this.error = this.checkPassword ? "That's a better password." : "";
            }
        },

	updatePassword: function () {
            if(this.existing.length == 0 || this.password1.length == 0 || this.password2.length == 0) {
                this.isError = true;
                this.errorClass = "has-error has-feedback alert alert-danger";
                this.error = "All fields must be populated!";
            } else {
                if (this.password1 == this.password2) {
                    this.changepassword(this.existing, this.password1);
                    this.show = false;
                } else {
                    this.isError = true;
                    this.errorClass = "has-error has-feedback alert alert-danger";
                    this.error = "Passwords do not match!";
                }
            }
        },
        close: function () {
            this.$emit("hide-password");
        }
    }
}
