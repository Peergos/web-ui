<template>
	<transition name="modal">
		<div class="pg-dialog__mask" @click="close">
			<div class="pg-dialog drive-share" role="dialog" aria-modal="true"
				:aria-label="translate('DRIVE.SHARE') + ' ' + displayName" @click.stop>
				<header class="pg-dialog__head">
					<h2 class="pg-dialog__title pg-dialog__title--inline"><span>{{ translate("DRIVE.SHARE") }}&nbsp;</span><span class="pg-dialog__title-name">{{ displayName }}</span></h2>
					<DialogClose @close="close"/>
				</header>

				<div class="pg-dialog__body drive-share__body">

					<section class="share-fields drive-share__section">
						<FormAutocomplete
							is-multiple
							v-model="targetUsernames"
							:minchars="0"
							:options="allNames"
							:placeholder="translate('DRIVE.SHARE.USER')"
						/>

						<div v-if="allowReadWriteSharing" class="drive-share__choice" role="radiogroup" :aria-label="translate('DRIVE.SHARE')">
							<label class="pg-switch">
								<input type="radio" value="Read" v-model="sharedWithAccess"/>
								<span class="pg-switch__track" aria-hidden="true"></span>
								<span>{{ translate("DRIVE.SHARE.R") }}</span>
							</label>
							<label v-if="isOwner()" class="pg-switch">
								<input type="radio" value="Edit" v-model="sharedWithAccess"/>
								<span class="pg-switch__track" aria-hidden="true"></span>
								<span>{{ translate("DRIVE.SHARE.RW") }}</span>
							</label>
						</div>

						<div v-if="sharedWithAccess == 'Edit' && writeQuota == null" class="drive-share__limit">
							<label for="drive-share-new-limit">{{ translate("DRIVE.SHARE.LIMIT") }}</label>
							<input id="drive-share-new-limit" class="pg-input" type="number" min="0" v-model="limitAmount" :placeholder="translate('DRIVE.SHARE.LIMIT.NONE')"/>
							<select class="pg-input" v-model="limitUnit" :aria-label="translate('DRIVE.SHARE.LIMIT')">
								<option value="MB">MB</option>
								<option value="GB">GB</option>
							</select>
						</div>

						<div class="drive-share__groups">
							<h3 class="drive-share__heading">{{ translate("DRIVE.SHARE.GROUP") }}</h3>
							<div class="share-groups">
								<label class="pg-switch" v-for="uid in groupUids" :key="uid">
									<input type="checkbox" :value="uid" v-model="selectedGroupUids" @change="onGroupChange(uid)"/>
									<span class="pg-switch__track" aria-hidden="true"></span>
									<span>{{ groupLabel(uid) }} <span class="share-groups__count">{{ groupCountLabel(uid) }}</span></span>
								</label>
							</div>
						</div>

						<div class="drive-share__send">
							<button type="button" class="pg-btn pg-btn--primary"
								:disabled="targetUsernames.slice().length == 0 && selectedGroupUids.length == 0"
								@click="shareWith()">
								{{ translate("DRIVE.SHARE") }}
							</button>
						</div>
					</section>

					<section v-if="allowReadWriteSharing" class="drive-share__section drive-share__access">
						<h3 class="drive-share__heading">{{ translate("DRIVE.SHARE.RWACCESS") }}</h3>
						<template v-if="data.edit_shared_with_users.length > 0">
							<ul class="drive-share__people">
								<li v-for="user in filterEditSharedWithUsers()" :key="user" class="drive-share__person">
									<label v-if="isOwner()" class="drive-share__pick">
										<input type="checkbox" :value="user" v-model="unsharedEditAccessNames"/>
										<AppIcon v-if="isGroup(user)" icon="social" class="share-group-icon" :width="16" :height="16"/>
										<span class="drive-share__name">{{ getUserOrGroupName(user) }}</span>
									</label>
									<span v-else class="drive-share__pick">
										<AppIcon v-if="isGroup(user)" icon="social" class="share-group-icon" :width="16" :height="16"/>
										<span class="drive-share__name">{{ getUserOrGroupName(user) }}</span>
									</span>
								</li>
							</ul>
							<template v-if="isOwner()">
								<div class="drive-share__row-actions">
									<button type="button" class="pg-btn" :disabled="unsharedEditAccessNames.length == 0" @click="unshare('Edit')">{{ translate("DRIVE.SHARE.REVOKE") }}</button>
								</div>
								<div v-if="writeQuota != null" class="drive-share__quota">
									<p class="drive-share__usage">
										{{ translate("DRIVE.SHARE.LIMIT") }}:
										<span v-if="writeQuota.hasQuota()">{{ convertBytesToHumanReadable(writeQuota.getUsedBytes()) }} / {{ convertBytesToHumanReadable(writeQuota.getQuotaBytes()) }}</span>
										<span v-else>{{ translate("DRIVE.SHARE.LIMIT.NONE") }}</span>
									</p>
									<div class="drive-share__limit">
										<input class="pg-input" type="number" min="0" v-model="limitAmount" :aria-label="translate('DRIVE.SHARE.LIMIT')"/>
										<select class="pg-input" v-model="limitUnit" :aria-label="translate('DRIVE.SHARE.LIMIT')">
											<option value="MB">MB</option>
											<option value="GB">GB</option>
										</select>
										<button type="button" class="pg-btn" @click="setWriteQuota()">{{ translate("DRIVE.SHARE.LIMIT.SET") }}</button>
										<button v-if="writeQuota.hasQuota()" type="button" class="pg-btn pg-btn--quiet" @click="removeWriteQuota()">{{ translate("DRIVE.SHARE.LIMIT.REMOVE") }}</button>
									</div>
								</div>
							</template>
						</template>
						<p v-else class="pg-note">{{ translate("DRIVE.SHARE.NONE") }}</p>
					</section>

					<section class="drive-share__section drive-share__access">
						<h3 class="drive-share__heading">{{ translate("DRIVE.SHARE.RACCESS") }}</h3>
						<template v-if="data.read_shared_with_users.length > 0">
							<ul class="drive-share__people">
								<li v-for="user in filterReadSharedWithUsers()" :key="user" class="drive-share__person">
									<label v-if="isOwner()" class="drive-share__pick">
										<input type="checkbox" :value="user" v-model="unsharedReadAccessNames"/>
										<AppIcon v-if="isGroup(user)" icon="social" class="share-group-icon" :width="16" :height="16"/>
										<span class="drive-share__name">{{ getUserOrGroupName(user) }}</span>
									</label>
									<span v-else class="drive-share__pick">
										<AppIcon v-if="isGroup(user)" icon="social" class="share-group-icon" :width="16" :height="16"/>
										<span class="drive-share__name">{{ getUserOrGroupName(user) }}</span>
									</span>
								</li>
							</ul>
							<div v-if="isOwner()" class="drive-share__row-actions">
								<button type="button" class="pg-btn" :disabled="unsharedReadAccessNames.length == 0" @click="unshare('Read')">{{ translate("DRIVE.SHARE.REVOKE") }}</button>
							</div>
						</template>
						<p v-else class="pg-note">{{ translate("DRIVE.SHARE.NONE") }}</p>
					</section>

					<section v-if="allowCreateSecretLink" class="drive-share__section">
						<h3 class="drive-share__heading">{{ translate("DRIVE.SHARED.LINK") }}</h3>
						<ul v-if="secretLinksList.length > 0" class="drive-share__people">
							<li v-for="(item, i) in secretLinksList" :key="i" class="drive-share__link">
								<span class="drive-share__link-text">
									<span class="drive-share__name">{{ item.isLinkWritable ? "Writable" : "Read-only" }}</span>
									<span class="drive-share__meta">
										<span>Password: {{ item.userPassword || "-" }}</span>
										<span>Max Count: {{ item.maxRetrievals.ref != null ? item.maxRetrievals.ref.toString() : "-" }}</span>
										<span>Expiry: {{ item.expiry.ref != null ? formatDateTime(item.expiry.ref) : "-" }}</span>
									</span>
								</span>
								<span class="drive-share__link-actions">
									<button type="button" class="pg-btn" @click="editLink(item)">{{ translate("DRIVE.LINK.VIEWEDIT") }}</button>
									<button type="button" class="pg-btn pg-btn--quiet" @click="deleteLink(item)">Delete</button>
								</span>
							</li>
						</ul>
						<div class="drive-share__row-actions">
							<button type="button" class="pg-btn pg-btn--primary" aria-label="Create Secret Link" @click="createSecretLink()">{{ translate("DRIVE.SHARE.LINK") }}</button>
							<button v-if="otherLinks.length > 0" type="button" class="pg-btn"
								aria-label="Add to an existing link" :aria-expanded="showAddToExisting ? 'true' : 'false'"
								@click="showAddToExisting = !showAddToExisting">
								{{ translate("DRIVE.SHARE.LINK.ADD.TO.EXISTING") }}
							</button>
						</div>
						<div v-if="showAddToExisting" class="add-to-existing">
							<p class="pg-note">{{ translate("DRIVE.SHARE.LINK.ADD.WARNING") }}</p>
							<ul class="drive-share__people">
								<li v-for="l in otherLinks" :key="l.getLabel()" class="drive-share__link">
									<span class="drive-share__link-text">
										<span class="drive-share__name">{{ l.itemCount() }} {{ l.itemCount() == 1 ? translate("DRIVE.SHARE.LINK.ITEM") : translate("DRIVE.SHARE.LINK.ITEMS") }}</span>
										<span class="drive-share__meta">{{ l.paths().join(", ") }}</span>
									</span>
									<span class="drive-share__link-actions">
										<button type="button" class="pg-btn" @click="addToLink(l, false)">{{ translate("DRIVE.SHARE.LINK.ADD.READONLY") }}</button>
										<button type="button" class="pg-btn" @click="addToLink(l, true)">{{ translate("DRIVE.SHARE.LINK.ADD.WRITABLE") }}</button>
									</span>
								</li>
							</ul>
						</div>
					</section>

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
						:host="linkHost"
						:existingProps="existingProps"
						:username="context.username"
					/>
				</div>
				<div v-if="showSpinner" class="pg-dialog__loading"><Spinner></Spinner></div>
			</div>
		</div>
	</transition>
