<template>
<transition name="modal">
<div class="pg-dialog__mask" @click="close">
    <div class="pg-dialog view-profile" role="dialog" aria-modal="true" aria-label="Profile" @click.stop>
        <header class="pg-dialog__head">
            <h2 class="pg-dialog__title">Profile</h2>
            <DialogClose @close="close"/>
        </header>
        <div class="pg-dialog__body view-profile__body">
            <div v-if="hasProfileImage() || firstName.length > 0 || status.length > 0" class="view-profile__who">
                <img v-if="hasProfileImage()" class="view-profile__photo" alt="profile image" v-bind:src="getProfileImage()"/>
                <div class="view-profile__names">
                    <p v-if="firstName.length > 0" class="view-profile__name">{{firstName}} {{lastName}}</p>
                    <p v-if="status.length > 0" class="view-profile__status">{{status}}</p>
                </div>
            </div>
            <p v-if="status.length == 0 && firstName.length == 0 && primaryPhone.length == 0 && primaryEmail.length == 0 && biography.length == 0" class="pg-note">
                This user hasn't shared any of their profile with you yet.
            </p>
            <dl v-if="primaryPhone.length > 0 || primaryEmail.length > 0" class="pg-facts">
                <div v-if="primaryPhone.length > 0" class="pg-facts__item">
                    <dt>Phone</dt>
                    <dd>{{primaryPhone}}</dd>
                </div>
                <div v-if="primaryEmail.length > 0" class="pg-facts__item">
                    <dt>Email</dt>
                    <dd>{{primaryEmail}}</dd>
                </div>
            </dl>
            <section v-if="biography.length > 0" class="view-profile__bio">
                <h3 class="view-profile__heading">Biography</h3>
                <p class="view-profile__bio-text">{{biography}}</p>
            </section>
        </div>
    </div>
</div>
</transition>
</template>

<script>
const DialogClose = require("../dialog/DialogClose.vue");

module.exports = {
	components: {
	    DialogClose
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
.view-profile {
    width: 480px;
}
.view-profile__body {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding-bottom: 18px;
}
.view-profile__who {
    display: flex;
    align-items: center;
    gap: 16px;
    min-width: 0;
}
.view-profile__photo {
    flex: none;
    width: 88px;
    height: 88px;
    border-radius: 50%;
    object-fit: cover;
}
.view-profile__names {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
}
.view-profile__name {
    margin: 0;
    font-size: 20px;
    font-weight: var(--bold);
    overflow-wrap: anywhere;
}
.view-profile__status {
    margin: 0;
    color: var(--pg-muted);
    overflow-wrap: anywhere;
}
.view-profile__bio {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
/* the same small caps the other dialogs label their sections with */
.view-profile__heading {
    margin: 0;
    font-size: 11px;
    font-weight: var(--bold);
    letter-spacing: .07em;
    text-transform: uppercase;
    color: var(--pg-muted);
}
.view-profile__bio-text {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    line-height: 1.5;
}
</style>
