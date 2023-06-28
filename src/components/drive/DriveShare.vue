<template>
	<transition name="modal">
		<div class="modal-mask" @click="close">
			<div class="drive-share modal-container full-height" @click.stop style="overflow-y:auto; max-width:1000px;">
				<span @click="close" tabindex="0" v-on:keyup.enter="close" aria-label="close" class="close">&times;</span>
				<Spinner v-if="showSpinner"></Spinner>
				<div class="modal-header">
					<h4>Share {{ displayName }}</h4>
				</div>

				<div class="modal-body">

					<fieldset class=share-fields>

						<FormAutocomplete
						    is-multiple
						    v-model="targetUsernames"
                                                    :minchars="0"
						    :options="allNames"
						    placeholder="please select user"
						/>

						<label class="checkbox__group" v-if="this.allowReadWriteSharing">
							Read Only
							<input
								type="radio"
								value="Read"
								name=""
								v-model="sharedWithAccess"
							/>
							<span class="checkmark"></span>
						</label>
						<label class="checkbox__group" v-if="this.allowReadWriteSharing && this.files[0].getOwnerName() == this.context.username">
							Read & Write
							<input
								type="radio"
								value="Edit"
								name=""
								v-model="sharedWithAccess"
							/>
							<span class="checkmark"></span>
						</label>

						<label>Or Group(s):</label>

						<label class="checkbox__group">
							Friends
							<input
								type="checkbox"
								name=""
								v-model="shareWithFriendsGroup"
								@change="onFriendChange()"
							/>
							<span class="checkmark"></span>
						</label>

						<label class="checkbox__group">
							Followers (Includes Friends)
							<input
								type="checkbox"
								name=""
								v-model="shareWithFollowersGroup"
								@change="onFollowerChange()"
							/>
							<span class="checkmark"></span>
						</label>


						<AppButton
							:disabled="this.targetUsernames.slice().length == 0 && !this.shareWithFriendsGroup &&  !this.shareWithFollowersGroup"
							class=""
							accent
							aria-label="Share"
							@click.native="shareWith()"
						>
							Share
						</AppButton>
					</fieldset>

					<div v-if="this.allowReadWriteSharing" class="modal-section">
						<div v-if="data.edit_shared_with_users.length > 0">
							<p>Read and Write Access:</p>
							<div v-if="this.files[0].getOwnerName() == this.context.username">
								<div v-for="user in filterEditSharedWithUsers()">
									<label class="checkbox__group">
										{{ getUserOrGroupName(user) }}
										<input
											type="checkbox"
											:id="user"
											:value="user"
											v-model="unsharedEditAccessNames"
										/>
										<span class="checkmark"></span>
									</label>
								</div>
								<button :disabled="this.unsharedEditAccessNames.length == 0" class="btn btn-success" v-on:click="unshare('Edit')">Revoke</button>
							</div>
							<div v-if="this.files[0].getOwnerName() != this.context.username">
								<div v-for="user in filterEditSharedWithUsers()">
									{{ getUserOrGroupName(user) }}
								</div>
							</div>
						</div>
						<p v-else>Read and Write Access: None</p>
					</div>

					<div class="modal-section">
						<div v-if="data.read_shared_with_users.length > 0">
							<p>Read only Access:</p>
							<div v-if="this.files[0].getOwnerName() == this.context.username">
								<div v-for="user in filterReadSharedWithUsers()">
									<!-- <input type="checkbox" v-bind:id="user" v-bind:value="user" v-model="unsharedReadAccessNames">&nbsp;<span>{{ getUserOrGroupName(user) }}</span> -->
									<label class="checkbox__group">
										{{ getUserOrGroupName(user) }}
										<input
											type="checkbox"
											:id="user"
											:value="user"
											v-model="unsharedReadAccessNames"
										/>
										<span class="checkmark"></span>
									</label>
								</div>
                                <button :disabled="this.unsharedReadAccessNames.length == 0" class="btn btn-success" v-on:click="unshare('Read')">Revoke</button>
							</div>
							<div v-if="this.files[0].getOwnerName() != this.context.username">
								<div v-for="user in filterReadSharedWithUsers()">
									{{ getUserOrGroupName(user) }}
								</div>
							</div>
						</div>
						<p v-else>Read only Access: None</p>
					</div>

					<div v-if="this.allowCreateSecretLink" class="modal-section">
						<AppButton
							accent
							aria-label="Create Secret Link"
							@click.native="createSecretLink()"
						>
							Create Secret Link
						</AppButton>
					</div>
                    <Choice
                        v-if="showChoice"
                        v-on:hide-choice="showChoice = false"
                        :choice_message='choice_message'
                        :choice_body="choice_body"
                        :choice_consumer_func="choice_consumer_func"
                        :choice_options="choice_options">
                    </Choice>
					<SecretLink
					    v-if="showModal"
					    v-on:hide-modal="showModal = false"
					    :title="modalTitle"
					    :links="modalLinks"
                                            :username="this.context.username"
					/>
				</div>
			</div>
		</div>
	</transition>
