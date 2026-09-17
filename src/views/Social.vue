<template>
   	<article class="app-view social-view">
	   	<AppHeader>
			<template #primary>
				<h1>{{ translate("APPNAV.SOCIAL") }}</h1>
			</template>
		</AppHeader>
		<main>


		<Fingerprint v-if="showFingerprint"
			v-on:hide-fingerprint="hideFingerprint"
			:fingerprint="fingerprint"
			:friendname="friendname"
			:initialIsVerified="initialIsVerified"
			:context="context">
		</Fingerprint>
		<Spinner v-if="showSpinner"></Spinner>
		<ViewProfile
                    v-if="showProfileViewForm"
                    v-on:hide-profile-view="showProfileViewForm = false"
                    :profile="profile">
                </ViewProfile>
                <section>
			<h3>{{ translate("SOCIAL.SEND.TITLE") }}:</h3>
			<div class="social-invite">
				<FormAutocomplete
				    class="social-invite__field"
				    is-multiple
				    v-model="targetUsernames"
				    :options="usernames"
				    :maxitems="5"
				    :placeholder="translate('SOCIAL.SELECT')"
				/>
				<button type="button" class="pg-btn pg-btn--primary" @click="sendInitialFollowRequest()">
					{{ translate("SOCIAL.SEND") }}
				</button>
			</div>
		</section>

            <div>
                <h3>{{ translate("SOCIAL.INCOMING") }}</h3>
                <div id='follow-request-table-id' class="flex-container table" style="flex-flow:column;">
                  <div v-for="req in socialData.pending" class="flex-container vspace-5" style="justify-content:space-between; max-width:700px;">
                    <div id='follow-request-id' style="font-size:1.5em;">{{ req.getEntry().ownerName }}</div>
		    <div class="flex-container" style="justify-content:space-evenly;">
                      <div class="hspace-5">
			<button type="button" class="pg-btn pg-btn--primary" @click="acceptAndReciprocate(req)">{{ translate("SOCIAL.ALLOWANDFOLLOW") }}</button>
                      </div>
                      <div class="hspace-5">
			<button type="button" class="pg-btn" @click="accept(req)">{{ translate("SOCIAL.ALLOW") }}</button>
                      </div>
                      <div class="hspace-5">
			<button type="button" class="pg-btn pg-btn--danger" @click="reject(req)">{{ translate("SOCIAL.DENY") }}</button>
                      </div>
		    </div>
		  </div>
                </div>
            </div>

            <div>
                <h3>{{ translate("SOCIAL.FRIENDS") }}</h3>
                <div id='friend-table-id' class="table flex-container" style="flex-flow:column;">
                  <div v-for="username in socialData.friends" class="flex-container vspace-5" style="justify-content:space-between; max-width:700px;">
                    <div id='friend-id' style="font-size:1.5em;">
                        <a v-on:click="displayProfile(username)" style="cursor: pointer">{{ username }}</a>
                        <span v-if="isVerified(username)" class="fas fa-check-circle"><span class="not-mobile">{{ translate("VERIFY.VERIFIED") }}</span></span>
		    </div>
		    <div class="flex-container" style="justify-content:space-evenly;">
                      <div class="hspace-5">
			<button type="button" class="pg-btn pg-btn--danger" @click="unfollow(username)">{{ translate("SOCIAL.UNFOLLOW") }}</button>
		      </div>
		      <div class="hspace-5">
			<button type="button" class="pg-btn pg-btn--danger" @click="removeFollower(username)">{{ translate("SOCIAL.REMOVE") }}</button>
		      </div>
		      <div class="hspace-5">
			<button type="button" class="pg-btn" @click="showFingerPrint(username)">{{ translate("SOCIAL.VERIFICATION") }}</button>
		      </div>
		    </div>
                  </div>
                </div>
            </div>

            <div>
                <h3>{{ translate("SOCIAL.FOLLOWERS") }}</h3>
                <div id='follower-table-id' class="table flex-container" style="flex-flow:column;">
		  <div v-for="username in socialData.followers" class="flex-container vspace-5" style="justify-content:space-between; max-width:700px;">
                    <div id='follower-id' style="font-size:1.5em;">
		      {{ username }}
		    </div>
                    <div>
		      <button type="button" class="pg-btn pg-btn--danger" @click="removeFollower(username)">{{ translate("SOCIAL.REMOVE") }}</button>
		    </div>
                  </div>
                </div>
            </div>

            <div>
                <h3>{{ translate("SOCIAL.FOLLOWING") }}</h3>
                <div class="table flex-container" style="flex-flow:column;">
                  <tr v-for="user in socialData.following" class="flex-container vspace-5" style="justify-content:space-between; max-width:700px;">
                    <div style="font-size:1.5em;">
                        <a v-on:click="displayProfile(user)" style="cursor: pointer">{{ user }}</a>
		    </div>
                    <div>
		      <button type="button" class="pg-btn pg-btn--danger" @click="unfollow(user)">{{ translate("SOCIAL.UNFOLLOW") }}</button>
		    </div>
                  </tr>
		</div>
            </div>
            <div>
                <h3>{{ translate("SOCIAL.BLOCKED") }}</h3>
                <div class="table flex-container" style="flex-flow:column;">
                  <tr v-for="user in socialData.blocked" class="flex-container vspace-5" style="justify-content:space-between; max-width:700px;">
                        <div style="font-size:1.5em;">
                            {{ user }}
            		    </div>
                        <div>
            		      <button type="button" class="pg-btn" @click="unblock(user)">{{ translate("SOCIAL.UNBLOCK") }}</button>
            		    </div>
                  </tr>
                </div>
            </div>
		</main>
   </article>
