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

						<div v-if="sharedWithAccess == 'Edit' && writeQuota == null" class="share-limit">
							<label>{{ translate("DRIVE.SHARE.LIMIT") }}:</label>
							<input type="number" min="0" v-model="limitAmount" :placeholder="translate('DRIVE.SHARE.LIMIT.NONE')" />
							<select v-model="limitUnit">
								<option value="MB">MB</option>
								<option value="GB">GB</option>
							</select>
						</div>

						<label>{{ translate("DRIVE.SHARE.GROUP") }}:</label>

						<div class="share-groups">
							<label class="checkbox__group" v-for="uid in groupUids" :key="uid">
								{{ groupLabel(uid) }}
								<span class="share-groups__count">{{ groupCountLabel(uid) }}</span>
								<input
									type="checkbox"
									:value="uid"
									v-model="selectedGroupUids"
									@change="onGroupChange(uid)"
								/>
								<span class="checkmark"></span>
							</label>
						</div>

						<AppButton
							:disabled="this.targetUsernames.slice().length == 0 && this.selectedGroupUids.length == 0"
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
										<AppIcon v-if="isGroup(user)" icon="social" class="share-group-icon" :width="16" :height="16" />
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
								<div v-if="writeQuota != null" class="share-limit">
									<p>
										{{ translate("DRIVE.SHARE.LIMIT") }}:
										<span v-if="writeQuota.hasQuota()">{{ convertBytesToHumanReadable(writeQuota.getUsedBytes()) }} / {{ convertBytesToHumanReadable(writeQuota.getQuotaBytes()) }}</span>
										<span v-else>{{ translate("DRIVE.SHARE.LIMIT.NONE") }}</span>
									</p>
									<input type="number" min="0" v-model="limitAmount" />
									<select v-model="limitUnit">
										<option value="MB">MB</option>
										<option value="GB">GB</option>
									</select>
									<button class="btn btn-success" @click="setWriteQuota()">{{ translate("DRIVE.SHARE.LIMIT.SET") }}</button>
									<button v-if="writeQuota.hasQuota()" class="btn btn-success" @click="removeWriteQuota()">{{ translate("DRIVE.SHARE.LIMIT.REMOVE") }}</button>
								</div>
							</div>
							<div v-if="this.files[0].getOwnerName() != this.context.username">
								<div v-for="user in filterEditSharedWithUsers()">
									<AppIcon v-if="isGroup(user)" icon="social" class="share-group-icon" :width="16" :height="16" />
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
										<AppIcon v-if="isGroup(user)" icon="social" class="share-group-icon" :width="16" :height="16" />
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
									<AppIcon v-if="isGroup(user)" icon="social" class="share-group-icon" :width="16" :height="16" />
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
						<AppButton
							v-if="otherLinks.length > 0"
							aria-label="Add to an existing link"
							@click.native="showAddToExisting = !showAddToExisting"
						>
							{{ translate("DRIVE.SHARE.LINK.ADD.TO.EXISTING") }}
						</AppButton>
						<div v-if="showAddToExisting" class="add-to-existing">
							<p class="add-to-existing__note">{{ translate("DRIVE.SHARE.LINK.ADD.WARNING") }}</p>
							<div v-for="l in otherLinks" :key="l.getLabel()" class="add-to-existing__row">
								<span class="add-to-existing__what">
									{{ l.itemCount() }} {{ l.itemCount() == 1 ? translate("DRIVE.SHARE.LINK.ITEM") : translate("DRIVE.SHARE.LINK.ITEMS") }}
									&mdash; {{ l.paths().join(", ") }}
								</span>
								<button class="btn btn-success" @click="addToLink(l, false)">
									{{ translate("DRIVE.SHARE.LINK.ADD.READONLY") }}
								</button>
								<button class="btn btn-success" @click="addToLink(l, true)">
									{{ translate("DRIVE.SHARE.LINK.ADD.WRITABLE") }}
								</button>
							</div>
						</div>
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
const AppIcon = require("../AppIcon.vue");
const Choice = require('../choice/Choice.vue');
const Spinner = require("../spinner/Spinner.vue");
const FormAutocomplete = require("../form/FormAutocomplete.vue");
const SecretLink = require("SecretLink.vue");
const i18n = require("../../i18n/index.js");
const mixins = require("../../mixins/mixins.js");

