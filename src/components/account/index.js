module.exports = {
    template: require('account.html'),
    data: function() {
        return {
            password1: "",
            passwordFieldType: "password",
            error: "",
            isError:false,
            errorClass: "",
            warning_message: "",
            warning_body: "",
            warning_consumer_func: () => {},
            showWarning: false
        };
    },
    props: ['deleteAccount', 'username'],
    created: function() {
    },
    methods: {
        togglePassword1: function() {
            this.passwordFieldType = this.passwordFieldType == "text" ? "password" : "text";
        },
        confirmDeleteAccount: function(deleteAccountFn) {
            this.warning_message='Are you absolutely sure you want to delete your account?';
            this.warning_body='';
            this.warning_consumer_func = deleteAccountFn;
            this.showWarning = true;
        },
        completeDeleteAccount: function() {
            this.deleteAccount(this.password1);
            this.close();
        },
        deleteAccountAction: function () {
            if(this.password1.length == 0) {
                this.isError = true;
                this.errorClass = "has-error has-feedback alert alert-danger";
                this.error = "Password must be populated!";
            } else {
                let that = this;
                this.confirmDeleteAccount(() => that.completeDeleteAccount());
            }
        },
        close: function () {
            this.$emit("hide-close-account");
        }
    }
}
