<template>
   <main class="app-social">
       <fingerprint v-if="showFingerprint"
		   v-on:hide-fingerprint="hideFingerprint"
		   :fingerprint="fingerprint"
		   :friendname="friendname"
		   :initialIsVerified="initialIsVerified"
		   :context="context">
       </fingerprint>
       <center><h2>Social</h2></center>
       <spinner v-if="showSpinner"></spinner>
            <div>
                <div class="flex-container">
                  <div class="hspace-5"><h3>Send follow request:</h3></div>
		  <div class="flex-container" style="align-self: center;">
                    <div class="flex-grow flex-container hspace-5">
                      <input id="friend-name-input" v-model="targetUsername" type="text" class="token-input flex-grow" style="min-width:100px; max-width: 300px;" ></input>
                    </div>
                    <div class="hspace-5" style="text-align:right">
		      <button id='send-follow-request-id' class="btn btn-success" @click="sendInitialFollowRequest()">Send</button>
		    </div>
		  </div>
                </div>
            </div>

            <div>
                <h3>Incoming follow requests</h3>
                <div id='follow-request-table-id' class="flex-container table" style="flex-flow:column;">
                  <div v-for="req in data.pending" class="flex-container vspace-5" style="justify-content:space-between; max-width:700px;">
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
                  <div v-for="username in data.friends" class="flex-container vspace-5" style="justify-content:space-between; max-width:700px;">
                    <div id='friend-id' style="font-size:1.5em;">
                        <a v-on:click="profile(username)" style="cursor: pointer">{{ username }}</a>
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
		  <div v-for="username in data.followers" class="flex-container vspace-5" style="justify-content:space-between; max-width:700px;">
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
                  <tr v-for="user in data.following" class="flex-container vspace-5" style="justify-content:space-between; max-width:700px;">
                    <div style="font-size:1.5em;">
                        <a v-on:click="profile(user)" style="cursor: pointer">{{ user }}</a>
		    </div>
                    <div>
		      <button class="btn btn-danger" @click="unfollow(user)">Unfollow</button>
		    </div>
                  </tr>
		</div>
            </div>
   </main>
</template>

