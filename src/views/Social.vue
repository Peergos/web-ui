<template>
   	<article class="app-view pg-view social-view">
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
		<Spinner v-if="showSpinner" :message="spinnerMessage"></Spinner>
		<Choice
			v-if="showChoice"
			v-on:hide-choice="showChoice = false"
			:choice_message="choice_message"
			:choice_body="choice_body"
			:choice_consumer_func="choice_consumer_func"
			:choice_options="choice_options">
		</Choice>
		<AppPrompt
			v-if="showPrompt"
			v-on:hide-prompt="showPrompt = false"
			:message="prompt_message"
			:name="prompt_name"
			:placeholder="prompt_placeholder"
			:value="prompt_value"
			:max_input_size="100"
			:consumer_func="prompt_consumer_func"
			:action="prompt_action"
		/>
		<ViewProfile
                    v-if="showProfileViewForm"
                    v-on:hide-profile-view="showProfileViewForm = false"
                    :profile="profile">
                </ViewProfile>

		<section class="pg-card social-send">
			<h2>{{ translate("SOCIAL.SEND.TITLE") }}</h2>
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

		<section v-if="nobody" class="pg-empty">
			<span class="pg-empty__mark" aria-hidden="true">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
			</span>
			<h2>{{ translate("SOCIAL.EMPTY.TITLE") }}</h2>
			<p>{{ translate("SOCIAL.EMPTY.BODY") }}</p>
		</section>

		<section v-if="! nobody" class="social-section">
			<div class="pg-sectionhead">
				<h2>{{ translate("SOCIAL.INCOMING") }}</h2>
				<span>{{ socialData.pending.length }}</span>
			</div>
			<ul v-if="socialData.pending.length > 0" id="follow-request-table-id" class="social-people">
				<li v-for="req in socialData.pending" class="social-person">
					<span class="social-person__initial" aria-hidden="true">{{ initialOf(req.getEntry().ownerName) }}</span>
					<span class="social-person__name" :title="req.getEntry().ownerName">{{ req.getEntry().ownerName }}</span>
					<span class="social-person__actions">
						<button type="button" class="pg-btn pg-btn--primary" @click="acceptAndReciprocate(req)">{{ translate("SOCIAL.ALLOWANDFOLLOW") }}</button>
						<button type="button" class="pg-btn" @click="accept(req)">{{ translate("SOCIAL.ALLOW") }}</button>
						<button type="button" class="pg-btn pg-btn--danger" @click="reject(req)">{{ translate("SOCIAL.DENY") }}</button>
						<button type="button" class="pg-btn pg-btn--danger" @click="block(req.getEntry().ownerName)">{{ translate("SOCIAL.BLOCK") }}</button>
					</span>
				</li>
			</ul>
		</section>

		<section v-if="! nobody" class="social-section">
			<div class="pg-sectionhead">
				<h2>{{ translate("SOCIAL.FRIENDS") }}</h2>
				<span>{{ socialData.friends.length }}</span>
			</div>
			<ul v-if="socialData.friends.length > 0" id="friend-table-id" class="social-people">
				<li v-for="username in socialData.friends" class="social-person">
					<span class="social-person__initial" aria-hidden="true">{{ initialOf(username) }}</span>
					<span class="social-person__name">
						<button type="button" class="social-person__link" :title="username" @click="displayProfile(username)">{{ username }}</button>
						<span v-if="isVerified(username)" class="pg-pill pg-tone--ok social-person__verified">
							<span class="pg-pill__dot" aria-hidden="true"></span>{{ translate("VERIFY.VERIFIED") }}
						</span>
					</span>
					<span class="social-person__actions">
						<button type="button" class="pg-btn pg-btn--danger" @click="unfollow(username)">{{ translate("SOCIAL.UNFOLLOW") }}</button>
						<button type="button" class="pg-btn pg-btn--danger" @click="removeFollower(username)">{{ translate("SOCIAL.REMOVE") }}</button>
						<button type="button" class="pg-btn pg-btn--danger" @click="block(username)">{{ translate("SOCIAL.BLOCK") }}</button>
						<button type="button" class="pg-btn" @click="showFingerPrint(username)">{{ translate("SOCIAL.VERIFICATION") }}</button>
					</span>
				</li>
			</ul>
		</section>

		<section v-if="! nobody" class="social-section">
			<div class="pg-sectionhead">
				<h2>{{ translate("SOCIAL.FOLLOWERS") }}</h2>
				<span>{{ socialData.followers.length }}</span>
			</div>
			<ul v-if="socialData.followers.length > 0" id="follower-table-id" class="social-people">
				<li v-for="username in socialData.followers" class="social-person">
					<span class="social-person__initial" aria-hidden="true">{{ initialOf(username) }}</span>
					<span class="social-person__name" :title="username">{{ username }}</span>
					<span class="social-person__actions">
						<button type="button" class="pg-btn pg-btn--danger" @click="removeFollower(username)">{{ translate("SOCIAL.REMOVE") }}</button>
						<button type="button" class="pg-btn pg-btn--danger" @click="block(username)">{{ translate("SOCIAL.BLOCK") }}</button>
					</span>
				</li>
			</ul>
		</section>

		<section class="social-section social-groups">
			<div class="pg-sectionhead">
				<h2>{{ translate("GROUPS.TITLE") }}</h2>
				<span>{{ customGroupUids.length }}</span>
			</div>
			<p class="pg-note social-groups__hint">{{ translate("GROUPS.BUILTIN") }}</p>
			<div class="pg-card social-groups__card">
				<div class="social-invite social-groups__create">
					<input
						class="social-groups__name pg-input"
						type="text"
						maxlength="100"
						v-model="newGroupName"
						:placeholder="translate('GROUPS.NAME')"
						v-on:keyup.enter="createGroup()"
					/>
					<FormAutocomplete
						class="social-invite__field"
						is-multiple
						v-model="newGroupMembers"
						:minchars="0"
						:options="allFollowers"
						:maxitems="100"
						:placeholder="translate('GROUPS.MEMBERS.PICK')"
					/>
					<button type="button" class="pg-btn pg-btn--primary" :disabled="newGroupName.trim().length == 0" @click="createGroup()">
						{{ translate("GROUPS.CREATE") }}
					</button>
				</div>
			</div>
			<ul v-if="customGroupUids.length > 0" class="social-people">
				<li v-for="uid in customGroupUids" :key="uid" class="social-group">
					<div class="social-group__head">
						<span class="social-person__initial" aria-hidden="true">{{ initialOf(socialData.groupsUidToName[uid]) }}</span>
						<span class="social-person__name">
							<span class="social-group__name pg-clamp" :class="{'pg-clamp--open': expandedGroups[uid]}"
								:title="socialData.groupsUidToName[uid]" @click="toggleGroupName(uid)">{{ socialData.groupsUidToName[uid] }}</span>
							<span class="social-group__count">{{ memberCountLabel(uid) }}</span>
						</span>
						<span class="social-person__actions">
							<button type="button" class="pg-btn" @click="toggleAddMember(uid)">{{ translate("GROUPS.ADD") }}</button>
							<button type="button" class="pg-btn" @click="renameGroup(uid)">{{ translate("GROUPS.RENAME") }}</button>
							<button type="button" class="pg-btn pg-btn--danger" @click="deleteGroup(uid)">{{ translate("GROUPS.DELETE") }}</button>
						</span>
					</div>
					<div v-if="(groupMembers[uid] || []).length > 0" class="social-group__members">
						<span v-for="member in (groupMembers[uid] || [])" :key="member" class="social-group__member">
							{{ member }}
							<button type="button" class="social-group__remove" :aria-label="translate('GROUPS.REMOVE')" :title="translate('GROUPS.REMOVE')" @click="removeMember(uid, member)">&times;</button>
						</span>
					</div>
					<div v-if="addingTo == uid" class="social-invite social-group__add">
						<FormAutocomplete
							class="social-invite__field"
							is-multiple
							v-model="membersToAdd"
							:minchars="0"
							:options="nonMembers(uid)"
							:maxitems="100"
							:placeholder="translate('GROUPS.MEMBERS.PICK')"
						/>
						<button type="button" class="pg-btn pg-btn--primary" :disabled="membersToAdd.length == 0" @click="addMembers(uid)">
							{{ translate("GROUPS.ADD") }}
						</button>
					</div>
				</li>
			</ul>
		</section>

		<section v-if="! nobody" class="social-section">
			<div class="pg-sectionhead">
				<h2>{{ translate("SOCIAL.FOLLOWING") }}</h2>
				<span>{{ socialData.following.length }}</span>
			</div>
			<ul v-if="socialData.following.length > 0" class="social-people">
				<li v-for="user in socialData.following" class="social-person">
					<span class="social-person__initial" aria-hidden="true">{{ initialOf(user) }}</span>
					<span class="social-person__name">
						<button type="button" class="social-person__link" :title="user" @click="displayProfile(user)">{{ user }}</button>
					</span>
					<span class="social-person__actions">
						<button type="button" class="pg-btn pg-btn--danger" @click="unfollow(user)">{{ translate("SOCIAL.UNFOLLOW") }}</button>
						<button type="button" class="pg-btn pg-btn--danger" @click="block(user)">{{ translate("SOCIAL.BLOCK") }}</button>
					</span>
				</li>
			</ul>
		</section>

		<section v-if="! nobody" class="social-section">
			<div class="pg-sectionhead">
				<h2>{{ translate("SOCIAL.UNFOLLOWED") }}</h2>
				<span>{{ socialData.unfollowed.length }}</span>
			</div>
			<p class="pg-note">{{ translate("SOCIAL.UNFOLLOWED.HINT") }}</p>
			<ul v-if="socialData.unfollowed.length > 0" class="social-people">
				<li v-for="user in socialData.unfollowed" class="social-person">
					<span class="social-person__initial" aria-hidden="true">{{ initialOf(user) }}</span>
					<span class="social-person__name" :title="user">{{ user }}</span>
					<span class="social-person__actions">
						<button type="button" class="pg-btn" @click="followAgain(user)">{{ translate("SOCIAL.FOLLOW.AGAIN") }}</button>
						<button type="button" class="pg-btn pg-btn--danger" @click="block(user)">{{ translate("SOCIAL.BLOCK") }}</button>
					</span>
				</li>
			</ul>
		</section>

		<section v-if="! nobody" class="social-section">
			<div class="pg-sectionhead">
				<h2>{{ translate("SOCIAL.BLOCKED") }}</h2>
				<span>{{ socialData.blocked.length }}</span>
			</div>
			<p class="pg-note">{{ translate("SOCIAL.BLOCKED.HINT") }}</p>
			<ul v-if="socialData.blocked.length > 0" class="social-people">
				<li v-for="user in socialData.blocked" class="social-person">
					<span class="social-person__initial" aria-hidden="true">{{ initialOf(user) }}</span>
					<span class="social-person__name" :title="user">{{ user }}</span>
					<span class="social-person__actions">
						<button type="button" class="pg-btn" @click="unblock(user)">{{ translate("SOCIAL.UNBLOCK") }}</button>
					</span>
				</li>
			</ul>
		</section>
		</main>
   </article>