module.exports = {
	components: {
	    AppButton,
	    AppIcon,
	    Choice,
	    FormAutocomplete,
            SecretLink,
            Spinner,
	},
        mixins:[i18n, mixins],
	data() {
		return {
		    showSpinner: false,
		    targetUsername: "",
		    targetUsernames: [],
		    sharedWithAccess: "Read",
		    selectedGroupUids: [],
		    customGroupMembers: {},
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
                    otherLinks: [],
                    showAddToExisting: false,
                    linkHost: "",
                    writeQuota: null,
                    limitAmount: "",
                    limitUnit: "GB",
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
		},
		friendsGroupUid() {
			return this.getGroupUid(peergos.shared.user.SocialState.FRIENDS_GROUP_NAME);
		},
		followersGroupUid() {
			return this.getGroupUid(peergos.shared.user.SocialState.FOLLOWERS_GROUP_NAME);
		},
		groupUids() {
			return this.socialData.groupUids;
		}
	},
    created: function() {
        this.loadSecretLinks();
        this.loadOtherLinks();
        this.loadCustomGroupMembers();
        this.loadWriteQuota();
    },
	methods: {
        loadCustomGroupMembers() {
            let that = this;
            this.groupUids.filter(uid => ! this.isBuiltInGroup(uid)).forEach(uid => {
                that.context.getGroupMembers(uid).thenApply(members => {
                    that.$set(that.customGroupMembers, uid, members.toArray([]));
                });
            });
        },
        isBuiltInGroup(uid) {
            return uid == this.friendsGroupUid || uid == this.followersGroupUid;
        },
        isGroup(name) {
            return this.socialData.groupsUidToName[name] != null;
        },
        groupMembers(uid) {
            if (uid == this.friendsGroupUid)
                return this.socialData.friends;
            if (uid == this.followersGroupUid)
                return this.socialData.followers.concat(this.socialData.friends);
            return this.customGroupMembers[uid];
        },
        groupLabel(uid) {
            if (uid == this.friendsGroupUid)
                return this.translate("DRIVE.SHARE.FRIENDS");
            if (uid == this.followersGroupUid)
                return this.translate("DRIVE.SHARE.FOLLOWERS");
            return this.getUserOrGroupName(uid);
        },
        isEmptyGroup(uid) {
            let members = this.groupMembers(uid);
            return members != null && members.length == 0;
        },
        groupCountLabel(uid) {
            let members = this.groupMembers(uid);
            if (members == null)
                return "";
            if (members.length == 0)
                return "(" + this.translate("GROUPS.EMPTY") + ")";
            return "(" + members.length + ")";
        },
        isOwner() {
            return this.files[0].getOwnerName() == this.context.username;
        },
        filePath() {
            return peergos.client.PathUtils.toPath(this.path, this.files[0].getFileProperties().name);
        },
        loadWriteQuota() {
            if (! this.allowReadWriteSharing || ! this.isOwner() || this.data.edit_shared_with_users.length == 0)
                return;
            let that = this;
            this.context.getWriteShareQuota(this.filePath()).thenApply(info => {
                that.writeQuota = info;
            }).exceptionally(t => { console.log(t); return null; });
        },
        /** null when no limit was entered, and NaN when the entry isn't a positive number */
        limitBytes() {
            if (String(this.limitAmount).trim() == "")
                return null;
            let amount = Number(this.limitAmount);
            if (isNaN(amount) || amount <= 0)
                return NaN;
            return Math.round(amount * (this.limitUnit == "GB" ? 1000 * 1000 * 1000 : 1000 * 1000));
        },
        applyWriteQuota(update) {
            let that = this;
            this.showSpinner = true;
            return update.thenApply(res => {
                that.showSpinner = false;
                that.limitAmount = "";
                that.$toast(that.translate("DRIVE.SHARE.LIMIT.SAVED"));
                that.loadWriteQuota();
                return res;
            }).exceptionally(t => {
                that.showSpinner = false;
                that.$toast.error(that.translate("DRIVE.SHARE.LIMIT.ERROR") + ": " + t.getMessage(), {timeout:false, id: 'share'});
                return null;
            });
        },
        setWriteQuota() {
            let bytes = this.limitBytes();
            if (bytes == null || isNaN(bytes)) {
                this.$toast.error(this.translate("DRIVE.SHARE.LIMIT.INVALID"), {id: 'share'});
                return;
            }
            this.applyWriteQuota(this.context.setWriteShareQuota(this.filePath(), bytes));
        },
        removeWriteQuota() {
            this.applyWriteQuota(this.context.removeWriteShareQuota(this.filePath()));
        },
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
        /** Links this file is not already in, so it can be added to one of them. */
        loadOtherLinks() {
            let that = this;
            let filePath = peergos.client.PathUtils.toPath(this.path, this.files[0].getFileProperties().name).toString();
            this.context.getAllSecretLinks().thenApply(links => {
                that.otherLinks = links.toArray([]).filter(l => ! l.contains(filePath));
            }).exceptionally(t => { console.log(t); return null; });
        },
        addToLink(summary, writable) {
            let that = this;
            let filePath = peergos.client.PathUtils.toPath(this.path, this.files[0].getFileProperties().name).toString();
            this.showSpinner = true;
            this.context.addToSecretLink(summary, filePath, writable).thenApply(props => {
                that.showSpinner = false;
                that.showAddToExisting = false;
                that.$toast.success(that.translate("DRIVE.SHARE.LINK.ADDED"));
                that.loadSecretLinks();
                that.loadOtherLinks();
                that.refreshFiles();
                that.refresh();
            }).exceptionally(t => {
                console.log(t);
                that.showSpinner = false;
                let msg = "" + (t.message || t);
                that.$toast.error(msg.substring(msg.lastIndexOf(":") + 1).trim(), {timeout:false});
                return null;
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
		// followers includes friends, so at most one of the two is selected
		onGroupChange(uid) {
			let other = uid == this.friendsGroupUid ? this.followersGroupUid :
				uid == this.followersGroupUid ? this.friendsGroupUid : null;
			if (other != null && this.selectedGroupUids.includes(uid))
				this.selectedGroupUids = this.selectedGroupUids.filter(g => g != other);
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
			if (this.selectedGroupUids.length == 0 && this.targetUsernames.slice().length == 0)
				return;
			if (this.sharedWithAccess == "Edit" && this.writeQuota == null && isNaN(this.limitBytes())) {
				this.$toast.error(this.translate("DRIVE.SHARE.LIMIT.INVALID"), {id: 'share'});
				return;
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
		isMemberOfAny(groupUids, name) {
			return groupUids.some(uid => {
				let members = this.groupMembers(uid);
				return members != null && members.includes(name);
			});
		},
		filterSharedWithUsers(usernames) {
			let groups = usernames.filter(name => this.isGroup(name));
			var result = usernames.filter(name => this.isGroup(name) || ! this.isMemberOfAny(groups, name));
			if (groups.includes(this.followersGroupUid))
				result = result.filter(name => name != this.friendsGroupUid);
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
		// drop anyone who already gets the file through a group, so they aren't shared with twice
		rationaliseUsersToShareWith(existingSharedUsers, usersToShareWith) {
			let groups = this.selectedGroupUids.concat(existingSharedUsers.filter(name => this.isGroup(name)));
			return usersToShareWith.filter(name => ! this.isMemberOfAny(groups, name));
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

			let followersIncluded = this.selectedGroupUids.includes(this.followersGroupUid) ||
				this.isAlreadySharedWithUser(this.followersGroupUid, existingSharedUsers);
			this.selectedGroupUids
				.filter(uid => ! this.isAlreadySharedWithUser(uid, existingSharedUsers))
				.filter(uid => ! (uid == this.friendsGroupUid && followersIncluded))
				.forEach(uid => usersToShareWith.push(uid));
			if (usersToShareWith.length == 0) {
				that.$toast.error(that.translate("DRIVE.SHARE.ERROR.REPEAT"), {timeout:false, id: 'share'})
				return;
			}
			let emptyGroups = usersToShareWith.filter(uid => this.isGroup(uid) && this.isEmptyGroup(uid));
			if (emptyGroups.length > 0)
				this.$toast.info(this.translate("GROUPS.SHARED.EMPTY").replace("$NAME", emptyGroups.map(uid => this.groupLabel(uid)).join(", ")));
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
					.thenCompose(function (b) {
						let bytes = that.writeQuota == null ? that.limitBytes() : null;
						if (bytes == null)
							return peergos.shared.util.Futures.of(true);
						return that.context.setWriteShareQuota(filePath, bytes).exceptionally(function (throwable) {
							that.$toast.error(that.translate("DRIVE.SHARE.LIMIT.ERROR") + ": " + throwable.getMessage(), {timeout:false, id: 'share-limit'});
							return false;
						});
					})
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

.share-groups{
	max-height: 12rem;
	overflow-y: auto;
	align-self: stretch;
}

.share-groups__count{
	opacity: 0.7;
	margin-left: 0.25em;
}

.share-group-icon{
	vertical-align: middle;
	margin-right: 0.25em;
}

.modal-section{
	margin: 32px 0;
}

.share-limit{
	margin: 16px 0;
}

.share-limit input{
	width: 8em;
	margin-right: 8px;
}
</style>
