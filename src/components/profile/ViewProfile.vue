<template>
<transition name="modal">
<div class="modal-mask" @click="close">
    <meta http-equiv="content-type" content="text/html; charset=utf-8" />
    <div @click.stop class="profile-page-container">
        <span @click="close" tabindex="0" v-on:keyup.enter="close" aria-label="close" class="close">&times;</span>
        <div class="modal-header">
            <h2>Profile</h2>
        </div>
        <div class="modal-body">
            <Spinner v-if="showSpinner"></Spinner>
            <div id="profile-container" class="profile-image" v-if="hasProfileImage()">
                <img id="profile-image" alt="profile image" style="width:150px; height:150px" v-bind:src="getProfileImage()"/>
            </div>
            <div v-if="status.length == 0 && firstName.length == 0 && primaryPhone.length == 0 && primaryEmail.length == 0 && biography.length == 0 " class="profile-view">
                This user hasn't shared any of their profile with you yet.
            </div>
            <div v-if="status.length > 0 || firstName.length > 0 || primaryPhone.length > 0 || primaryEmail.length > 0 || biography.length > 0 " class="profile-view">
                <p v-if="status.length > 0">
                    <span class="profile-span">Status:</span><span>{{status}}</span>
                </p>
                <p v-if="firstName.length > 0">
                    <span class="profile-span">Name:</span><span>{{firstName}}</span>&nbsp;<span >{{lastName}}</span>
                </p>
                <p v-if="primaryPhone.length > 0">
                    <span class="profile-span">Phone:</span><span>{{primaryPhone}}</span>
                </p>
                <p v-if="primaryEmail.length > 0">
                    <span class="profile-span">Email:</span><span>{{primaryEmail}}</span>
                </p>
                <p v-if="biography.length > 0">
                    <span class="profile-span">Biography:</span>
                </p>
                <p style="white-space: pre-wrap; margin-top: 10px; margin-bottom: 0;">{{biography}}</p>
            </div>
        </div>
    </div>
</div>
</transition>
</template>

<script>
const Spinner = require("../spinner/Spinner.vue");

module.exports = {
	components: {
	    Spinner
	},
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
        getProfileImage: function() {
            return this.profileImage;
        },
        hasProfileImage: function() {
            return this.profileImage.length > 0;
        }
    }
}
</script>

<style>
.profile-page-container {
    height: 100%;
    width: 40%;
    overflow-y: auto;
    position: fixed;
    z-index: 2500;
    top: 0;
    left: 50%;
    transform: translate(-50%, 0);
    margin: 0 auto;
    padding: 20px 30px;
    background-color: var(--bg);
    border-radius: 2px;
    box-shadow: 0 2px 8px rgba(0,0,0,.33);
    transition: all .3s ease;
    /* font-family: Helvetica,Arial,sans-serif; */
}

.profile-span {
    font-weight: bold;
    padding-right: 10px;
}

.profile-view {
    font-size: 1.3em;
}

.profile-image {
    margin: 20px;
}
    
#profile-container div {
  display: inline-block;
  margin: 6px 8px;
}

#profile-image img {
  display: block;
  width: 200px;
  height: 200px;
}


</style>