</template>

<script>
const AppButton = require("../components/AppButton.vue");
const AppHeader = require("../components/AppHeader.vue");
const Choice = require("../components/choice/Choice.vue");
const AppPrompt = require("../components/prompt/AppPrompt.vue");
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
		Choice,
		AppPrompt,
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
	    friendname: null,
            spinnerMessage: null,
            newGroupName: "",
            newGroupMembers: [],
            groupMembers: {},
            addingTo: null,
            membersToAdd: [],
            showChoice: false,
            choice_message: "",
            choice_body: "",
            choice_options: [],
            choice_consumer_func: () => {},
            showPrompt: false,
            prompt_message: "",
            prompt_name: null,
            prompt_action: "",
            prompt_placeholder: "",
            prompt_value: "",
            prompt_consumer_func: () => {},
            // the lists are empty until the first load, which says nothing about the account
            loaded: false,
            expandedGroups: {}
        }
    },
    props: [],
	mixins:[routerMixins, i18n],

	computed: {
        nobody() {
            const d = this.socialData;
            return this.loaded && d.pending.length + d.friends.length + d.followers.length + d.following.length + d.blocked.length + d.unfollowed.length == 0;
        },
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
        },
        allFollowers() {
            return this.socialData.friends.concat(this.socialData.followers);
        },
        customGroupUids() {
            let builtIn = [peergos.shared.user.SocialState.FRIENDS_GROUP_NAME, peergos.shared.user.SocialState.FOLLOWERS_GROUP_NAME]
                .map(name => this.socialData.groupsNameToUid[name]);
            return this.socialData.groupUids.filter(uid => ! builtIn.includes(uid));
        }
    },
	created() {
	    let that = this;
        this.showSpinner = true;
        this.updateSocial(() => {
            that.showSpinner = false;
            that.loaded = true;
            that.loadGroupMembers();
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
            }).exceptionally(function(throwable) {
                that.failed(throwable);
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
            }).exceptionally(function(throwable) {
                that.failed(throwable);
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
            }).exceptionally(function(throwable) {
                that.failed(throwable);
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
            }).exceptionally(function(throwable) {
                that.failed(throwable);
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
            }).exceptionally(function(throwable) {
                that.failed(throwable);
            });
        },

        // show what went wrong, and the lists as they now are, rather than leave the spinner going
        failed(throwable) {
            let that = this;
            this.$toast.error(throwable.getMessage());
            this.updateSocial(() => {
                that.showSpinner = false;
            });
        },

        followAgain(username) {
            let that = this;
            this.showSpinner = true;
            this.context.followAgain(username).thenApply(function(success) {
                that.updateSocial(() => {
                    that.showSpinner = false;
                    that.$toast(that.translate("SOCIAL.FOLLOWING.AGAIN") + ` ${username}`);
                });
            }).exceptionally(function(throwable) {
                that.failed(throwable);
            });
        },

        block(username) {
            let that = this;
            this.showSpinner = true;
            this.context.block(username).thenApply(function(success) {
                that.updateSocial(() => {
                    that.showSpinner = false;
                    that.$toast(`${username} ` + that.translate("SOCIAL.BLOCKED.DONE"));
                });
            }).exceptionally(function(throwable) {
                that.failed(throwable);
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
            }).exceptionally(function(throwable) {
                that.failed(throwable);
            });
        },

        // title tooltips never fire on touch, so a group name cut short opens on a tap as well
        toggleGroupName(uid) {
            Vue.set(this.expandedGroups, uid, ! this.expandedGroups[uid]);
        },

        // the first letter of a name, for the round mark beside it
        initialOf(name) {
            return name ? name.charAt(0).toUpperCase() : "";
        },

        close () {
            this.$emit("hide-social");
        },

        loadGroupMembers() {
            this.customGroupUids.forEach(uid => this.loadMembers(uid));
        },
        loadMembers(uid) {
            let that = this;
            return this.context.getGroupMembers(uid).thenApply(members => {
                that.$set(that.groupMembers, uid, members.toArray([]));
            });
        },
        memberCountLabel(uid) {
            let members = this.groupMembers[uid];
            if (members == null)
                return "";
            if (members.length == 0)
                return "(" + this.translate("GROUPS.EMPTY") + ")";
            return "(" + members.length + ")";
        },
        nonMembers(uid) {
            let members = this.groupMembers[uid] || [];
            return this.allFollowers.filter(name => ! members.includes(name));
        },
        isDuplicateName(name, exceptUid) {
            return this.customGroupUids.some(uid => uid != exceptUid && this.socialData.groupsUidToName[uid] == name);
        },
        onGroupError(throwable) {
            this.showSpinner = false;
            this.spinnerMessage = null;
            let msg = "" + (throwable.getMessage != null ? throwable.getMessage() : throwable);
            this.$toast.error(msg.replace(/^([\w.$]+(Exception|Error):\s*)+/, "").trim(), {timeout:false, id: 'groups'});
        },
        refreshGroups(message) {
            let that = this;
            this.updateSocial(() => {
                that.loadGroupMembers();
                that.showSpinner = false;
                that.spinnerMessage = null;
                if (message != null)
                    that.$toast(message);
            });
        },
        createGroup() {
            let name = this.newGroupName.trim();
            if (name.length == 0)
                return;
            if (this.isDuplicateName(name, null))
                this.$toast.warning(this.translate("GROUPS.DUPLICATE").replace("$NAME", name));
            let that = this;
            this.showSpinner = true;
            this.context.createGroup(name, peergos.client.JsUtil.asSet(this.newGroupMembers.slice())).thenApply(uid => {
                that.newGroupName = "";
                that.newGroupMembers = [];
                that.refreshGroups(that.translate("GROUPS.CREATED").replace("$NAME", name));
            }).exceptionally(t => that.onGroupError(t));
        },
        toggleAddMember(uid) {
            this.membersToAdd = [];
            this.addingTo = this.addingTo == uid ? null : uid;
        },
        addMembers(uid) {
            let that = this;
            this.showSpinner = true;
            this.context.addGroupMembers(uid, peergos.client.JsUtil.asSet(this.membersToAdd.slice())).thenApply(done => {
                that.addingTo = null;
                that.membersToAdd = [];
                that.refreshGroups(null);
            }).exceptionally(t => that.onGroupError(t));
        },
        renameGroup(uid) {
            let that = this;
            let current = this.socialData.groupsUidToName[uid];
            // the name goes in on its own, so the dialog can cut a long one short, as the drive's rename does
            this.prompt_message = this.translate("GROUPS.RENAME.TITLE").replace("$NAME", "\u201c{n}\u201d");
            this.prompt_name = current;
            this.prompt_action = this.translate("GROUPS.RENAME");
            this.prompt_placeholder = this.translate("GROUPS.NAME");
            this.prompt_value = current;
            this.prompt_consumer_func = (name) => {
                if (name == null || name.trim().length == 0 || name.trim() == current)
                    return;
                name = name.trim();
                if (that.isDuplicateName(name, uid))
                    that.$toast.warning(that.translate("GROUPS.DUPLICATE").replace("$NAME", name));
                that.showSpinner = true;
                that.context.renameGroup(uid, name).thenApply(done => {
                    that.refreshGroups(that.translate("GROUPS.RENAMED"));
                }).exceptionally(t => that.onGroupError(t));
            };
            this.showPrompt = true;
        },
        removeMember(uid, member) {
            let that = this;
            let name = this.socialData.groupsUidToName[uid];
            this.choice_message = this.translate("GROUPS.REMOVE.TITLE").replace("$USER", member).replace("$NAME", name);
            this.choice_body = this.translate("GROUPS.REMOVE.BODY").replace("$USER", member);
            this.choice_options = [this.translate("GROUPS.REMOVE.KEEP"), this.translate("GROUPS.REMOVE.REVOKE")];
            this.choice_consumer_func = (index) => {
                that.showSpinner = true;
                that.context.removeGroupMember(uid, member, index == 1).thenApply(done => {
                    that.refreshGroups(that.translate("GROUPS.REMOVED").replace("$USER", member));
                }).exceptionally(t => that.onGroupError(t));
            };
            this.showChoice = true;
        },
        deleteGroup(uid) {
            let that = this;
            let name = this.socialData.groupsUidToName[uid];
            this.showSpinner = true;
            this.context.countSharedWithGroup(uid).thenApply(count => {
                that.showSpinner = false;
                that.choice_message = that.translate("GROUPS.DELETE.TITLE").replace("$NAME", name);
                that.choice_body = that.translate("GROUPS.DELETE.BODY").replace("$COUNT", count);
                that.choice_options = [that.translate("GROUPS.DELETE.KEEP"), that.translate("GROUPS.DELETE.REVOKE").replace("$COUNT", count)];
                that.choice_consumer_func = (index) => {
                    let revoke = index == 1;
                    let done = 0;
                    that.spinnerMessage = revoke ? that.translate("GROUPS.DELETE.PROGRESS").replace("$DONE", 0).replace("$COUNT", count) : null;
                    that.showSpinner = true;
                    that.context.deleteGroup(uid, revoke, x => {
                        done++;
                        that.spinnerMessage = that.translate("GROUPS.DELETE.PROGRESS").replace("$DONE", done).replace("$COUNT", count);
                    }).thenApply(res => {
                        that.refreshGroups(that.translate("GROUPS.DELETED").replace("$NAME", name));
                    }).exceptionally(t => that.onGroupError(t));
                };
                that.showChoice = true;
            }).exceptionally(t => that.onGroupError(t));
        }
    },

}
</script>

