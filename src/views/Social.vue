<template>
   	<article class="app-view social-view">
	   	<AppHeader>
			<template #primary>
				<h1>Social view</h1>
			</template>
		</AppHeader>
		<main>


		<fingerprint v-if="showFingerprint"
			v-on:hide-fingerprint="hideFingerprint"
			:fingerprint="fingerprint"
			:friendname="friendname"
			:initialIsVerified="initialIsVerified"
			:context="context">
		</fingerprint>
		<spinner v-if="showSpinner"></spinner>
		<ViewProfile
                    v-if="showProfileViewForm"
                    v-on:hide-profile-view="showProfileViewForm = false"
                    :profile="profile">
                </ViewProfile>
                <section>
			<h3>Send follow request:</h3>
			<FormAutocomplete
			    is-multiple
			    v-model="targetUsernames"
			    :options="usernames"
                :maxitems="5"
			    placeholder="please select user"
			/>
			<AppButton
				accent
				aria-label="Send"
				@click.native="sendInitialFollowRequest()"
			>
				Send
			</AppButton>
		</section>

            <div>
                <h3>Incoming follow requests</h3>
                <div id='follow-request-table-id' class="flex-container table" style="flex-flow:column;">
                  <div v-for="req in socialData.pending" class="flex-container vspace-5" style="justify-content:space-between; max-width:700px;">
                    <div id='follow-request-id' style="font-size:1.5em;">{{ req.getEntry().ownerName }}</div>
		    <div class="flex-container" style="justify-content:space-evenly;">
                      <div class="hspace-5">
			<button class="btn btn-success" @click="acceptAndReciprocate(req)">Allow and follow back</button>
                      </div>
                      <div class="hspace-5">
			<button class="btn btn-info" @click="accept(req)">Allow</button>
                      </div>
                      <div class="hspace-5">
			<button class="btn btn-danger" @click="reject(req)">Deny</button>
                      </div>
		    </div>
		  </div>
                </div>
            </div>

            <div>
                <h3>Friends</h3>
                <div id='friend-table-id' class="table flex-container" style="flex-flow:column;">
                  <div v-for="username in socialData.friends" class="flex-container vspace-5" style="justify-content:space-between; max-width:700px;">
                    <div id='friend-id' style="font-size:1.5em;">
                        <a v-on:click="displayProfile(username)" style="cursor: pointer">{{ username }}</a>
                        <span v-if="isVerified(username)" class="fas fa-check-circle"><span class="not-mobile">Verified</span></span>
		    </div>
		    <div class="flex-container" style="justify-content:space-evenly;">
                      <div class="hspace-5">
			<button class="btn btn-danger" @click="unfollow(username)">Unfollow</button>
		      </div>
		      <div class="hspace-5">
			<button class="btn btn-danger" @click="removeFollower(username)">Remove</button>
		      </div>
		      <div class="hspace-5">
			<button class="btn btn-success" @click="showFingerPrint(username)">Verification</button>
		      </div>
		    </div>
                  </div>
                </div>
            </div>

            <div>
                <h3>Followers</h3>
                <div id='follower-table-id' class="table flex-container" style="flex-flow:column;">
		  <div v-for="username in socialData.followers" class="flex-container vspace-5" style="justify-content:space-between; max-width:700px;">
                    <div id='follower-id' style="font-size:1.5em;">
		      {{ username }}
		    </div>
                    <div>
		      <button class="btn btn-danger" @click="removeFollower(username)">Remove</button>
		    </div>
                  </div>
                </div>
            </div>

            <div>
                <h3>Following</h3>
                <div class="table flex-container" style="flex-flow:column;">
                  <tr v-for="user in socialData.following" class="flex-container vspace-5" style="justify-content:space-between; max-width:700px;">
                    <div style="font-size:1.5em;">
                        <a v-on:click="displayProfile(user)" style="cursor: pointer">{{ user }}</a>
		    </div>
                    <div>
		      <button class="btn btn-danger" @click="unfollow(user)">Unfollow</button>
		    </div>
                  </tr>
		</div>
            </div>
		</main>
   </article>
</template>

<script>
const AppHeader = require("../components/AppHeader.vue");
const ViewProfile = require("../components/profile/ViewProfile.vue");
const FormAutocomplete = require("../components/form/FormAutocomplete.vue");
const routerMixins = require("../mixins/router/index.js");

module.exports = {
	components: {
	    FormAutocomplete,
		ViewProfile,
		AppHeader
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
	mixins:[routerMixins],

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
		this.updateSocial(this.test);
    },
	mounted(){
            this.updateSocial();
	},
    methods: {
		...Vuex.mapActions([
			'updateSocial'
		]),
		test(){
			console.log('test')
		},
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
		        that.$toast('Follow request already sent')
                return;
	        }
            console.log("sending follow request");
            that.showSpinner = true;
            that.context.sendInitialFollowRequests(this.targetUsernames)
            .thenApply(function(success) {
                if(success) {
                    // that.resetTypeahead();
                    that.$toast('Follow request(s) sent')
                    that.updateSocial();
                    that.targetUsernames = [];
                } else {
                    that.$toast('Follow request(s) failed')
                                // that.resetTypeahead();
                }
                that.showSpinner = false;
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
            this.context.sendReplyFollowRequest(req, true, true)
                .thenApply(function(success) {
		    that.showSpinner = false;
		    that.$toast('Follow request reciprocated')
		    that.updateSocial();
                });
        },

        accept(req) {
            var that = this;
            this.showSpinner = true;
            this.context.sendReplyFollowRequest(req, true, false)
                .thenApply(function(success) {
		    that.showSpinner = false;
		    that.$toast('Follow request accepted')
		    that.updateSocial();
                });
        },

        reject(req) {
            var that = this;
            this.showSpinner = true;
            this.context.sendReplyFollowRequest(req, false, false)
                .thenApply(function(success) {
                    that.showSpinner = false;
		    that.$toast('Follow request rejected')
		    that.updateSocial();
                });
        },

        removeFollower(username) {
            var that = this;
            this.showSpinner = true;
            this.context.removeFollower(username)
                .thenApply(function(success) {
                    that.showSpinner = false;
		    that.$toast(`Removed follower ${username}`)
		    that.updateSocial();
                });
        },

        unfollow(username) {
            var that = this;
            this.showSpinner = true;
            this.context.unfollow(username)
                .thenApply(function(success) {
		    that.showSpinner = false;
		    that.$toast(`Stopped following ${username}`)
		    that.updateSocial();
                });
        },

        close () {
            this.$emit("hide-social");
        }
    },

}
</script>

<style>
.social-view main{
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-height: 100vh;
    padding: var(--app-margin);
}

</style>
