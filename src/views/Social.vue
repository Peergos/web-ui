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
		<Spinner v-if="showSpinner" :message="spinnerMessage"></Spinner>
		<Choice
			v-if="showChoice"
			v-on:hide-choice="showChoice = false"
			:choice_message="choice_message"
			:choice_body="choice_body"
			:choice_consumer_func="choice_consumer_func"
			:choice_options="choice_options">
		</Choice>
		<Prompt
			v-if="showPrompt"
			v-on:hide-prompt="showPrompt = false"
			:prompt_message="prompt_message"
			:placeholder="prompt_placeholder"
			:value="prompt_value"
			:max_input_size="100"
			:consumer_func="prompt_consumer_func">
		</Prompt>
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

            <div class="social-groups">
                <h3>{{ translate("GROUPS.TITLE") }}</h3>
                <p class="social-groups__hint">{{ translate("GROUPS.BUILTIN") }}</p>
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

                <div v-for="uid in customGroupUids" :key="uid" class="social-group">
                    <div class="flex-container" style="justify-content:space-between; max-width:700px;">
                        <div style="font-size:1.5em;">
                            {{ socialData.groupsUidToName[uid] }}
                            <span class="social-group__count">{{ memberCountLabel(uid) }}</span>
                        </div>
                        <div class="flex-container" style="justify-content:space-evenly;">
                            <div class="hspace-5">
                                <button type="button" class="pg-btn" @click="toggleAddMember(uid)">{{ translate("GROUPS.ADD") }}</button>
                            </div>
                            <div class="hspace-5">
                                <button type="button" class="pg-btn" @click="renameGroup(uid)">{{ translate("GROUPS.RENAME") }}</button>
                            </div>
                            <div class="hspace-5">
                                <button type="button" class="pg-btn pg-btn--danger" @click="deleteGroup(uid)">{{ translate("GROUPS.DELETE") }}</button>
                            </div>
                        </div>
                    </div>
                    <div class="social-group__members">
                        <span v-for="member in (groupMembers[uid] || [])" :key="member" class="social-group__member">
                            {{ member }}
                            <button type="button" class="social-group__remove" :aria-label="translate('GROUPS.REMOVE')" :title="translate('GROUPS.REMOVE')" @click="removeMember(uid, member)">&times;</button>
                        </span>
                    </div>
                    <div v-if="addingTo == uid" class="social-invite">
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
const Choice = require("../components/choice/Choice.vue");
const Prompt = require("../components/prompt/Prompt.vue");
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
		Prompt,
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
            prompt_placeholder: "",
            prompt_value: "",
            prompt_consumer_func: () => {}
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
            this.prompt_message = this.translate("GROUPS.RENAME.TITLE").replace("$NAME", current);
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

.social-groups {
	align-self: stretch;
	max-width: 700px;
}

.social-groups__hint,
.social-group__count {
	opacity: 0.7;
}

.social-groups__create {
	flex-wrap: wrap;
	max-width: none;
}

.social-groups__name {
	flex: 0 1 200px;
	min-width: 0;
}

.social-group {
	margin-bottom: var(--app-margin);
}

.social-group__members {
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
	margin: 6px 0;
}

.social-group__member {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	padding: 2px 4px 2px 10px;
	border-radius: 12px;
	border: 1px solid var(--border-color, currentColor);
}

.social-group__remove {
	border: none;
	background: none;
	color: inherit;
	cursor: pointer;
	font-size: 1.1em;
	line-height: 1;
	padding: 0 4px;
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
