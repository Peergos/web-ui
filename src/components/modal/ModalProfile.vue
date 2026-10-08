<template>
	<AppModal :title="translate('PROFILE.TITLE')" wide>
		<template #body>
            <Spinner v-if="showSpinner"></Spinner>
		    <Confirm
                v-if="showConfirm"
                v-on:hide-confirm="showConfirm = false"
                :confirm_message='confirm_message'
                :confirm_body="confirm_body"
                :consumer_cancel_func="confirm_consumer_cancel_func"
                :consumer_func="confirm_consumer_func">
            </Confirm>
            <FolderPicker
                v-if="showFolderPicker"
                :baseFolder="folderPickerBaseFolder" :selectedFolder_func="selectedFoldersFromPicker"
                :multipleFolderSelection="multipleFolderSelection"
                :initiallySelectedPaths="initiallySelectedPaths"
                :noDriveSelection="true">
            </FolderPicker>
            <Share
			v-if="showShare"
			v-on:hide-share-with="showShare = false"
			v-on:update-shared-refresh="forceSharedRefreshWithUpdate++"
			:data="sharedWithData"
			:fromApp="fromApp"
			:displayName="displayName"
			:allowReadWriteSharing="allowReadWriteSharing"
			:allowCreateSecretLink="allowCreateSecretLink"
			:files="filesToShare"
			:path="pathToFile"
			:followernames="followernames"
			:friendnames="friendnames"
			:groups="groups"
			:messages="messages">
		    </Share>
			<div class="profile__photo">
				<div class="profile__avatar">
					<img v-if="hasProfileImage()" id="profile-image" alt="Profile image" v-bind:src="getProfileImage()"/>
					<svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>
				</div>
				<div class="profile__photo-actions">
					<button type="button" class="pg-btn" @click="triggerUpload">{{ translate("PROFILE.UPLOAD") }}</button>
					<button v-if="hasProfileImage()" type="button" class="pg-btn" @click="share('photo', 'Profile image')">{{ translate("DRIVE.SHARE") }}</button>
					<button v-if="hasProfileImage()" type="button" class="pg-btn pg-btn--danger" v-on:click="removeImage()">{{ translate("PROFILE.REMOVE") }}</button>
					<input type="file" id="uploadImageInput" @change="uploadImageFile" style="display:none;" accept="image/*" />
				</div>
			</div>
			<div class="profile__grid">
				<div class="app-modal__field">
					<label for="profile-first-name">{{ translate("PROFILE.FIRSTNAME") }}</label>
					<div class="profile__row">
						<input id="profile-first-name" class="pg-input" v-model="firstName" placeholder="First Name" :maxlength="FIRSTNAME_MAX_LENGTH">
						<button v-if="firstNameReadyToBeShared" type="button" class="pg-btn" @click="share('firstname', 'First name')">{{ translate("DRIVE.SHARE") }}</button>
					</div>
				</div>
				<div class="app-modal__field">
					<label for="profile-last-name">{{ translate("PROFILE.LASTNAME") }}</label>
					<div class="profile__row">
						<input id="profile-last-name" class="pg-input" v-model="lastName" placeholder="Last Name" :maxlength="LASTNAME_MAX_LENGTH">
						<button v-if="lastNameReadyToBeShared" type="button" class="pg-btn" @click="share('lastname', 'Last name')">{{ translate("DRIVE.SHARE") }}</button>
					</div>
				</div>
				<div class="app-modal__field">
					<label for="profile-primary-phone">{{ translate("PROFILE.PHONE") }}</label>
					<div class="profile__row">
						<input id="profile-primary-phone" class="pg-input" v-model="primaryPhone" placeholder="Primary Phone Number" :maxlength="PHONE_MAX_LENGTH">
						<button v-if="primaryPhoneReadyToBeShared" type="button" class="pg-btn" @click="share('phone', 'Phone number')">{{ translate("DRIVE.SHARE") }}</button>
					</div>
				</div>
				<div class="app-modal__field">
					<label for="profile-primary-email">{{ translate("PROFILE.EMAIL") }}</label>
					<div class="profile__row">
						<input id="profile-primary-email" class="pg-input" v-model="primaryEmail" placeholder="Primary Email Address" :maxlength="EMAIL_MAX_LENGTH">
						<button v-if="primaryEmailReadyToBeShared" type="button" class="pg-btn" @click="share('email', 'Email address')">{{ translate("DRIVE.SHARE") }}</button>
					</div>
				</div>
			</div>
			<!-- STAUS is how every language file spells this key -->
			<div class="app-modal__field">
				<label for="profile-status">{{ translate("PROFILE.STAUS") }}</label>
				<div class="profile__row">
					<input id="profile-status" class="pg-input" v-model="status" placeholder="Status" :maxlength="STATUS_MAX_LENGTH">
					<button v-if="statusReadyToBeShared" type="button" class="pg-btn" @click="share('status', 'Status message')">{{ translate("DRIVE.SHARE") }}</button>
				</div>
			</div>
			<div class="app-modal__field">
				<label for="profile-biography">{{ translate("PROFILE.BIO") }}</label>
				<div class="profile__row">
					<textarea id="profile-biography" spellcheck="true" class="pg-input" v-model="biography" placeholder="Biography" rows=3 :maxlength="BIO_MAX_LENGTH"></textarea>
					<button v-if="biographyReadyToBeShared" type="button" class="pg-btn" @click="share('bio', 'Biography')">{{ translate("DRIVE.SHARE") }}</button>
				</div>
			</div>
			<div class="app-modal__field">
				<span class="profile__label">
					<label for="profile-web-root">{{ translate("PROFILE.WWW") }}</label>
					<button type="button" class="profile__help" aria-label="What is this?" @click="showPublishHelp()">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 4.9.7c0 1.6-2.4 2.3-2.4 2.3"/><path d="M12 17h.01"/></svg>
					</button>
				</span>
				<div class="profile__row">
					<input readonly id="profile-web-root" class="pg-input" v-model="webRoot" placeholder="Website Directory" :maxlength="WEBROOT_MAX_LENGTH">
					<button type="button" class="pg-btn" @click="openFolderPicker()">{{ translate("PROFILE.CHANGE.WWW") }}</button>
					<button v-if="webRootReadyToBePublished" type="button" class="pg-btn" @click="publishWebroot()">{{ translate("PROFILE.PUBLISH") }}</button>
				</div>
				<p v-if="webRootUrl.length > 0" class="pg-note">{{ translate("PROFILE.PUBLIC") }}: <a v-bind:href="webRootUrl" target="_blank" rel="noopener noreferrer">{{webRootUrl}}</a></p>
			</div>
		</template>
		<template #footer>
			<button type="button" class="pg-btn pg-btn--primary" @click="update()">{{ translate("PROFILE.SAVE") }}</button>
		</template>
	</AppModal>
