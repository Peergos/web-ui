<template>
	<transition name="modal">
		<div class="modal-mask" @click="close">
			<div class="drive-share modal-container full-height" @click.stop style="overflow-y:auto; max-width:1000px;">
				<span @click="close" tabindex="0" v-on:keyup.enter="close" aria-label="close" class="close">&times;</span>
				<Spinner v-if="showSpinner"></Spinner>
				<div class="modal-header">
					<h4>{{ translate("DRIVE.SHARE") }} {{ displayName }}</h4>
				</div>

				<div class="modal-body">

					<fieldset class=share-fields>

						<FormAutocomplete
						    is-multiple
						    v-model="targetUsernames"
                                                    :minchars="0"
						    :options="allNames"
						    :placeholder="translate('DRIVE.SHARE.USER')"
						/>

						<label class="checkbox__group" v-if="this.allowReadWriteSharing">
							{{ translate("DRIVE.SHARE.R") }}
							<input
								type="radio"
								value="Read"
								name=""
								v-model="sharedWithAccess"
							/>
							<span class="checkmark"></span>
						</label>
						<label class="checkbox__group" v-if="this.allowReadWriteSharing && this.files[0].getOwnerName() == this.context.username">
							{{ translate("DRIVE.SHARE.RW") }}
							<input
								type="radio"
								value="Edit"
								name=""
								v-model="sharedWithAccess"
							/>
							<span class="checkmark"></span>
						</label>

						<label>{{ translate("DRIVE.SHARE.GROUP") }}:</label>

						<label class="checkbox__group">
							{{ translate("DRIVE.SHARE.FRIENDS") }}
							<input
								type="checkbox"
								name=""
								v-model="shareWithFriendsGroup"
								@change="onFriendChange()"
							/>
							<span class="checkmark"></span>
						</label>

						<label class="checkbox__group">
							{{ translate("DRIVE.SHARE.FOLLOWERS") }}
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
							{{ translate("DRIVE.SHARE") }}
						</AppButton>
					</fieldset>

					<div v-if="this.allowReadWriteSharing" class="modal-section">
						<div v-if="data.edit_shared_with_users.length > 0">
							<p>{{ translate("DRIVE.SHARE.RWACCESS") }}:</p>
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
								<button :disabled="this.unsharedEditAccessNames.length == 0" class="btn btn-success" v-on:click="unshare('Edit')">{{ translate("DRIVE.SHARE.REVOKE") }}</button>
							</div>
							<div v-if="this.files[0].getOwnerName() != this.context.username">
								<div v-for="user in filterEditSharedWithUsers()">
									{{ getUserOrGroupName(user) }}
								</div>
							</div>
						</div>
						<p v-else>{{ translate("DRIVE.SHARE.RWACCESS") }}: {{ translate("DRIVE.SHARE.NONE") }}</p>
					</div>

					<div class="modal-section">
						<div v-if="data.read_shared_with_users.length > 0">
							<p>{{ translate("DRIVE.SHARE.RACCESS") }}:</p>
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
						<p v-else>{{ translate("DRIVE.SHARE.RACCESS") }}: {{ translate("DRIVE.SHARE.NONE") }}</p>
					</div>

					<div v-if="this.allowCreateSecretLink" class="modal-section">
						<AppButton
							accent
							aria-label="Create Secret Link"
							@click.native="createSecretLink()"
						>
							{{ translate("DRIVE.SHARE.LINK") }}
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
					    v-on:hide-modal="closeSecretLinkModal"
					    :title="modalTitle"
					    :link="modalLink"
                                            :host="this.linkHost"
                        :existingProps="existingProps"
                        :username="this.context.username"
					/>
                    <div v-if="secretLinksList!=0" class="table-responsive">
                        <table class="table">
                            <thead>
                            <tr  v-if="secretLinksList!=0">
                                <th>Access</th>
                                <th>Password</th>
                                <th>Max Count</th>
                                <th>Expiry</th>
                            </tr>
                            </thead>
                            <tbody>
                            <tr v-for="item in secretLinksList">
                                <td>{{ item.isLinkWritable ? "Writable" : "Read-only" }}</td>
                                <td>{{ item.userPassword }}</td>
                                <td>{{ item.maxRetrievals.ref != null ? item.maxRetrievals.ref.toString() : "-" }}</td>
                                <td>{{ item.expiry.ref != null ? formatDateTime(item.expiry.ref) : "-" }}</td>
                                <td> <button class="btn btn-success" @click="editLink(item)">{{ translate("DRIVE.LINK.VIEWEDIT") }}</button>
                                </td>
                                <td> <button class="btn btn-success" @click="deleteLink(item)">Delete</button>
                                </td>
                            </tr>
                            </tbody>
                        </table>
                    </div>

				</div>
			</div>
		</div>
	</transition>