<script>
module.exports = {
    data: function() {
        return {
            targetUsername: "",
            targetUsernames: [],
            data:{
                pending: [],
                friends: [],
                followers: [],
                following: [],
                groupsNameToUid: [],
                groupsUidToName: [],
            },
            showSpinner: false,
			showFingerprint: false,
			initialIsVerified: false,
			fingerprint: null,
			friendname: null
        }
    },
    props: ['externalchange', 'messages', 'displayProfile'],

	computed: {
		...Vuex.mapState([
			'context'
		]),
        usernames: function() {
            return this.context.network.usernames.toArray([]);
        }
    },
	created: function() {
        // this.context = this.$store.state.context;
        // TODO store data in vuex?
        this.updateSocial();
        Vue.nextTick(this.setTypeAhead);
    },
    methods: {
    updateSocial: function(callbackFunc) {
	    var context = this.context;
            if (context == null || context.username == null)
                this.data = {
                    pending: [],
		    friends: [],
                    followers: [],
                    following: [],
		    pendingOutgoing: [],
		    annotations: {},
		    groupsNameToUid: {},
		    groupsUidToName: {}
                };
	    else {
		    var that = this;
            context.getSocialState().thenApply(function(socialState){
		    var annotations = {};
		    socialState.friendAnnotations.keySet().toArray([]).map(name => annotations[name]=socialState.friendAnnotations.get(name));
		    var followerNames = socialState.followerRoots.keySet().toArray([]);
		    var followeeNames = socialState.followingRoots.toArray([]).map(function(f){return f.getFileProperties().name});
		    var friendNames = followerNames.filter(x => followeeNames.includes(x));
		    followerNames = followerNames.filter(x => !friendNames.includes(x));
		    followeeNames = followeeNames.filter(x => !friendNames.includes(x));

		    var groupsUidToName = {};
		    socialState.uidToGroupName.keySet().toArray([]).map(uid => groupsUidToName[uid]=socialState.uidToGroupName.get(uid));
		    var groupsNameToUid = {};
		    socialState.groupNameToUid.keySet().toArray([]).map(name => groupsNameToUid[name]=socialState.groupNameToUid.get(name));

		    var pendingOutgoingUsernames = [];
		    socialState.pendingOutgoing.toArray([]).map(u => pendingOutgoingUsernames.push(u));

		    that.data = {
		                pendingOutgoing: pendingOutgoingUsernames,
                        pending: socialState.pendingIncoming.toArray([]),
			friends: friendNames,
                        followers: followerNames,
                        following: followeeNames,
			annotations: annotations,
			    groupsNameToUid: groupsNameToUid,
			    groupsUidToName: groupsUidToName
		    };
                }).exceptionally(function(throwable) {
		    that.errorTitle = 'Error retrieving social state';
		    that.errorBody = throwable.getMessage();
		    that.showError = true;
		    that.showSpinner = false;
		});
	    }
    },
    profile: function(username) {
        this.displayProfile(username, false);
    },
    setTypeAhead: function() {

        var usernames = this.usernames;
        // remove our username
        usernames.splice(usernames.indexOf(this.context.username), 1);

        this.data.friends.forEach(function(name){
            usernames.splice(usernames.indexOf(name), 1);
        });
        var engine = new Bloodhound({
          datumTokenizer: Bloodhound.tokenizers.whitespace,
          queryTokenizer: Bloodhound.tokenizers.whitespace,
          local: usernames
        });

        engine.initialize();

        $('#friend-name-input').tokenfield({
            minLength: 1,
            minWidth: 1,
            typeahead: [{hint: true, highlight: true, minLength: 1}, { source: suggestions }]
        });

        function suggestions(q, sync, async) {
            var matches, substringRegex;
            matches = [];
            substrRegex = new RegExp(q, 'i');
            $.each(usernames, function(i, str) {
                if (substrRegex.test(str)) {
                    matches.push(str);
                }
            });
            sync(matches);
        }

        $('#friend-name-input').on('tokenfield:createtoken', function (event) {
            //only select from available items
        	var available_tokens = usernames;
        	var exists = true;
        	$.each(available_tokens, function(index, token) {
        		if (token === event.attrs.value)
        			exists = false;
        	});
        	if(exists === true) {
        		event.preventDefault();
            } else {
                //do not allow duplicates in selection
                var existingTokens = $(this).tokenfield('getTokens');
                $.each(existingTokens, function(index, token) {
                    if (token.value === event.attrs.value)
                        event.preventDefault();
                });
            }
        });
        let that = this;
        $('#friend-name-input').on('tokenfield:createdtoken', function (event) {
    	    that.targetUsernames.push(event.attrs.value);
        });

        $('#friend-name-input').on('tokenfield:removedtoken', function (event) {
    	    that.targetUsernames.pop(event.attrs.value);
        });
    },
    resetTypeahead: function() {
        this.targetUsernames = [];
        this.targetUsername = "";
        $('#friend-name-input').tokenfield('setTokens', []);
    },
        showMessage: function(title, body) {
            this.messages.push({
                title: title,
                body: body,
                show: true
            });
        },

	isVerified: function(username) {
	    var annotations = this.data.annotations[username]
	    if (annotations == null)
		return false;
	    return annotations.isVerified();
	},

	hideFingerprint: function(isVerified) {
	    this.showFingerprint = false;
	    this.data.annotations[this.friendname] = new peergos.shared.user.FriendAnnotation(this.friendname, isVerified, this.fingerprint.left)
	},

	showFingerPrint: function(friendname) {
	    var that = this;
	    this.context.generateFingerPrint(friendname).thenApply(function(f) {
		that.fingerprint = f;
		that.friendname = friendname;
		that.initialIsVerified = that.isVerified(friendname);
		that.showFingerprint = true;
	    })
	},

	sendInitialFollowRequest: function() {
	        let that = this;
	        if (this.targetUsernames.length == 0) {
    	        let singleVal = document.getElementById("friend-name-input-tokenfield").value.trim();
    	        if (singleVal.length > 0 && singleVal != this.context.username) {
            	    this.targetUsernames.push(singleVal);
    	        } else {
	                return;
	            }
	        }
            this.data.pendingOutgoing.forEach(function(name){
                let idx = that.targetUsernames.indexOf(name);
                if (idx > -1) {
                    that.targetUsernames.splice(idx, 1);
                }
            });
	        if (this.targetUsernames.length == 0) {
                that.showMessage("Follow request already sent!", "");
                return;
	        }
            console.log("sending follow request");
            that.showSpinner = true;
            that.context.sendInitialFollowRequests(this.targetUsernames)
                .thenApply(function(success) {
                    if(success) {
                        that.showMessage("Follow request(s) sent!", "");
                        that.resetTypeahead();
                        that.$emit("external-change");
                    } else {
                        that.showMessage("Follow request(s) failed!", "");
                        that.resetTypeahead();
                    }
                    that.showSpinner = false;
            }).exceptionally(function(throwable) {
                    if (that.targetUsernames.length == 1) {
                        that.resetTypeahead();
                    }
                    that.showMessage(throwable.getMessage());
                    that.showSpinner = false;
            });
        },

        acceptAndReciprocate: function(req) {
            var that = this;
            this.showSpinner = true;
            this.context.sendReplyFollowRequest(req, true, true)
                .thenApply(function(success) {
                    that.showMessage("Follow request reciprocated!", "");
                    that.showSpinner = false;
                    that.$emit("external-change");
                });
        },

        accept: function(req) {
            var that = this;
            this.showSpinner = true;
            this.context.sendReplyFollowRequest(req, true, false)
                .thenApply(function(success) {
                    that.showMessage("Follow request accepted!", "");
                    that.showSpinner = false;
                    that.$emit("external-change");
                });
        },

        reject: function(req) {
            var that = this;
            this.showSpinner = true;
            this.context.sendReplyFollowRequest(req, false, false)
                .thenApply(function(success) {
                    that.showMessage("Follow request rejected!", "");
                    that.showSpinner = false;
                    that.$emit("external-change");
                });
        },

        removeFollower: function(username) {
            var that = this;
            this.showSpinner = true;
            this.context.removeFollower(username)
                .thenApply(function(success) {
                    that.showMessage("Removed follower " + username, "");
                    that.showSpinner = false;
                    that.$emit("external-change");
                });
        },

        unfollow: function(username) {
            var that = this;
            this.showSpinner = true;
            this.context.unfollow(username)
                .thenApply(function(success) {
                    that.showMessage("Stopped following " + username, "");
                    that.showSpinner = false;
                    that.$emit("external-change");
                });
        },

        close: function () {
            this.$emit("hide-social");
        }
    },

}
</script>

<style>
.app-social{
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-height: 100vh;
}
.app-temp h1{
    text-align: center;
}
</style>