</template>

<script>
const AppModal = require("AppModal.vue");
const Confirm = require("../confirm/Confirm.vue");
const FolderPicker = require('../picker/FolderPicker.vue');
const Share = require("../drive/DriveShare.vue");
const Spinner = require("../spinner/Spinner.vue");
const i18n = require("../../i18n/index.js");

module.exports = {
    components: {
        AppModal,
        Confirm,
        FolderPicker,
	    Share,
	    Spinner
    },
    mixins:[i18n],
    data: function() {
        return {
            profile:{
                firstName: "",
                lastName: "",
                biography: "",
                primaryPhone: "",
                primaryEmail: "",
                profileImage: "",
                status: "",
                webRoot: ""
            },
            firstName: "",
            firstNameReadyToBeShared: false,
            lastName: "",
            lastNameReadyToBeShared: false,
            biography: "",
            biographyReadyToBeShared: false,
            primaryPhone: "",
            primaryPhoneReadyToBeShared: false,
            primaryEmail: "",
            primaryEmailReadyToBeShared: false,
            profileImage: "",
            status: "",
            statusReadyToBeShared: false,
            webRoot: "",
            webRootReadyToBePublished: false,
            webRootUrl: "",
            previousFirstName: "",
            previousLastName: "",
            previousBiography: "",
            previousPrimaryPhone: "",
            previousPrimaryEmail: "",
            previousStatus: "",
            previousWebRoot: "",
            BIO_MAX_LENGTH: 200,
            STATUS_MAX_LENGTH: 50,
            FIRSTNAME_MAX_LENGTH: 25,
            LASTNAME_MAX_LENGTH: 25,
            PHONE_MAX_LENGTH: 20,
            EMAIL_MAX_LENGTH: 50,
            WEBROOT_MAX_LENGTH: 40,
            showSpinner: false,
            showConfirm: false,
            showShare: false,
            confirm_message: "",
            confirm_body: "",
            confirm_consumer_cancel_func: () => {},
            confirm_consumer_func: () => {},
            showFolderPicker: false,
            folderPickerBaseFolder: "",
            multipleFolderSelection: false,
            initiallySelectedPaths: [],
        }
    },
    props: ['messages'],
    created: function() {
        this.updateProfile();
    },
    computed: {
	...Vuex.mapState([
            'socialData',
            'context',
	]),
        followernames() {
	    return this.socialData.followers;
	},
	friendnames() {
	    return this.socialData.friends;
	},
	followingnames() {
	    return this.socialData.following;
	},
	groups() {
	    return {groupsNameToUid: this.socialData.groupsNameToUid, groupsUidToName: this.socialData.groupsUidToName};
	},
    },
    methods: {
        showMessage: function(isError, title, body) {
            /*this.messages.push({
                title: title,
                body: body,
                show: true
            });*/
            let bodyContents = body == null ? '' : ' ' + body;
            if (isError) {
                this.$toast.error(title + bodyContents, {timeout:false});
            } else {
                this.$toast(title + bodyContents)
            }
        },
        processProfileUpdate: function() {
            this.firstName = this.previousFirstName = this.profile.firstName;
            if (this.firstName.length > 0)
                this.firstNameReadyToBeShared = true;
            this.lastName = this.previousLastName = this.profile.lastName;
            if (this.lastName.length > 0)
                this.lastNameReadyToBeShared = true;
            this.biography = this.previousBiography = this.profile.biography;
            if (this.biography.length > 0)
                this.biographyReadyToBeShared = true;
            this.primaryPhone = this.previousPrimaryPhone = this.profile.primaryPhone;
            if (this.primaryPhone.length > 0)
                this.primaryPhoneReadyToBeShared = true;
            this.primaryEmail = this.previousPrimaryEmail = this.profile.primaryEmail;
            if (this.primaryEmail.length > 0)
                this.primaryEmailReadyToBeShared = true;
            this.status = this.previousStatus = this.profile.status;
            if (this.status.length > 0)
                this.statusReadyToBeShared = true;
            this.webRoot = this.previousWebRoot = this.profile.webRoot;
            if (this.webRoot.length > 0) {
                let that = this;
                let directoryPath = peergos.client.PathUtils.directoryToPath(this.webRoot.split('/'));
                this.context.getPublicFile(directoryPath).thenApply(res => {
                    if(res.isPresent()) {
                        that.webRootReadyToBePublished = false;
                        that.webRootUrl = "https://" + that.context.username+".peergos.me";
                    } else {
                        that.webRootReadyToBePublished = true;
                        that.webRootUrl = "";
                    }
                }).exceptionally(function(throwable) {
                    that.webRootReadyToBePublished = true;
                    that.webRootUrl = "";
                });
            }
            this.profileImage = this.profile.profileImage;
        },
        updateProfile: function() {
            this.showSpinner = true;
            let that = this;
            let context = this.context;
            peergos.shared.user.ProfilePaths.getProfile(context.username, context).thenApply(profile => {
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
                that.processProfileUpdate();
            });
        },
        share: function(field, fieldName) {
            this.shareWith(field, fieldName);
        },
        shareWith: function(field, fieldName) {
            let dirPath = this.context.username + "/.profile/";
            this.showShareWithForFile(dirPath, field, false, false, fieldName);
        },
        showShareWithForFile: function(dirPath, filename, allowReadWriteSharing, allowCreateSecretLink, nameToDisplay) {
            let that = this;
            var context = this.context;
            this.context.getByPath(dirPath)
                .thenApply(function(dir){dir.get().getChild(filename, that.context.crypto.hasher, that.context.network).thenApply(function(child){
                    let file = child.get();
                    if (file == null) {
                        return;
                    }
                    that.filesToShare = [file];
                    that.pathToFile = dirPath.split('/').filter(n => n.length > 0);
                    let directoryPath = peergos.client.PathUtils.directoryToPath(that.pathToFile);
                    context.getDirectorySharingState(directoryPath).thenApply(function(updatedSharedWithState) {
                        let fileSharedWithState = updatedSharedWithState.get(file.getFileProperties().name);
                        let read_usernames = fileSharedWithState.readAccess.toArray([]);
                        let edit_usernames = fileSharedWithState.writeAccess.toArray([]);
                        that.sharedWithData = {read_shared_with_users:read_usernames, edit_shared_with_users:edit_usernames};
                        that.fromApp = true;
                        that.displayName = nameToDisplay != null && nameToDisplay.length > 0 ?
                                                     nameToDisplay : file.getFileProperties().name;
                        that.allowReadWriteSharing = allowReadWriteSharing;
                        that.allowCreateSecretLink = allowCreateSecretLink;
                        that.showShare = true;
                    });
                })});
        },
        triggerUpload: function() {
            document.getElementById('uploadImageInput').click()
        },
        uploadImageFile: function(evt) {
            let files = evt.target.files || evt.dataTransfer.files;
            let file = files[0];
            let that = this;
            let filereader = new FileReader();
            filereader.file_name = file.name;
            let thumbnailWidth = 400;
            let thumbnailHeight = 400;
            filereader.onload = function(){
                let canvas = document.createElement("canvas");
                canvas.width = thumbnailWidth;
                canvas.height = thumbnailHeight;
                let context = canvas.getContext("2d");
                let image = new Image();
                image.onload = function() {
                    context.drawImage(image, 0, 0, thumbnailWidth, thumbnailHeight);
                    let binFilereader = new FileReader();
                    binFilereader.file_name = file.name;
                    binFilereader.onload = function(){
                        const data = convertToByteArray(new Int8Array(this.result));
                        that.profileImage = canvas.toDataURL();
                        let binaryThumbnail = window.atob(that.profileImage.substring("data:image/png;base64,".length));
                        var ta = new Int8Array(binaryThumbnail.length);
                        for (var i = 0; i < binaryThumbnail.length; i++) {
                            ta[i] = binaryThumbnail.charCodeAt(i);
                        }
                        that.updateThumbnail(data, convertToByteArray(ta));
                    };
                    binFilereader.readAsArrayBuffer(file);
                };
                image.onerror = function() {
                    that.showMessage(true, that.translate("PROFILE.ERROR.IMAGE"));
                };
                image.src = this.result;
            };
            filereader.readAsDataURL(file);
        },
        getProfileImage: function() {
            return this.profileImage;
        },
        hasProfileImage: function() {
            return this.profileImage.length > 0;
        },
        removeImage: function() {
            this.profileImage = "";
            this.updateThumbnail(peergos.shared.user.JavaScriptPoster.emptyArray(), peergos.shared.user.JavaScriptPoster.emptyArray());
        },
        update: function() {
            var that = this;
            let changes = [];
            let context = this.context;
            if (this.firstName != this.previousFirstName) {
                changes.push({func: function(){
                        var future = peergos.shared.util.Futures.incomplete();
                        peergos.shared.user.ProfilePaths.setFirstName(context, that.firstName).thenApply(res => {
                            if(res) {
                                that.previousFirstName = that.firstName;
                                if (that.firstName.length == 0) {
                                    that.firstNameReadyToBeShared = false;
                                } else {
                                    that.firstNameReadyToBeShared = true;
                                }
                            }
                            future.complete(res);
                        });
                        return future;
                    }
                });
            }
            if (this.lastName != this.previousLastName) {
                changes.push({func: function(){
                        var future = peergos.shared.util.Futures.incomplete();
                        peergos.shared.user.ProfilePaths.setLastName(context, that.lastName).thenApply(res => {
                            if(res) {
                                that.previousLastName = that.lastName;
                                if (that.lastName.length == 0) {
                                    that.lastNameReadyToBeShared = false;
                                } else {
                                    that.lastNameReadyToBeShared = true;
                                }
                            }
                            future.complete(res);
                        });
                        return future;
                    }
                });
            }
            if (this.biography != this.previousBiography) {
                changes.push({func: function(){
                        var future = peergos.shared.util.Futures.incomplete();
                        peergos.shared.user.ProfilePaths.setBio(context, that.biography).thenApply(res => {
                            if(res) {
                                that.previousBiography = that.biography;
                                if (that.biography.length == 0) {
                                    that.biographyReadyToBeShared = false;
                                } else {
                                    that.biographyReadyToBeShared = true;
                                }
                            }
                            future.complete(res);
                        });
                        return future;
                    }
                });
            }
            if (this.primaryPhone != this.previousPrimaryPhone) {
                changes.push({func: function(){
                        var future = peergos.shared.util.Futures.incomplete();
                        peergos.shared.user.ProfilePaths.setPhone(context, that.primaryPhone).thenApply(res => {
                            if(res) {
                                that.previousPrimaryPhone = that.primaryPhone;
                                if (that.primaryPhone.length == 0) {
                                    that.primaryPhoneReadyToBeShared = false;
                                } else {
                                    that.primaryPhoneReadyToBeShared = true;
                                }
                            }
                            future.complete(res);
                        });
                        return future;
                    }
                });
            }
            if (this.primaryEmail != this.previousPrimaryEmail) {
                changes.push({func: function(){
                        var future = peergos.shared.util.Futures.incomplete();
                        peergos.shared.user.ProfilePaths.setEmail(context, that.primaryEmail).thenApply(res => {
                            if(res) {
                                that.previousPrimaryEmail = that.primaryEmail;
                                if (that.primaryEmail.length == 0) {
                                    that.primaryEmailReadyToBeShared = false;
                                } else {
                                    that.primaryEmailReadyToBeShared = true;
                                }
                            }
                            future.complete(res);
                        });
                        return future;
                    }
                });
            }
            if (this.status != this.previousStatus) {
                changes.push({func: function(){
                        var future = peergos.shared.util.Futures.incomplete();
                        peergos.shared.user.ProfilePaths.setStatus(context, that.status).thenApply(res => {
                            if(res) {
                                that.previousStatus = that.status;
                                if (that.status.length == 0) {
                                    that.statusReadyToBeShared = false;
                                } else {
                                    that.statusReadyToBeShared = true;
                                }
                            }
                            future.complete(res);
                        });
                        return future;
                    }
                });
            }
            if (this.webRoot == this.previousWebRoot) {
                this.saveChanges(changes); // save other changes
            } else {
                var updatedPath = this.webRoot.trim();
                let changeWebRootFunc = function(){
                    var publishFuture = peergos.shared.util.Futures.incomplete();
                    var unPublishFuture = peergos.shared.util.Futures.incomplete();
                    if (that.webRootUrl.length > 0) {
                        that.unpublishWebroot(unPublishFuture);
                    } else {
                        unPublishFuture.complete(true);
                    }
                    unPublishFuture.thenApply(done => {
                        peergos.shared.user.ProfilePaths.setWebRoot(context, updatedPath).thenApply(res => {
                            that.$emit("update-refresh");
                            if(res) {
                                that.webRoot = updatedPath;
                                that.previousWebRoot = updatedPath;
                                if (updatedPath.length != 0) {
                                    that.webRootReadyToBePublished = true;
                                }
                            }
                            publishFuture.complete(res);
                        });
                    });
                    return publishFuture;
                }
                changes.push({func: changeWebRootFunc});
                this.saveChanges(changes);
            }
        },
        unpublishWebroot: function(future) {
            let that = this;
            peergos.shared.user.ProfilePaths.unpublishWebRoot(this.context).thenApply(function(success){
                that.$emit("update-refresh");
                that.webRootUrl = "";
                future.complete(true);
            });
        },
        showPublishHelp: function(future) {
            var text = this.translate("PROFILE.PUBLISH.HELP")
                .replace("$NAME", this.context.username)
                .replace("$NAME", this.context.username);
            this.showMessage(false, "Website Directory", text);
        },
        publishWebroot: function() {
            let that = this;
            if (this.webRoot.length > 0) {
                this.confirm_message=this.translate("PROFILE.CONFIRM.PUBLISH").replace("$PATH", this.webRoot);
                this.confirm_body=this.translate("PROFILE.CONFIRM.PUBLISH.TEXT");
                this.confirm_consumer_cancel_func = () => { that.showConfirm = false;};
                this.confirm_consumer_func = function() {
                    that.showConfirm = false;
                    that.showSpinner = true;
                    try {
                        let dirPath = peergos.client.PathUtils.directoryToPath(that.webRoot.split('/'));
                        that.context.getByPath(dirPath.toString()).thenApply(function(dirOpt){
                            if (dirOpt.isEmpty()) {
                                that.showMessage(true, that.translate("PROFILE.ERROR.PUBLISH"), that.translate("PROFILE.ERROR.NOT.FOUND"));
                            } else {
                                peergos.shared.user.ProfilePaths.publishWebroot(that.context).thenApply(function(success){
                                    that.showSpinner = false;
                                    that.$emit("update-refresh");
                                    if (success) {
                                        that.showMessage(false, that.translate("PROFILE.PUBLISH.SUCCESS"),
                                                         that.translate("PROFILE.PUBLISH.AVAILABLE")
                                                         .replace("$NAME", that.context.username));
                                        that.webRootUrl = "https://" + that.context.username + ".peergos.me";
                                        that.webRootReadyToBePublished = false;
                                    } else {
                                        that.showMessage(true, that.translate("PROFILE.ERROR.PUBLISH"), "");
                                    }
                                }).exceptionally(function(throwable) {
                                  that.showMessage(true, that.translate("PROFILE.ERROR.PUBLISH"), throwable.getMessage());
                                  console.log(throwable.getMessage());
                                  that.showSpinner = false;
                                });
                            }
                        });
                    } catch (pathException) {
                        that.showMessage(true, that.translate("PROFILE.ERROR.PUBLISH"), that.translate("PROFILE.ERROR.PATH"));
                        that.showSpinner = false;
                    }
                };
                this.showConfirm = true;
            }
        },
        updateThumbnail: function(hires, thumbnail) {
            let that = this;
            that.showSpinner = true;

            peergos.shared.user.ProfilePaths.setHighResProfilePhoto(that.context, hires).thenApply(function(success){
                peergos.shared.user.ProfilePaths.setProfilePhoto(that.context, thumbnail).thenApply(function(success){
                    that.showSpinner = false;
                    that.$emit("update-refresh");
                }).exceptionally(function(throwable) {
                  that.showMessage(true, that.translate("PROFILE.ERROR.UNEXPECTED"), throwable.getMessage());
                  console.log(throwable.getMessage());
                  that.showSpinner = false;
                  that.$emit("update-refresh");
                });
            }).exceptionally(function(throwable) {
              that.showMessage(true, that.translate("PROFILE.ERROR.UNEXPECTED"), throwable.getMessage());
              console.log(throwable.getMessage());
              that.showSpinner = false;
            });
        },
        openFolderPicker: function() {
            let that = this;
            this.folderPickerBaseFolder = "/" + this.context.username;
            let updatedPath = this.webRoot.trim();

            this.selectedFoldersFromPicker = function (chosenFolders) {
                if (chosenFolders.length == 0) {
                    that.webRoot = "";
                    that.webRootReadyToBePublished = false;
                } else {
                    that.webRoot = chosenFolders[0].substring(1);
                    if (updatedPath != that.webRoot) {
                        that.webRootReadyToBePublished = false;
                    }
                }
                that.showFolderPicker = false;
            };
            this.initiallySelectedPaths = [];
            if (updatedPath.length > 0) {
                this.context.getByPath(updatedPath).thenApply(function(dir) {
                        if (dir.ref != null) {
                            let file = dir.get();
                            let props = file.getFileProperties();
                            if (!props.isHidden && props.isDirectory) {
                                that.initiallySelectedPaths.push("/" + updatedPath);
                            }
                        }
                        that.showFolderPicker = true;
                });
            } else {
                this.showFolderPicker = true;
            }
        },
        saveChanges: function(changes) {
            if (changes.length == 0) {
                return;
            }
            let that = this;
            this.showSpinner = true;
            this.reduceAll(changes);
        },
         reduceAll: function(changes) {
            let that = this;
            let func = changes.pop();
            if(func == null) {
                that.showMessage(false, that.translate("PROFILE.UPDATED"));
                that.showSpinner = false;
                that.$emit("update-refresh");
                return;
            } else {
                func.func().thenApply(function(success) {
                    if(success) {
                        that.reduceAll(changes);
                    } else {
                        that.showMessage(true, that.translate("PROFILE.ERROR.UPDATE"));
                        that.showSpinner = false;
                    }
                }).exceptionally(function(throwable) {
                    that.showMessage(true, that.translate("PROFILE.ERROR.UNEXPECTED"), throwable.getMessage());
                    that.showSpinner = false;
                });
            }
         }
    }
}
</script>
<style>
/* The picture beside what can be done with it, then each detail with its label above it and,
   once saved, a way to share just that detail. Name, phone and email pair up where there is room. */
.profile__photo {
	display: flex;
	align-items: center;
	gap: 16px;
}

.profile__avatar {
	display: flex;
	align-items: center;
	justify-content: center;
	flex: none;
	width: 88px;
	height: 88px;
	border-radius: 50%;
	overflow: hidden;
	color: var(--pg-muted);
	background-color: var(--pg-surface-2);
}

.profile__avatar img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.profile__avatar svg {
	width: 44px;
	height: 44px;
}

.profile__photo-actions {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}

.profile__grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
	gap: 14px 16px;
}

.profile__row {
	display: flex;
	gap: 8px;
	align-items: flex-start;
}

.profile__row .pg-input {
	flex: 1 1 auto;
	min-width: 0;
}

.profile__row .pg-btn {
	flex: none;
}

.profile__label {
	display: flex;
	align-items: center;
	gap: 4px;
}

.profile__help {
	display: flex;
	padding: 2px;
	color: var(--pg-muted);
	background: none;
	border: 0;
	border-radius: 50%;
	cursor: pointer;
}

.profile__help svg {
	width: 16px;
	height: 16px;
}

.profile__help:focus-visible {
	outline: 2px solid var(--green-500);
	outline-offset: 2px;
}
</style>