</template>

<script>
const AppButton = require("../AppButton.vue");
const Choice = require('../choice/Choice.vue');
const Spinner = require("../spinner/Spinner.vue");
const FormAutocomplete = require("../form/FormAutocomplete.vue");
const SecretLink = require("SecretLink.vue");
const i18n = require("../../i18n/index.js");

module.exports = {
	components: {
	    AppButton,
	    Choice,
	    FormAutocomplete,
            SecretLink,
            Spinner,
	},
        mixins:[i18n],
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
		    modalLink: null,
                    showChoice: false,
                    choice_message: '',
                    choice_body: '',
                    choice_consumer_func: () => {},
                    choice_options: [],
                    existingProps:null,
                    secretLinksList: [],
                    linkHost: "",
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
	    "autoOpenSecretLink",
	    "currentDir"
	],
	computed: {
		...Vuex.mapState([
			'context',
			'socialData'
		]),
		allNames() {
			// return this.followernames.concat(this.friendnames);
			return this.socialData.followers.concat(this.socialData.friends);
		}
	},
    created: function() {
        this.loadSecretLinks();
    },
	methods: {
        loadSecretLinks() {
            let that = this;
            this.context.getLinkHost().thenApply(host => {
               that.linkHost = host;
            });
            this.showSpinner = true;
            let file = this.files[0];
            let props = file.getFileProperties();
            let directoryPath = peergos.client.PathUtils.directoryToPath(this.path);
            this.context.getDirectorySharingState(directoryPath).thenApply(function (sharedWithState) {
                let fileSharingState = sharedWithState.get(props.name);
                that.secretLinksList = fileSharingState.links.toArray([]);
                that.showSpinner = false;
            });
        },
        closeSecretLinkModal() {
            this.showModal = false;
            this.existingProps = null;
            this.loadSecretLinks();
            this.refreshFiles();
            this.refresh();
        },
        formatDateTime(dateTime) {
            let date = new Date(dateTime.toString() + "+00:00"); //adding UTC TZ in ISO_OFFSET_DATE_TIME ie 2021-12-03T10:25:30+00:00
            let formatted = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate()
                + ' ' + (date.getHours() < 10 ? '0' : '') + date.getHours()
                + ':' + (date.getMinutes() < 10 ? '0' : '') + date.getMinutes()
                + ':' + (date.getSeconds() < 10 ? '0' : '') + date.getSeconds();
            return formatted;
        },
        deleteLink(link) {
            let that = this;
            let filePath = peergos.client.PathUtils.toPath(this.path, this.files[0].getFileProperties().name);
            this.showSpinner = true;
            this.context.deleteSecretLink(link.getLinkLabel(), filePath, false).thenApply(function (sharedWithState) {
                that.showSpinner = false;
                let index = that.secretLinksList.findIndex(e => {
                    return e.getLinkLabel() == link.getLinkLabel();
                })
                that.secretLinksList.splice(index, 1);
                that.existingProps = null;
                that.refreshFiles();
                that.refresh();
            }).exceptionally(function (throwable) {
                console.log(throwable);
                that.showSpinner = false;
                //todo that.$toast.error(that.translate("DRIVE.SHARE.ERROR") + ` ${that.files[0].getFileProperties().name}: ${throwable.getMessage()}`, {timeout:false, id: 'share'})
            });
        },
            editLink(props) {
                this.existingProps = props;
                this.buildSecretLink(false);
            },
		close() {
			this.showSpinner = false;
			this.$emit("hide-share-with");
		},
		refreshFiles() {
		    this.$emit("update-files");
		},
		refresh() {
			if (!this.fromApp) {
				this.$emit("update-shared-refresh");
			}
		},
            isUserRoot() {
                let file = this.files[0];
                return file.isUserRoot();
            },
		createSecretLink() {
			if (this.files.length == 0) return this.close();
			if (this.files.length != 1)
				throw "Unimplemented multiple file share call";

			let name = this.displayName.toLowerCase();
		    let that = this;
			if (this.currentDir != null && (name.endsWith('.html') || name.endsWith('.md') || name.endsWith('.note') || name == 'peergos-app.json') && !this.isUserRoot()) {
                this.choice_message = this.translate("DRIVE.SHARE.CONFIRM");
                this.choice_body = '';
                this.choice_consumer_func = (index) => {
                    that.buildSecretLink(index == 1 ? true: false);
                };
                this.choice_options = [this.translate("DRIVE.SHARE.CREATE.FILE"), this.translate("DRIVE.SHARE.CREATE.FOLDER")];
                this.showChoice = true;
            } else {
                this.buildSecretLink(false);
            }
        },
		buildSecretLink(shareFolderWithFile) {
            let file = this.files[0];
            var link = null;
            let props = file.getFileProperties();
            var name = this.displayName;
			let isFile = !props.isDirectory;
            let filePath = peergos.client.PathUtils.directoryToPath(this.path).toString();
			link = {
			        file: file,
			        filename:props.name,
                                path:filePath,
				name: name,
				id: "secret_link_" + name,
				isFile: isFile,
				shareFolderWithFile: shareFolderWithFile,
                autoOpen: (shareFolderWithFile === true || this.autoOpenSecretLink),
			};
			var title = "";
			if (shareFolderWithFile) {
                title = this.translate("DRIVE.SHARE.FOLDER.OPEN") + ": ";
			} else if (isFile) {
                title = this.translate("DRIVE.SHARE.FILE")+": ";
            } else {
                title = this.translate("DRIVE.SHARE.FOLDER")+": ";
            }
			this.showLinkModal(title, link);
		},

		showLinkModal(title, link) {
			this.showModal = true;
			this.modalTitle = title;
			this.modalLink = link;
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
					that.$toast.error(that.translate("DRIVE.SHARE.ERROR") + ` ${that.files[0].getFileProperties().name}: ${throwable.getMessage()}`, {timeout:false, id: 'share'})
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
						that.$toast(that.translate("DRIVE.SHARE.REVOKE.R"))
						that.close();
						that.refresh();
					})
					.exceptionally(function (throwable) {
						that.showSpinner = false;
						that.$toast.error(that.translate("DRIVE.SHARE.ERROR.UNSHARING")+` ${filename}: ${throwable.getMessage()}`, {timeout:false, id: 'share'})

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
						that.$toast(that.translate("DRIVE.SHARE.REVOKE.RW"))
						that.close();
						that.refresh();
					})
					.exceptionally(function (throwable) {
						that.showSpinner = false;
						that.$toast.error(that.translate("DRIVE.SHARE.ERROR.UNSHARING")+` ${filename}: ${throwable.getMessage()}`, {timeout:false, id: 'share'})
					});
			}
		},
		allowedToShare(file) {
			if (file.isUserRoot()) {
				this.$toast.error(this.translate("DRIVE.SHARE.ERROR.HOME"), {timeout:false, id: 'share'})
				return false;
			}
			if (
				this.sharedWithAccess == "Edit" &&
				file.getOwnerName() != this.context.username
			) {
				this.$toast.error(this.translate("DRIVE.SHARE.ERROR.WRITE"), {timeout:false, id: 'share'})
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
					that.$toast.error(that.translate("DRIVE.SHARE.ERROR") + ` ${that.files[0].getFileProperties().name}: ${throwable.getMessage()} `, {timeout:false, id: 'share'})
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
				that.$toast.error(that.translate("DRIVE.SHARE.ERROR.REPEAT"), {timeout:false, id: 'share'})
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
						that.$toast(that.translate("DRIVE.SHARE.COMPLETE"))
						that.close();
						// that.resetTypeahead();
						that.refresh();
					})
					.exceptionally(function (throwable) {
						that.showSpinner = false;
						that.$toast.error(that.translate("DRIVE.SHARE.ERROR") + ` ${filename}: ${throwable.getMessage()}`, {timeout:false, id: 'share'})

					});
			} else {
				that.context
					.shareWriteAccessWith(
						filePath,
						peergos.client.JsUtil.asSet(usersToShareWith)
					)
					.thenApply(function (b) {
						that.showSpinner = false;
						that.$toast(that.translate("DRIVE.SHARE.COMPLETE"))
						// that.resetTypeahead();
						that.close();
						that.refresh();
					})
					.exceptionally(function (throwable) {
						that.showSpinner = false;
						that.$toast.error(that.translate("DRIVE.SHARE.ERROR") + ` ${filename}: ${throwable.getMessage()}`, {timeout:false, id: 'share'})
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