</template>

<script>
const AppButton = require("../components/AppButton.vue");
const AppHeader = require("../components/AppHeader.vue");
const ViewProfile = require("../components/profile/ViewProfile.vue");
const Fingerprint = require("../components/fingerprint/Fingerprint.vue");
const FormAutocomplete = require("../components/form/FormAutocomplete.vue");
const Spinner = require("../components/spinner/Spinner.vue");
const i18n = require("../i18n/index.js");

const routerMixins = require("../mixins/router/index.js");

module.exports = {
	components: {
    	Fingerprint,
	    FormAutocomplete,
		ViewProfile,
		AppButton,
		AppHeader,
		Spinner,
	},
    data() {
        return {
            targetUsername: "",
            targetUsernames: [],
            profile: {
                firstName: "",
                lastName: "",
                biography: "",
                primaryPhone: "",
                primaryEmail: "",
                profileImage: "",
                status: "",
                webRoot: ""
            },
            showSpinner: false,
	    showFingerprint: false,
	    showProfileViewForm: false,
            initialIsVerified: false,
	    fingerprint: null,
	    friendname: null
        }
    },
    props: [],
	mixins:[routerMixins, i18n],

	computed: {
		...Vuex.mapState([
			'context',
			'socialData'
		]),
		...Vuex.mapGetters([
			'isSecretLink',
			'getPath'
		]),
        usernames() {
	    let userList = this.context.network.usernames.toArray([])
	    // remove our username
	    userList.splice(userList.indexOf(this.context.username), 1);
            // remove current friends
	    this.socialData.friends.forEach(function(name){
                userList.splice(userList.indexOf(name), 1);
            });
            return userList;
        }
    },
	created() {
	    let that = this;
        this.showSpinner = true;
        this.updateSocial(() => {
            that.showSpinner = false;
        });
    },
    methods: {
		...Vuex.mapActions([
			'updateSocial'
		]),
        displayProfile: function(username){
            this.showSpinner = true;
            let that = this;
            let context = this.context;
            peergos.shared.user.ProfilePaths.getProfile(username, context).thenApply(profile => {
                var base64Image = "";
                if (profile.profilePhoto.isPresent()) {
                    var str = "";
                    let data = profile.profilePhoto.get();
                    for (let i = 0; i < data.length; i++) {
                        str = str + String.fromCharCode(data[i] & 0xff);
                    }
                    if (data.byteLength > 0) {
                        base64Image = "data:image/png;base64," + window.btoa(str);
                    }
                }
                that.profile = {
                    firstName: profile.firstName.isPresent() ? profile.firstName.get() : "",
                    lastName: profile.lastName.isPresent() ? profile.lastName.get() : "",
                    biography: profile.bio.isPresent() ? profile.bio.get() : "",
                    primaryPhone: profile.phone.isPresent() ? profile.phone.get() : "",
                    primaryEmail: profile.email.isPresent() ? profile.email.get() : "",
                    profileImage: base64Image,
                    status: profile.status.isPresent() ? profile.status.get() : "",
                    webRoot: profile.webRoot.isPresent() ? profile.webRoot.get() : ""
                };
                that.showSpinner = false;
                that.showProfileViewForm = true;
            });
        },
    // resetTypeahead() {
    //     this.targetUsernames = [];
    //     this.targetUsername = "";
    //     $('#friend-name-input').tokenfield('setTokens', []);
    // },

	isVerified(username) {
	    var annotations = this.socialData.annotations[username]
	    if (annotations == null)
		return false;
	    return annotations.isVerified();
	},

	hideFingerprint(isVerified) {
	    this.showFingerprint = false;
	    this.socialData.annotations[this.friendname] = new peergos.shared.user.FriendAnnotation(this.friendname, isVerified, this.fingerprint.left)
	},

	showFingerPrint(friendname) {
	    var that = this;
	    this.context.generateFingerPrint(friendname).thenApply(function(f) {
		that.fingerprint = f;
		that.friendname = friendname;
		that.initialIsVerified = that.isVerified(friendname);
		that.showFingerprint = true;
	    })
	},

	sendInitialFollowRequest() {
	        let that = this;
	        if (this.targetUsernames.length == 0) {
	            let tokenFieldElement = document.getElementById("input-tokenfield");
	            if (tokenFieldElement == null) {
                    return;
	            } else {
                    let singleVal = tokenFieldElement.value.trim();
                    if (singleVal.length > 0 && singleVal != this.context.username) {
                        this.targetUsernames.push(singleVal);
                    } else {
                        return;
                    }
                }
	        }
            this.socialData.pendingOutgoing.forEach(function(name){
                let idx = that.targetUsernames.indexOf(name);
                if (idx > -1) {
                    that.targetUsernames.splice(idx, 1);
                }
            });
	        if (this.targetUsernames.length == 0) {
		        that.$toast(that.translate("SOCIAL.ALREADY.SENT"))
                return;
	        }
	        let alreadyBlockedUsers = [];
            this.socialData.blocked.forEach(function(name){
                let idx = that.targetUsernames.indexOf(name);
                if (idx > -1) {
                    alreadyBlockedUsers.push(name);
                }
            });
            if (alreadyBlockedUsers.length > 0) {
                if (alreadyBlockedUsers.length > 1) {
                    that.$toast(that.translate("SOCIAL.BLOCKED.USERS") + ': ' +
                        alreadyBlockedUsers.join(", ") +
                        '');
                    return;
                } else {
                    that.$toast(that.translate("SOCIAL.USER.BLOCKED").replace("$USER", alreadyBlockedUsers[0]));
                    return;
                }
            }
            that.showSpinner = true;
            that.context.sendInitialFollowRequests(this.targetUsernames)
            .thenApply(function(success) {
                if(success) {
                    // that.resetTypeahead();
                    that.updateSocial(() => {
                        that.$toast(that.translate("SOCIAL.SENT"))
                        that.showSpinner = false;
                        that.targetUsernames = [];
                    });
                } else {
                    that.showSpinner = false;
                    that.$toast(that.translate("SOCIAL.ERROR"))
                                // that.resetTypeahead();
                }
            }).exceptionally(function(throwable) {
                    // if (that.targetUsernames.length == 1) {
                    //     // that.resetTypeahead();
                    // }
                that.showSpinner = false;
                that.$toast.error(`${throwable.getMessage()}`, {timeout:false, id: 'social'})
            });
        },

        acceptAndReciprocate(req) {
            var that = this;
            this.showSpinner = true;
            this.context.sendReplyFollowRequest(req, true, true).thenApply(function(success) {
                that.updateSocial(() => {
                    that.showSpinner = false;
                    that.$toast(that.translate("SOCIAL.RECIPROCATED"))
                });
            });
        },

        accept(req) {
            var that = this;
            this.showSpinner = true;
            this.context.sendReplyFollowRequest(req, true, false).thenApply(function(success) {
                that.updateSocial(() => {
                    that.showSpinner = false;
                    that.$toast(that.translate("SOCIAL.ACCEPTED"))
                });
            });
        },

        reject(req) {
            var that = this;
            this.showSpinner = true;
            this.context.sendReplyFollowRequest(req, false, false).thenApply(function(success) {
                that.updateSocial(() => {
                    that.showSpinner = false;
                    that.$toast(that.translate("SOCIAL.REJECTED"))
                });
            });
        },

        removeFollower(username) {
            var that = this;
            this.showSpinner = true;
            this.context.removeFollower(username).thenApply(function(success) {
                that.updateSocial(() => {
                    that.showSpinner = false;
                    that.$toast(that.translate("SOCIAL.REMOVED")+` ${username}`)
                });
            });
        },

        unfollow(username) {
            var that = this;
            this.showSpinner = true;
            this.context.unfollow(username).thenApply(function(success) {
                that.updateSocial(() => {
                    that.showSpinner = false;
                    that.$toast(that.translate("SOCIAL.STOPPED")+` ${username}`)
                });
            });
        },

        unblock(username) {
            let that = this;
            this.showSpinner = true;
            this.context.unblock(username).thenApply(function(success) {
                that.updateSocial(() => {
                    that.showSpinner = false;
                    that.$toast(`${username} ` + that.translate("SOCIAL.UNBLOCKED"));
                });
            });
        },

        close () {
            this.$emit("hide-social");
        }
    },

}
</script>

<style>
/* the field and the action that sends it belong on one line, with the field taking the
   room: stacked, with the component's own bottom margin between them, they read as two
   unrelated controls */
.social-invite {
	display: flex;
	/* the action takes the field's height, whatever the field's own line height makes it */
	align-items: stretch;
	gap: 10px;
	max-width: 560px;
	margin-bottom: var(--app-margin);
}

.social-invite__field {
	flex: 1 1 auto;
	min-width: 0;
	margin-bottom: 0;
}


/* the view is the screenful and its main fills what the header leaves, as the drive
   and the status card views do: asking for 100vh here as well put the header's height
   past the bottom and left the page scrolling over nothing */
.social-view {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
}

.social-view main{
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    flex: 1 1 auto;
    /* the sides take the gutter the title keeps rather than the wider page margin,
       so the view's first word sits under its name */
    padding: var(--app-margin) 32px;
}

@media (max-width: 1024px) {
    .social-view main{
        padding: var(--app-margin) 16px;
    }
}

</style>
