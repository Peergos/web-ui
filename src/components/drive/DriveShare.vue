<template>
	<transition name="modal">
		<div class="modal-mask" @click="close">
			<div class="drive-share modal-container full-height" @click.stop style="overflow-y:auto; max-width:1000px;">
				<span @click="close" tabindex="0" v-on:keyup.enter="close" aria-label="close" class="close">&times;</span>
				<spinner v-if="showSpinner"></spinner>
				<div class="modal-header">
					<h4>Enter user to share {{ displayName }} with:</h4>
				</div>

				<div class="modal-body">
					<div class="container">
					<div class="flex-container">
						<div style="flex-grow:1; max-width:300px;">
							<input id="friend-name-input" v-model="targetUsername" type="text" class="token-input"></input>
						</div>
						<div style="padding:5px; display:flex;">
				<div class="hspace-5">
							<input v-if="this.allowReadWriteSharing" type="radio" id="read-access" value="Read" v-model="sharedWithAccess">
							<label v-if="this.allowReadWriteSharing" for="read-access" style="font-weight: normal;">Read Only</label>
				</div>
				<div class="hspace-5">
							<input v-if="this.allowReadWriteSharing && this.files[0].getOwnerName() == this.context.username" type="radio" id="edit-access" value="Edit" v-model="sharedWithAccess">
							<label v-if="this.allowReadWriteSharing && this.files[0].getOwnerName() == this.context.username" for="edit-access" style="font-weight: normal;">Read &amp; Write</label>
				</div>
						<button :disabled="this.targetUsernames.slice().length == 0 && !this.shareWithFriendsGroup &&  !this.shareWithFollowersGroup" class="btn btn-success" @click="shareWith()">Share</button>
						</div>
					</div>
					</div>
					<div class="flex-container">
						<div class="hspace-15">
							<label style="font-weight: normal;">Or Group(s):</label>
						</div>
						<div class="hspace-15">
							<input type="checkbox" id="friends-option" @change="onFriendChange()" v-model="shareWithFriendsGroup">
							<label for="friends-option" style="font-weight: normal;">Friends</label>
						</div>
						<div class="hspace-15">
							<input type="checkbox" id="followers-option" @change="onFollowerChange()" v-model="shareWithFollowersGroup">
							<label for="followers-option" style="font-weight: normal;">Followers (Includes Friends)</label>
						</div>
					</div>
					<div v-if="this.allowReadWriteSharing" class="modal-body modal-prominent">
						<div class="container" v-if="data.edit_shared_with_users.length > 0"><p style="word-wrap;break-all;">
							Read and Write Access:</p>
							<div v-if="this.files[0].getOwnerName() == this.context.username">
								<div v-for="user in filterEditSharedWithUsers()">
									<input type="checkbox" v-bind:id="user" v-bind:value="user" v-model="unsharedEditAccessNames">&nbsp;<span>{{ getUserOrGroupName(user) }}</span>
								</div>
								<button :disabled="this.unsharedEditAccessNames.length == 0" class="btn btn-success" v-on:click="unshare('Edit')">Revoke</button>
							</div>
							<div v-if="this.files[0].getOwnerName() != this.context.username">
								<div v-for="user in filterEditSharedWithUsers()">
									{{ getUserOrGroupName(user) }}
								</div>
							</div>
						</div>
						<div class="container" v-if="data.edit_shared_with_users.length == 0"><p style="word-wrap;break-all;">
							Read and Write Write Access:    None</p>
						</div>
					</div>
					<div class="modal-body modal-prominent">
						<div class="container" v-if="data.read_shared_with_users.length > 0"><p style="word-wrap;break-all;">
							Read only Access:</p>
							<div v-if="this.files[0].getOwnerName() == this.context.username">
								<div v-for="user in filterReadSharedWithUsers()">
									<input type="checkbox" v-bind:id="user" v-bind:value="user" v-model="unsharedReadAccessNames">&nbsp;<span>{{ getUserOrGroupName(user) }}</span>
								</div>
								<button :disabled="this.unsharedReadAccessNames.length == 0" class="btn btn-success" v-on:click="unshare('Read')">Revoke</button>
							</div>
							<div v-if="this.files[0].getOwnerName() != this.context.username">
								<div v-for="user in filterReadSharedWithUsers()">
									{{ getUserOrGroupName(user) }}
								</div>
							</div>
						</div>
						<div class="container" v-if="data.read_shared_with_users.length == 0"><p style="word-wrap;break-all;">
							Read only Access:    None</p>
						</div>
					</div>
					<div v-if="this.allowCreateSecretLink" class="modal-body modal-prominent">
						<div class="container">
							<button class="btn btn-success" @click="createSecretLink()">Create secret Link</button>
						</div>
					</div>
					<error
							v-if="showError"
							v-on:hide-error="showError = false"
							:title="errorTitle"
							:body="errorBody">
					</error>
					<modal
							v-if="showModal"
							v-on:hide-modal="showModal = false"
							:title="modalTitle"
							:links="modalLinks">
					</modal>
				</div>
			</div>
		</div>
	</transition>