</template>

<script>
const AppIcon = require("../AppIcon.vue");
const Choice = require('../choice/Choice.vue');
const DialogClose = require("../dialog/DialogClose.vue");
const Spinner = require("../spinner/Spinner.vue");
const FormAutocomplete = require("../form/FormAutocomplete.vue");
const SecretLink = require("SecretLink.vue");
const i18n = require("../../i18n/index.js");
const mixins = require("../../mixins/mixins.js");

module.exports = {
	components: {
	    AppIcon,
	    Choice,
	    DialogClose,
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
                    that.customGroupMembers[uid] = members.toArray([]);
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
.drive-share {
	position: relative;
	width: 600px;
}
.drive-share__body {
	display: flex;
	flex-direction: column;
	gap: 22px;
	padding-bottom: 16px;
}
.drive-share__section {
	display: flex;
	flex-direction: column;
	gap: 12px;
	margin: 0;
}
/* the same small caps the secret link dialog labels its sections with */
.drive-share__heading {
	margin: 0;
	font-size: 11px;
	font-weight: var(--bold);
	letter-spacing: .07em;
	text-transform: uppercase;
	color: var(--pg-muted);
}
.drive-share__choice,
.share-groups,
.drive-share__send,
.drive-share__row-actions {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}
.drive-share__groups {
	display: flex;
	flex-direction: column;
	gap: 8px;
}
/* many groups scroll on their own rather than push Share out of reach; the padding gives the
   switches' enlarged touch areas room, so they don't make the box scroll by a few pixels */
.share-groups {
	max-height: 12rem;
	overflow-y: auto;
	padding: 8px;
	margin: -8px;
}
/* the field's own gap below suits a form on its own, not one inside this dialog */
.drive-share .form-autocomplete {
	margin-bottom: 0;
}
.share-groups__count {
	color: var(--pg-muted);
}
.drive-share__send {
	justify-content: flex-end;
}
.drive-share__limit {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px;
}
.drive-share__limit label {
	margin: 0;
	font-size: var(--text-small);
	font-weight: var(--regular);
}
.drive-share__limit input {
	flex: none;
	width: 110px;
}
/* the app's global select rule sets a 300px minimum, a margin and a tall line height */
.drive-share__limit select {
	flex: none;
	width: 5.5em;
	min-width: 0;
	margin: 0;
	line-height: normal;
}
.drive-share__people {
	display: flex;
	flex-direction: column;
	margin: 0;
	padding: 0;
	list-style: none;
	border: 1px solid var(--border-color);
	border-radius: 12px;
}
.drive-share__person,
.drive-share__link {
	padding: 10px 14px;
}
.drive-share__person + .drive-share__person,
.drive-share__link + .drive-share__link {
	border-top: 1px solid var(--pg-track);
}
.drive-share__pick {
	display: flex;
	align-items: center;
	gap: 10px;
	min-width: 0;
	margin: 0;
	font-weight: var(--regular);
}
label.drive-share__pick {
	cursor: pointer;
}
.drive-share__pick input {
	flex: none;
	width: 16px;
	height: 16px;
	margin: 0;
	accent-color: var(--green-500);
}
.share-group-icon {
	flex: none;
}
.drive-share__name {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
	font-size: 15px;
}
.drive-share__quota {
	display: flex;
	flex-direction: column;
	gap: 8px;
}
.drive-share__usage {
	margin: 0;
	font-size: var(--text-small);
}
.drive-share__link {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 12px;
}
.drive-share__link-text {
	display: flex;
	flex-direction: column;
	flex: 1 1 0;
	min-width: 0;
	gap: 2px;
}
.drive-share__meta {
	display: flex;
	flex-wrap: wrap;
	gap: 2px 12px;
	font-size: 13px;
	color: var(--pg-muted);
	overflow-wrap: anywhere;
}
.drive-share__link-actions {
	display: flex;
	flex: none;
	gap: 8px;
}
.add-to-existing {
	display: flex;
	flex-direction: column;
	gap: 10px;
}
</style>