<style>
/* The people you follow and who follow you, on the surfaces the sync and mount views use:
   the page is .pg-view, each list a .pg-sectionhead over rows in a card, the actions
   .pg-btn. Only the look changes - every action is the one this view always had. */

/* the headings of the lists and the cards; the empty state keeps the size it has in
   every other view */
.social-view .pg-sectionhead h2,
.social-view .pg-card h2 {
	font-size: 15px;
}

.social-send {
	gap: 12px;
}

/* the field and the action that sends it belong on one line, with the field taking the
   room: stacked, with the component's own bottom margin between them, they read as two
   unrelated controls */
.social-invite {
	display: flex;
	/* the action takes the field's height, whatever the field's own line height makes it */
	align-items: stretch;
	gap: 10px;
	max-width: 560px;
}

.social-invite__field {
	flex: 1 1 auto;
	min-width: 0;
	margin-bottom: 0;
}

.social-section {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

/* the rows of one list share a card, parted by hairlines, as a list does in the drive */
.social-people {
	margin: 0;
	padding: 0;
	list-style: none;
	background-color: var(--bg);
	border: 1px solid var(--border-color);
	border-radius: var(--radius-container);
	box-shadow: var(--pg-shadow);
}

.social-person {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 12px;
	padding: 12px 16px;
}

.social-person + .social-person {
	border-top: 1px solid var(--border-color);
}

.social-person__initial {
	display: flex;
	align-items: center;
	justify-content: center;
	flex: none;
	width: 36px;
	height: 36px;
	border-radius: 50%;
	font-weight: var(--bold);
	color: var(--pg-on-ok);
	background-color: var(--pg-tint-ok);
}

.social-person__name {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 8px;
	flex: 1 1 160px;
	min-width: 0;
	font-size: 15px;
	overflow-wrap: anywhere;
}

/* a name that opens the profile: a link to look at, a button to the keyboard. Its box is
   the height of a tap target, and gives the extra back so the row keeps its height */
.social-person__link {
	display: inline-flex;
	align-items: center;
	min-height: 40px;
	padding: 0;
	margin: -10px 0;
	border: 0;
	background: none;
	font: inherit;
	color: var(--pg-link);
	text-align: left;
	overflow-wrap: anywhere;
	cursor: pointer;
}

/* hover only where something can hover: on a touch screen it sticks after the tap */
@media (hover: hover) {
	.social-person__link:hover {
		text-decoration: underline;
	}

	.social-group__remove:hover {
		background-color: var(--pg-surface-2);
		color: var(--color);
	}
}

.social-person__link:focus-visible,
.social-group__remove:focus-visible {
	outline: 2px solid var(--green-500);
	outline-offset: 2px;
	border-radius: var(--radius-control);
}

/* a long group name takes two lines, and the rest on a tap, as sync's long values do */
.social-group__name {
	overflow-wrap: anywhere;
}

.social-group__name:not(.pg-clamp--open) {
	-webkit-line-clamp: 2;
}

.social-person__verified {
	padding: 3px 10px;
	font-size: var(--text-mini);
}

.social-person__actions {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	margin-left: auto;
}

/* no margin carried in from a page-wide button rule: the row spaces them with its gap */
.social-person__actions .pg-btn {
	margin: 0;
}

/* a group is a row like a person's, with its members as chips under it */
.social-group + .social-group {
	border-top: 1px solid var(--border-color);
}

.social-group__head {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 12px;
	padding: 12px 16px;
}

.social-group__count {
	color: var(--pg-muted);
	font-size: var(--text-small);
}

.social-group__members {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	padding: 0 16px 12px 64px;
}

.social-group__member {
	display: inline-flex;
	align-items: center;
	gap: 2px;
	padding: 2px 2px 2px 10px;
	font-size: var(--text-small);
	border: 1px solid var(--border-color);
	border-radius: var(--radius-pill);
}

.social-group__remove {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	margin: 0;
	padding: 0;
	border: 0;
	border-radius: 50%;
	background: none;
	color: var(--pg-muted);
	font-size: 16px;
	line-height: 1;
	cursor: pointer;
}

/* a finger needs more than the pointer does */
@media (pointer: coarse) {
	.social-group__member {
		padding-top: 0;
		padding-bottom: 0;
	}

	.social-group__remove {
		width: 40px;
		height: 40px;
	}
}

.social-group__add {
	padding: 0 16px 12px 64px;
}

/* the group's name, then who is in it, then the button: on a wide screen one line */
.social-groups__create {
	flex-wrap: wrap;
	max-width: none;
}

.social-groups__name {
	flex: 0 1 200px;
	min-width: 0;
}

/* on a phone the actions go under the name, sharing the row between them */
@media (max-width: 600px) {
	.social-invite {
		flex-direction: column;
	}

	.social-person__actions {
		flex-basis: 100%;
		margin-left: 0;
	}

	/* each takes the width its label needs and the row grows them to fill it: an even
	   split would squeeze "Allow and follow back" into four lines beside "Deny". A label
	   wider than the row, as some translations are, wraps inside its button */
	.social-person__actions .pg-btn {
		flex: 1 0 auto;
		max-width: 100%;
	}

	.social-group__members,
	.social-group__add {
		padding-left: 16px;
	}

	.social-groups__name {
		flex-basis: 100%;
	}
}
</style>