</template>

<script>
module.exports = {
	data() {
		return {
			showSpinner: false,
			targetUsername: "",
			targetUsernames: [],
			sharedWithAccess: "Read",
			shareWithFriendsGroup: false,
			shareWithFollowersGroup: false,
			errorTitle: "",
			errorBody: "",
			showError: false,
			unsharedReadAccessNames: [],
			unsharedEditAccessNames: [],
			showModal: false,
			modalTitle: "",
			modalLinks: [],
		};
	},
	props: [
		"data",
		"friendnames",
		"followernames",
		"groups",
		"files",
		"path",
		"context",
		"messages",
		"fromApp",
		"displayName",
		"allowReadWriteSharing",
		"allowCreateSecretLink",
	],
	created() {
		Vue.nextTick(this.setTypeAhead);
	},
	methods: {
		close(){
			this.showSpinner = false;
			this.$emit("hide-share-with");
		},
		refresh(){
			if (!this.fromApp) {
				this.$emit("update-shared-refresh");
			}
		},
		showMessage(title, body) {
			if (!this.fromApp) {
				this.messages.push({
					title: title,
					body: body,
					show: true,
				});
			}
		},
		createSecretLink(){
			if (this.files.length == 0) return this.close();
			if (this.files.length != 1)
				throw "Unimplemented multiple file share call";

			let file = this.files[0];
			var links = [];
			let props = file.getFileProperties();
			var name = this.displayName;
			let isFile = !props.isDirectory;
			links.push({
				fileLink: file.toLink(),
				name: name,
				id: "secret_link_" + name,
				isFile: isFile,
			});
			var title =
				links.length > 1
					? "Secret links to files: "
					: "Secret link to file: ";
			this.showLinkModal(title, links);
		},

		showLinkModal(title, links) {
			this.showModal = true;
			this.modalTitle = title;
			this.modalLinks = links;
		},
		onFriendChange(){
			if (this.shareWithFollowersGroup && this.shareWithFriendsGroup) {
				this.shareWithFollowersGroup = false;
			}
		},
		onFollowerChange(){
			if (this.shareWithFollowersGroup && this.shareWithFriendsGroup) {
				this.shareWithFriendsGroup = false;
			}
		},
		unshare(sharedWithAccess) {
			if (this.files.length == 0) return this.close();
			if (this.files.length != 1)
				throw "Unimplemented multiple file share call";

			var that = this;
			this.showSpinner = true;
			let filePath = peergos.client.PathUtils.toPath(
				this.path,
				this.files[0].getFileProperties().name
			);
			this.context
				.sharedWith(filePath)
				.thenApply(function (fileSharedWithState) {
					let read_usernames = fileSharedWithState.readAccess.toArray(
						[]
					);
					let edit_usernames =
						fileSharedWithState.writeAccess.toArray([]);
					that.unshareFileWith(
						read_usernames,
						edit_usernames,
						sharedWithAccess
					);
				})
				.exceptionally(function (throwable) {
					that.resetTypeahead();
					that.showSpinner = false;
					that.errorTitle =
						"Error sharing file: " +
						that.files[0].getFileProperties().name;
					that.errorBody = throwable.getMessage();
					that.showError = true;
				});
		},
		unshareFileWith(
			read_usernames,
			edit_usernames,
			sharedWithAccess
		) {
			var that = this;
			var filename = this.files[0].getFileProperties().name;
			let filePath = peergos.client.PathUtils.toPath(this.path, filename);
			if (sharedWithAccess == "Read") {
				this.context
					.unShareReadAccessWith(
						filePath,
						peergos.client.JsUtil.asSet(
							this.unsharedReadAccessNames
						)
					)
					.thenApply(function (b) {
						that.showSpinner = false;
						that.showMessage("Success!", "Read access revoked");
						that.close();
						console.log(
							"unshared read access to " +
								that.files[0].getFileProperties().name +
								" with " +
								that.unsharedReadAccessNames
						);
						that.refresh();
					})
					.exceptionally(function (throwable) {
						that.showSpinner = false;
						that.errorTitle = "Error unsharing file: " + filename;
						that.errorBody = throwable.getMessage();
						that.showError = true;
					});
			} else {
				this.context
					.unShareWriteAccessWith(
						filePath,
						peergos.client.JsUtil.asSet(
							this.unsharedEditAccessNames
						)
					)
					.thenApply(function (b) {
						that.showSpinner = false;
						that.showMessage(
							"Success!",
							"Read & Write access revoked"
						);
						that.close();
						console.log(
							"unshared write access to " +
								that.files[0].getFileProperties().name +
								" with " +
								that.unsharedEditAccessNames
						);
						that.refresh();
					})
					.exceptionally(function (throwable) {
						that.showSpinner = false;
						that.errorTitle = "Error unsharing file: " + filename;
						that.errorBody = throwable.getMessage();
						that.showError = true;
					});
			}
		},
		allowedToShare(file) {
			if (file.isUserRoot()) {
				this.errorTitle = "You cannot share your home directory!";
				this.errorBody = "";
				this.showError = true;
				return false;
			}
			if (
				this.sharedWithAccess == "Edit" &&
				file.getOwnerName() != this.context.username
			) {
				this.errorTitle =
					"Only the owner of a file can grant write access!";
				this.errorBody = "";
				this.showError = true;
				return false;
			}
			return true;
		},
		resetTypeahead(){
			this.targetUsernames = [];
			this.targetUsername = "";
			$("#friend-name-input").tokenfield("setTokens", []);
		},
		shareWith(){
			if (this.files.length == 0) return this.close();
			if (this.files.length != 1)
				throw "Unimplemented multiple file share call";

			if (!this.allowedToShare(this.files[0])) return;
			if (!this.shareWithFriendsGroup && !this.shareWithFollowersGroup) {
				if (this.targetUsernames.slice() == 0) {
					return;
				}
			}
			var that = this;
			this.showSpinner = true;
			let filePath = peergos.client.PathUtils.toPath(
				this.path,
				this.files[0].getFileProperties().name
			);
			this.context
				.sharedWith(filePath)
				.thenApply(function (fileSharedWithState) {
					that.showSpinner = false;
					let read_usernames = fileSharedWithState.readAccess.toArray(
						[]
					);
					let edit_usernames =
						fileSharedWithState.writeAccess.toArray([]);
					that.shareFileWith(read_usernames, edit_usernames);
				})
				.exceptionally(function (throwable) {
					that.resetTypeahead();
					that.showSpinner = false;
					that.errorTitle =
						"Error sharing file: " +
						that.files[0].getFileProperties().name;
					that.errorBody = throwable.getMessage();
					that.showError = true;
				});
		},
		isFriend(name) {
			return this.friendnames.indexOf(name) > -1;
		},
		isFollower(name) {
			return this.followernames.indexOf(name) > -1 || this.isFriend(name);
		},
		filterNamesFromGroups(
			includesFriends,
			includesFollowers,
			name
		) {
			if (includesFriends && this.isFriend(name)) {
				return false;
			}
			if (includesFollowers && this.isFollower(name)) {
				return false;
			}
			return true;
		},
		filterSharedWithUsers(usernames) {
			let friendGroupUid = this.getGroupUid(
				peergos.shared.user.SocialState.FRIENDS_GROUP_NAME
			);
			let includesFriends = usernames.indexOf(friendGroupUid) > -1;
			let followerGroupUid = this.getGroupUid(
				peergos.shared.user.SocialState.FOLLOWERS_GROUP_NAME
			);
			let includesFollowers = usernames.indexOf(followerGroupUid) > -1;
			var result = usernames.filter((name) =>
				this.filterNamesFromGroups(
					includesFriends,
					includesFollowers,
					name
				)
			);
			if (includesFollowers) {
				let friendIndex = result.findIndex((v) => v === friendGroupUid);
				if (friendIndex > -1) {
					result.splice(friendIndex, 1);
				}
			}
			return result;
		},
		filterEditSharedWithUsers(){
			return this.filterSharedWithUsers(this.data.edit_shared_with_users);
		},
		filterReadSharedWithUsers(){
			return this.filterSharedWithUsers(this.data.read_shared_with_users);
		},
		getUserOrGroupName(username) {
			let groupName = this.groups.groupsUidToName[username];
			return groupName != null ? groupName : username;
		},
		getGroupUid(groupName) {
			return this.groups.groupsNameToUid[groupName];
		},
		rationaliseUsersToShareWith(
			existingSharedUsers,
			usersToShareWith
		) {
			let friendGroupUid = this.getGroupUid(
				peergos.shared.user.SocialState.FRIENDS_GROUP_NAME
			);
			let followersGroupUid = this.getGroupUid(
				peergos.shared.user.SocialState.FOLLOWERS_GROUP_NAME
			);

			let includesFriends =
				this.shareWithFriendsGroup ||
				this.isAlreadySharedWithUser(
					friendGroupUid,
					existingSharedUsers
				);
			let includesFollowers =
				this.shareWithFollowersGroup ||
				this.isAlreadySharedWithUser(
					followersGroupUid,
					existingSharedUsers
				);
			if (includesFriends || includesFollowers) {
				for (var i = usersToShareWith.length - 1; i >= 0; i--) {
					let targetUsername = usersToShareWith[i];
					let removed = false;
					if (includesFriends && this.isFriend(targetUsername)) {
						usersToShareWith.splice(i, 1);
						removed = true;
					}
					if (
						!removed &&
						includesFollowers &&
						this.isFollower(targetUsername)
					) {
						usersToShareWith.splice(i, 1);
					}
				}
			}
			return usersToShareWith;
		},
		isAlreadySharedWithUser(username, existingSharedUsers) {
			return existingSharedUsers.indexOf(username) > -1;
		},
		shareFileWith(read_usernames, edit_usernames) {
			var that = this;
			var usersToShareWith = this.targetUsernames.slice();

			let existingSharedUsers =
				this.sharedWithAccess == "Read"
					? read_usernames
					: edit_usernames;
			for (var i = usersToShareWith.length - 1; i >= 0; i--) {
				let targetUsername = usersToShareWith[i];
				if (
					this.isAlreadySharedWithUser(
						targetUsername,
						existingSharedUsers
					)
				) {
					usersToShareWith.splice(i, 1);
				}
			}
			usersToShareWith = this.rationaliseUsersToShareWith(
				existingSharedUsers,
				usersToShareWith
			);

			let friendGroupUid = this.getGroupUid(
				peergos.shared.user.SocialState.FRIENDS_GROUP_NAME
			);
			let followersGroupUid = this.getGroupUid(
				peergos.shared.user.SocialState.FOLLOWERS_GROUP_NAME
			);
			if (this.shareWithFriendsGroup) {
				if (
					!this.isAlreadySharedWithUser(
						friendGroupUid,
						existingSharedUsers
					) &&
					!this.isAlreadySharedWithUser(
						followersGroupUid,
						existingSharedUsers
					) &&
					!this.shareWithFollowersGroup
				) {
					usersToShareWith.push(friendGroupUid);
				}
			}
			if (this.shareWithFollowersGroup) {
				if (
					!this.isAlreadySharedWithUser(
						followersGroupUid,
						existingSharedUsers
					)
				) {
					usersToShareWith.push(followersGroupUid);
				}
			}
			if (usersToShareWith.length == 0) {
				that.errorTitle = "Already shared!";
				that.errorBody = "";
				that.showError = true;
				return;
			}
			var filename = that.files[0].getFileProperties().name;
			let filePath = peergos.client.PathUtils.toPath(this.path, filename);
			this.showSpinner = true;
			if (this.sharedWithAccess == "Read") {
				that.context
					.shareReadAccessWith(
						filePath,
						peergos.client.JsUtil.asSet(usersToShareWith)
					)
					.thenApply(function (b) {
						that.showSpinner = false;
						that.showMessage("Success!", "Secure sharing complete");
						that.close();
						that.resetTypeahead();
						console.log("shared read access to " + filename);
						that.refresh();
					})
					.exceptionally(function (throwable) {
						that.resetTypeahead();
						that.showSpinner = false;
						that.errorTitle = "Error sharing file: " + filename;
						that.errorBody = throwable.getMessage();
						that.showError = true;
					});
			} else {
				that.context
					.shareWriteAccessWith(
						filePath,
						peergos.client.JsUtil.asSet(usersToShareWith)
					)
					.thenApply(function (b) {
						that.showSpinner = false;
						that.showMessage("Success!", "Secure sharing complete");
						that.resetTypeahead();
						that.close();
						console.log("shared write access to " + filename);
						that.refresh();
					})
					.exceptionally(function (throwable) {
						that.resetTypeahead();
						that.showSpinner = false;
						that.errorTitle = "Error sharing file: " + filename;
						that.errorBody = throwable.getMessage();
						that.showError = true;
					});
			}
		},
		setTypeAhead(){
			let allNames = this.followernames.concat(this.friendnames);
			var engine = new Bloodhound({
				datumTokenizer: Bloodhound.tokenizers.whitespace,
				queryTokenizer: Bloodhound.tokenizers.whitespace,
				local: allNames,
			});

			engine.initialize();

			$("#friend-name-input").tokenfield({
				minLength: 1,
				minWidth: 1,
				typeahead: [
					{ hint: true, highlight: true, minLength: 1 },
					{ source: suggestions },
				],
			});

			function suggestions(q, sync, async) {
				var matches, substringRegex;
				matches = [];
				substrRegex = new RegExp(q, "i");
				$.each(allNames, function (i, str) {
					if (substrRegex.test(str)) {
						matches.push(str);
					}
				});
				sync(matches);
			}
			let that = this;
			$("#friend-name-input").on(
				"tokenfield:createtoken",
				function (event) {
					//only select from available items
					var available_tokens = allNames;
					var exists = true;
					$.each(available_tokens, function (index, token) {
						if (token === event.attrs.value) exists = false;
					});
					if (exists === true) {
						event.preventDefault();
					} else {
						//do not allow duplicates in selection
						var existingTokens = $(this).tokenfield("getTokens");
						$.each(existingTokens, function (index, token) {
							if (token.value === event.attrs.value)
								event.preventDefault();
						});
					}
				}
			);
			$("#friend-name-input").on(
				"tokenfield:createdtoken",
				function (event) {
					that.targetUsernames.push(event.attrs.value);
				}
			);

			$("#friend-name-input").on(
				"tokenfield:removedtoken",
				function (event) {
					that.targetUsernames.pop(event.attrs.value);
				}
			);
		},
	},
};
</script>

<style>
/* temporary reset */
.drive-share{
	color:var(--color);
	background-color: var(--bg);
}
.drive-share .tokenfield,
.drive-share input[type=text]{
	all: initial;


	padding: 0 16px;
	font-family: var(--font-stack);

	/* font-size: var(--text);*/
	/* line-height: 48px;
	height: 48px; */

	border-radius: 4px;

	-webkit-appearance:none;
    -moz-appearance:none;
    appearance: none;
	outline: none;
	box-shadow: none;

	color: var(--color);
    background-color: var(--bg-2);
}


.drive-share input[type=checkbox]:active,
.drive-share input[type=checkbox]:focus {
	all: reset;
	background-color: white!important;
}
</style>