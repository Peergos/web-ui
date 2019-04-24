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
        updatePassword: function () {
            if(this.existing.length == 0 || this.pw1.length == 0 || this.pw2.length == 0) {
                this.isError = true;
                this.errorClass = "has-error has-feedback alert alert-danger";
                this.error = "All fields must be populated!";
            } else {
                if (this.pw1 == this.pw2) {
                    this.changepassword(this.existing, this.pw1);
                    this.show = false;
                } else {
                    this.isError = true;
                    this.errorClass = "has-error has-feedback alert alert-danger";
                    this.error = "Passwords do not match!";
                }
            }
        },
        close: function () {
            this.show = false;
        }
    }
}
