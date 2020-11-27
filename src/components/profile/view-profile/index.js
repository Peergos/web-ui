module.exports = {
    template: require('view-profile.html'),
    data: function() {
        return {
        firstName: "",
        lastName: "",
        biography: "",
        primaryPhone: "",
        primaryEmail: "",
        profileImage: "",
        status: "",
        showSpinner: false,
        spinnerMessage: ''
        }
    },
    props: ['profile'],
    created: function() {
        this.firstName = this.profile.firstName;
        this.lastName = this.profile.lastName;
        this.biography = this.profile.biography;
        this.primaryPhone = this.profile.primaryPhone;
        this.primaryEmail = this.profile.primaryEmail;
        this.profileImage = this.profile.profileImage;
        this.status = this.profile.status;
    },
    methods: {
        close: function () {
            this.$emit("hide-profile-view");
        },
        showMessage: function(title, body) {
            this.messages.push({
                title: title,
                body: body,
                show: true
            });
        },
        getProfileImage: function() {
            return this.profileImage;
        },
        hasProfileImage: function() {
            return this.profileImage.length > 0;
        }
    }
}