</template>

<script>
import AppButton from "../AppButton.vue";
import Choice from '../choice/Choice.vue';
import Spinner from "../spinner/Spinner.vue";
import FormAutocomplete from "../form/FormAutocomplete.vue";
import SecretLink from "./SecretLink.vue";

import { mapState,mapGetters  } from 'vuex'
import { toast } from 'vue3-toastify';
import 'vue3-toastify/dist/index.css';

export default {
	components: {
	    AppButton,
	    Choice,
	    FormAutocomplete,
        SecretLink,
        Spinner,
	},
	data() {
		return {
			showSpinner: false,
			targetUsername: "",
			targetUsernames: [],
			sharedWithAccess: "Read",
			shareWithFriendsGroup: false,
			shareWithFollowersGroup: false,
			unsharedReadAccessNames: [],
			unsharedEditAccessNames: [],
			showModal: false,
			modalTitle: "",
			modalLinks: [],
            showChoice: false,
            choice_message: '',
            choice_body: '',
            choice_consumer_func: () => {},
            choice_options: [],
		};
	},
	props: [
		"data",
		"files",
		"path",
		"fromApp",
		"displayName",
		"allowReadWriteSharing",
		"allowCreateSecretLink",
		"currentDir"
	],
	computed: {
		...mapState([
			'context',
			'socialData'
		]),
                ...mapGetters([
	            'getPath',
	        ]),
		allNames() {
			// return this.followernames.concat(this.friendnames);
			return this.socialData.followers.concat(this.socialData.friends);
		}
	},
	methods: {
		close() {
			this.showSpinner = false;
			this.$emit("hide-share-with");
		},
		refresh() {
			if (!this.fromApp) {
				this.$emit("update-shared-refresh");
			}
		},
		createSecretLink() {
			if (this.files.length == 0) return this.close();
			if (this.files.length != 1)
				throw "Unimplemented multiple file share call";

			let name = this.displayName.toLowerCase();
		    let that = this;
			if (this.currentDir != null && (name.endsWith('.html') || name.endsWith('.md') || name == 'peergos-app.json')) {
                this.choice_message = 'Confirm Action';
                this.choice_body = '';
                this.choice_consumer_func = (index) => {
                    that.buildSecretLink(index == 1 ? true: false);
                };
                this.choice_options = ['Create secret link to file' ,'Create secret link to current folder and open file'];
                this.showChoice = true;
            } else {
                this.buildSecretLink(false);
            }
        },
		buildSecretLink(shareFolderWithFile) {
            let file = this.files[0];
            var link = [];
            let props = file.getFileProperties();
            var name = this.displayName;
			let isFile = !props.isDirectory;
			link.push({
			        fileLink: file.toLink(),
			        folderLink: this.currentDir != null ? this.currentDir.toLink(): null,
                                filename:props.name,
                                path:this.getPath,
				name: name,
				id: "secret_link_" + name,
				isFile: isFile,
				shareFolderWithFile: shareFolderWithFile
			});
			var title = "";
			if (shareFolderWithFile) {
                title = "Secret link to current folder and open file: ";
			} else if (isFile) {
                title = "Secret link to file: ";
            } else {
                title = "Secret link to folder: ";
            }
			this.showLinkModal(title, link);
		},

		showLinkModal(title, links) {
			this.showModal = true;
			this.modalTitle = title;
			this.modalLinks = links;
		},
		onFriendChange() {
			if (this.shareWithFollowersGroup && this.shareWithFriendsGroup) {
				this.shareWithFollowersGroup = false;
			}
		},
		onFollowerChange() {
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
					that.showSpinner = false;
					toast.error(`Error sharing file ${that.files[0].getFileProperties().name}: ${throwable.getMessage()}`, {timeout:false, id: 'share'})
				});
		},
		unshareFileWith(read_usernames, edit_usernames, sharedWithAccess) {
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
						toast('Read access revoked')
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
						toast.error(`Error unsharing file ${filename}: ${throwable.getMessage()}`, {timeout:false, id: 'share'})

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
						toast('Read & Write access revoked')
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
						toast.error(`Error unsharing file ${filename}: ${throwable.getMessage()}`, {timeout:false, id: 'share'})
					});
			}
		},
		allowedToShare(file) {
			if (file.isUserRoot()) {
				toast.error('You cannot share your home directory', {timeout:false, id: 'share'})
				return false;
			}
			if (
				this.sharedWithAccess == "Edit" &&
				file.getOwnerName() != this.context.username
			) {
				toast.error('Only the owner of a file can grant write access', {timeout:false, id: 'share'})
				return false;
			}
			return true;
		},
		shareWith() {
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
					that.showSpinner = false;
					toast.error(`Error sharing file ${that.files[0].getFileProperties().name}: ${throwable.getMessage()} `, {timeout:false, id: 'share'})
				});
		},
		isFriend(name) {
			return this.socialData.friends.indexOf(name) > -1;
		},
		isFollower(name) {
			return this.socialData.followers.indexOf(name) > -1 || this.isFriend(name);
		},
		filterNamesFromGroups(includesFriends, includesFollowers, name) {
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
		filterEditSharedWithUsers() {
			return this.filterSharedWithUsers(this.data.edit_shared_with_users);
		},
		filterReadSharedWithUsers() {
			return this.filterSharedWithUsers(this.data.read_shared_with_users);
		},
		getUserOrGroupName(username) {
			let groupName = this.socialData.groupsUidToName[username];

			return groupName != null ? groupName : username;
		},
		getGroupUid(groupName) {
			return this.socialData.groupsNameToUid[groupName];
		},
		rationaliseUsersToShareWith(existingSharedUsers, usersToShareWith) {
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
				toast.error('Already shared', {timeout:false, id: 'share'})
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
						toast('Secure sharing complete')
						that.close();
						// that.resetTypeahead();
						console.log("shared read access to " + filename);
						that.refresh();
					})
					.exceptionally(function (throwable) {
						that.showSpinner = false;
						toast.error(`Error sharing file ${filename}: ${throwable.getMessage()}`, {timeout:false, id: 'share'})

					});
			} else {
				that.context
					.shareWriteAccessWith(
						filePath,
						peergos.client.JsUtil.asSet(usersToShareWith)
					)
					.thenApply(function (b) {
						that.showSpinner = false;
						toast('Secure sharing complete')
						// that.resetTypeahead();
						that.close();
						console.log("shared write access to " + filename);
						that.refresh();
					})
					.exceptionally(function (throwable) {
						that.showSpinner = false;
						toast.error(`Error sharing file ${filename}: ${throwable.getMessage()}`, {timeout:false, id: 'share'})
					});
			}
		},
	},
};
</script>

<style>
/* temporary reset */
.drive-share {
	color: var(--color);
	background-color: var(--bg);
}
.share-fields{
	display: flex;
	flex-direction: column;
	align-items: flex-start;
}

.modal-section{
	margin: 32px 0;
}
</style>
