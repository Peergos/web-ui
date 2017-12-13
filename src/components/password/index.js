module.exports = {
    template: require('password.html'),
    data: function() {
        return {
            existing: "",
            pw1: "",
            pw2: "",
            error: "",
            isError:false,
            errorClass: ""
        };
    },
    props: ['show', 'changepassword'],
    created: function() {
    },
    methods: {
        close: function () {
            if (this.pw1 == this.pw2) {
                this.changepassword(this.existing, this.pw1);
                this.show = false;
            } else {
                this.isError = true;
                this.errorClass = "has-error has-feedback alert alert-danger";
                this.error = "Passwords do not match!";
            }
        }
    }
}
