<template>
<transition name="modal">
    <div class="modal-mask" @click="closeAppFromToolbar">
        <div class="modal-container full-height" @click.stop style="width:100%;overflow-y:auto;padding:0;display:flex;flex-flow:column;">
        <Group
                v-if="showGroupMembership"
                v-on:hide-group="closeGroupMembership"
                :groupId="groupId"
                :groupTitle="groupTitle"
                :existingGroupMembers="existingGroupMembers"
                :existingAdmins="existingAdmins"
                :friendNames="friendnames"
                :updatedGroupMembership="updatedGroupMembership"
                :existingGroups="existingGroups"
                :isTemplateApp="isTemplateApp">
        </Group>
        <ViewProfile
            v-if="showProfileViewForm"
            v-on:hide-profile-view="showProfileViewForm = false"
            :profile="profile">
        </ViewProfile>
        <AddToChat
                v-if="showInviteFriends"
                v-on:hide-add-to-chat="showInviteFriends = false"
                :appDisplayName="appDisplayName"
                :maxFriendsToAdd="maxFriendsToAdd"
                :chatTitle="chatTitle"
                :friendNames="friendnames"
                :updateChat="updateChat">
        </AddToChat>
        <FilePicker
            v-if="showFilePicker"
            :baseFolder="filePickerBaseFolder"
            :pickerFileExtension="pickerFileExtension"
            :pickerFilterMedia="pickerFilterMedia"
            :pickerFilters="pickerFilters"
            :pickerShowThumbnail="pickerShowThumbnail"
            :selectedFile_func="selectedFileFromPicker"
            :noDriveSelection="noDriveSelection"
        />
        <FolderPicker
            v-if="showFolderPicker"
            :baseFolder="folderPickerBaseFolder"
            :selectedFolder_func="selectedFoldersFromPicker"
            :multipleFolderSelection="multipleFolderSelection"
            :initiallySelectedPaths="initiallySelectedPaths">
        </FolderPicker>
        <AppPrompt
            v-if="showPrompt"
            @hide-prompt="closePrompt()"
            :message='prompt_message'
            :placeholder="prompt_placeholder"
            :max_input_size="prompt_max_input_size"
            :value="prompt_value"
            :consumer_func="prompt_consumer_func"
            :action="prompt_action"
        />
            <AppTemplatePrompt
              v-if="showAppTemplatePrompt"
              @hide-prompt="closeAppTemplatePrompt_func"
              :message="app_prompt_message"
              :placeholder="app_prompt_placeholder"
              :max_input_size="app_prompt_max_input_size"
              :value="app_prompt_value"
              :consumer_func="app_prompt_consumer_func"
              :action="app_prompt_action"
              :appIconBase64Image="appIconBase64Image"
            />
            <AppInstall
                v-if="showAppInstallation"
                v-on:hide-app-installation="closeAppInstallation"
                :appInstallSuccessFunc="appInstallSuccess"
                :appPropsFile="appInstallPropsFile"
                :installFolder="appInstallFolder">
            </AppInstall>
            <Gallery
                v-if="showEmbeddedGallery"
                v-on:hide-gallery="showEmbeddedGallery = false"
                :files="filesToViewInGallery"
                :hideGalleryTitle="true"
                :context="context">
            </Gallery>
            <Confirm
                    v-if="showConfirm"
                    v-on:hide-confirm="showConfirm = false"
                    :confirm_message='confirm_message'
                    :confirm_body="confirm_body"
                    :consumer_cancel_func="confirm_consumer_cancel_func"
                    :consumer_func="confirm_consumer_func">
            </Confirm>
            <Note v-if="showNote"
                v-on:remove-note="closeNote()"
                :title="noteTitle"
                :note="noteContents">
            </Note>
            <SaveConflict
                v-if="showSaveConflictPrompt"
                :currentContentsBytes="currentSaveConflictBytes"
                :consumer_save_func="save_conflict_consumer_func"
                :consumer_close_func="close_conflict_consumer_func"
                :consumer_cancel_func="cancel_conflict_consumer_func"
            />
            <NewFilePicker
                v-if="showNewFilePicker"
                @hide-prompt="closeNewFilePicker()"
                :pickerFileExtension="newFileExtension"
                :initialFilename="initialNewFilename"
                :consumer_func="file_picker_consumer_func"
            />
            <div v-if="!fullscreenMode" class="modal-header" style="padding:0;min-height: 52px;">
                <center><h2>
                <span v-if="browserMode && !isSecretLink && fullPathForDisplay.length > 0" style="z-index:9999">
                      <img v-if="displayToBookmark" src="./images/bookmark-o.svg" @click="toggleBookmark(false)" style="height:24px;width:24px;cursor:pointer;">
                      <img v-if="!displayToBookmark" src="./images/bookmark.svg" @click="toggleBookmark(true)" style="height:24px;width:24px;cursor:pointer;">
                </span>
                {{ getFullPathForDisplay() }}
                <span v-if="displayFullScreenIcon" @click="requestFullscreenFromToolbar" v-on:keyup.enter="requestFullscreenFromToolbar" style="cursor:pointer;">
                    <img src="./images/arrows-alt.svg" style="height:24px;width:24px;cursor:pointer">
                </span>
                </h2>
                </center>
              <span style="position:absolute;top:0;right:0.2em;">
                <span @click="closeAppFromToolbar" tabindex="0" v-on:keyup.enter="closeAppFromToolbar" style="color:black;font-size:3em;font-weight:bold;cursor:pointer;font-family:'Cambria Math'">&times;</span>
              </span>
            </div>
            <div>
                <iframe id="print-data-container" style="display:none" aria-hidden="true" tabindex="-1"></iframe>
            </div>
            <div id='sandbox-container' class="modal-body" style="margin:0;padding:0;display:flex;flex-grow:1;">
            </div>
            <Spinner v-if="showSpinner" :message="spinnerMessage"></Spinner>
        </div>
    </div>
</transition>
</template>

<script>
const AddToChat = require("AddToChat.vue");
const AppInstall = require("AppInstall.vue");
const AppPrompt = require("../prompt/AppPrompt.vue");
const AppTemplatePrompt = require("../prompt/AppTemplatePrompt.vue");
const Confirm = require("../confirm/Confirm.vue");
const FilePicker = require('../picker/FilePicker.vue');
const FolderPicker = require('../picker/FolderPicker.vue');
const Gallery = require("../drive/DriveGallery.vue");
const Group = require("../Group.vue");
const NewFilePicker = require("../picker/NewFilePicker.vue");
const Note = require("../message/Note.vue");
const ProgressBar = require("../drive/ProgressBar.vue");
const SaveConflict = require("../prompt/SaveConflict.vue");
const Spinner = require("../spinner/Spinner.vue");
const ViewProfile = require("../profile/ViewProfile.vue");


const mixins = require("../../mixins/mixins.js");
const downloaderMixins = require("../../mixins/downloader/index.js");
const router = require("../../mixins/router/index.js");
const sandboxMixin = require("../../mixins/sandbox/index.js");
const launcherMixin = require("../../mixins/launcher/index.js");
const UriDecoder = require('../../mixins/uridecoder/index.js');

module.exports = {
	mixins:[mixins, downloaderMixins, router, sandboxMixin, launcherMixin, UriDecoder],
    components: {
        AddToChat,
        AppInstall,
        AppPrompt,
        AppTemplatePrompt,
        Confirm,
        FilePicker,
        FolderPicker,
        Group,
        Gallery,
        NewFilePicker,
        Note,
        ProgressBar,
        SaveConflict,
        Spinner,
        ViewProfile,
    },
    data: function() {
        return {
            showSpinner: false,
            spinnerMessage: '',
            maxBlockSize: 1024 * 1024 * 5,
            sandboxedApp: null,
            FILE_NOT_FOUND: 2,
            ACTION_FAILED: 3,
            DELETE_SUCCESS: 4,
            DIRECTORY_NOT_FOUND: 5,
            CREATE_SUCCESS: 6,
            UPDATE_SUCCESS: 7,
            GET_SUCCESS: 8,
            PATCH_SUCCESS: 9,
            NAVIGATE_TO: 10,
            isIframeInitialised: false,
            appPath: '',
            appSubdomain: '',
            isAppPathAFolder: false,
            permissionsMap: new Map(),
            PERMISSION_STORE_APP_DATA: 'STORE_APP_DATA',
            PERMISSION_EDIT_CHOSEN_FILE: 'EDIT_CHOSEN_FILE',
            PERMISSION_READ_CHOSEN_FOLDER: 'READ_CHOSEN_FOLDER',
            PERMISSION_EXCHANGE_MESSAGES_WITH_FRIENDS: 'EXCHANGE_MESSAGES_WITH_FRIENDS',
            PERMISSION_USE_MAILBOX: 'USE_MAILBOX',
            PERMISSION_ACCESS_PROFILE_PHOTO: 'ACCESS_PROFILE_PHOTO',
            PERMISSION_CSP_UNSAFE_EVAL: 'CSP_UNSAFE_EVAL',
            browserMode: false,
            fullPathForDisplay: '',
            launcherApp: null,
            running: false,
            workspaceName: '',
            navigateTo: null,
            appProperties: null,
            appRegisteredWithFileAssociation: false,
            appRegisteredWithWildcardFileAssociation : false,
            targetFile: null,
            apiRequest: "/peergos-api/v0",
            recreateFileThumbnailOnClose : false,
            currentChatId: '',
            showInviteFriends: false,
            appDisplayName: '',
            chatResponseHeader: null,
            showPrompt: false,
            prompt_message: '',
            prompt_placeholder: '',
            prompt_max_input_size: null,
            prompt_value: '',
            prompt_consumer_func: () => {},
            prompt_action: 'ok',
            isSaveActionEnabled: true,
            isAppGalleryMode: false,
            showAppInstallation: false,
            appInstallPropsFile: null,
            appInstallFolder: '',
            currentAppName: null,
            showFolderPicker: false,
            folderPickerBaseFolder: "",
            multipleFolderSelection: true,
            initiallySelectedPaths: [],
            filePickerBaseFolder: "",
            selectedFolders: [],
            selectedFolderStems: [],
            showFilePicker: false,
            selectedFileFromPicker: null,
            pickerFileExtension: "",
            pickerFilterMedia: false,
            pickerFilters: null,
            pickerShowThumbnail: false,
            commandQueue: [],
            executingCommands: false,
            commandFileRefs: new Map(),
            messenger: null,
            groupId: "",
            groupTitle: "",
            showGroupMembership: false,
            existingGroupMembers: [],
            existingAdmins: [],
            progressMonitors: [],
            showProfileViewForm:false,
            profile: {
                firstName: "",
                lastName: "",
                biography: "",
                primaryPhone: "",
                primaryEmail: "",
                profileImage: "",
                status: "",
                webRoot: "",
            },
            showEmbeddedGallery: false,
            filesToViewInGallery: [],
            isFileViewerMode: false, //run app from app store
            displayFullScreenIcon: false,
            fullscreenMode: false,
            mailboxFolderPrefix: 'default',
            mailboxClientProperties: null,
            clientMailboxAddress: "",
            mailboxClient: null,
            MAILBOX_CONFIG_FILENAME: 'App.config',
            EMAIL_FILE_EXTENSION: '.cbor',
            messageToTimestamp: new Map(),
            showConfirm: false,
            confirm_message: "",
            confirm_body: "",
            confirm_consumer_cancel_func: () => {},
            confirm_consumer_func: () => {},
            displayToBookmark: true,
            pickerSelectedFile: "",
            isTemplateApp: false,
            showAppTemplatePrompt: false,
            closeAppTemplatePrompt_func: () => {},
            app_prompt_message: "",
            app_prompt_placeholder: "",
            app_prompt_max_input_size: -1,
            app_prompt_value: "",
            app_prompt_consumer_func: () => {},
            app_prompt_action: 'ok',
            appIconBase64Image: "",
            noDriveSelection: true,
            showNote: false,
            noteTitle: "",
            noteContents: "",
            showSaveConflictPrompt: false,
            save_conflict_consumer_func: (bytes) => { },
            currentSaveConflictBytes: null,
            showNewFilePicker: false,
            file_picker_consumer_func: () => { },
            initialNewFilename: '',
            newFileExtension: '',
            closeNewFilePicker: () => { },
        }
    },
    computed: {
        ...Vuex.mapState([
            'quotaBytes',
            'usageBytes',
            'context',
            "sandboxedApps",
            'mirrorBatId',
            "socialData",
            "shortcuts"
        ]),
        ...Vuex.mapGetters([
            'isSecretLink',
            'getPath',
            'isMobile'
        ]),
        friendnames: function() {
            return this.socialData.friends;
        }
    },
    props: ['sandboxAppName', 'currentFile', 'currentPath', 'currentProps', 'sandboxAppChatId', 'htmlAnchor'],
    created: function() {
        let that = this;
        this.messenger = new peergos.shared.messaging.Messenger(this.context);
        this.currentAppName = this.sandboxAppName;
        let currentFilename = this.currentFile == null ? '' : this.currentFile.getName();
        var path = '';
        if (this.currentPath != null) {
            path = this.currentPath.endsWith('/') ? this.currentPath : this.currentPath + '/';
        }
        this.appPath = this.currentFile == null ? '' : path + currentFilename;
        if (this.currentAppName == 'htmlviewer') {
            this.browserMode = true;
            this.workspaceName = this.extractWorkspace(this.appPath);
        }else if (this.currentAppName == '$$app-gallery$$') {
            this.currentAppName = 'htmlviewer'
            this.browserMode = true;
            this.isAppGalleryMode = true;
            this.workspaceName = this.extractWorkspace(this.appPath);
        } else {
            if (this.currentProps != null && this.currentFile == null) {
                this.workspaceName = this.getPath;
            } else if (this.currentProps != null && this.currentFile != null) {
                this.isFileViewerMode = true;
                this.workspaceName = "/peergos/recommended-apps/" + this.currentAppName;
            } else {
                this.workspaceName = this.context.username + "/.apps/" + this.currentAppName;
            }
        }
        if (this.currentFile != null) {
            this.targetFile = this.currentFile;
            if (this.currentFile.getFileProperties().isDirectory) {
                this.isAppPathAFolder = true;
            } else {
                let props = this.targetFile.getFileProperties();
                let filename = props.name.toLowerCase();
                if (filename.endsWith('jpg') || filename.endsWith('png')) {
                    this.recreateFileThumbnailOnClose = this.targetFile.isWritable();
                }
            }
        }
        if (!this.appSandboxIsCrossOriginIsolated()) {
            this.fatalError('Cannot create secure app sandbox. Browser reports window.crossOriginIsolated=false');
        } else if (!this.appSandboxSupportAvailable()) {
            this.giveUp();
        } else {
            if (this.isSecretLink) {
                that.getAppSubdomain().thenApply(appSubdomain => {
                    that.appSubdomain = appSubdomain;
                    if (that.isFileViewerMode) {
                        that.appProperties = that.currentProps;
                        that.appRegisteredWithFileAssociation = that.appHasFileAssociation(that.currentProps);
                        that.appRegisteredWithWildcardFileAssociation = that.appHasWildcardFileRegistration(that.currentProps);
                    }
                    that.start();
                });
            } else {
                this.loadAppProperties().thenApply(props => {
                    if (props == null) {
                        that.fatalError('Application properties not found');
                    } else if (!that.validatePermissions(props)) {
                        that.fatalError('Application configuration error. See console for further details');
                    } else {
                        that.appProperties = props;
                        that.appRegisteredWithFileAssociation = that.appHasFileAssociation(props);
                        that.appRegisteredWithWildcardFileAssociation = that.appHasWildcardFileRegistration(props);
                        if (props.template.length > 0) {
                            that.currentChatId = props.chatId;
                            that.isTemplateApp = true;
                        } else {
                            that.currentChatId = that.sandboxAppChatId != null ? that.sandboxAppChatId : '';
                        }
                        peergos.shared.user.App.init(that.context, that.currentAppName).thenApply(sandboxedApp => {
                            that.sandboxedApp = sandboxedApp;
                            that.getAppSubdomain().thenApply(appSubdomain => {
                                that.appSubdomain = appSubdomain;
                                if (that.permissionsMap.get(that.PERMISSION_USE_MAILBOX)) {
                                    that.isMailboxPendingDirectoryCreated().thenApply(isInit => {
                                        if (! isInit) {
                                            that.initialiseMailBox();
                                        } else {
                                            peergos.shared.email.EmailClient.load(sandboxedApp, that.context.crypto, that.context).thenApply(client => {
                                                that.mailboxClient = client;
                                                client.getEmailAddress().thenApply(clientAddress => {
                                                    if (clientAddress.ref == null) {
                                                        that.showToastError("Awaiting approval from " + that.currentAppName + " Mailbox Administrator");
                                                        that.closeSandbox();
                                                    } else {
                                                        that.clientMailboxAddress = clientAddress.ref.toLowerCase();
                                                        that.getMailboxPropertiesFile().thenApply(props => {
                                                            that.mailboxClientProperties = props;
                                                            that.start();
                                                        });
                                                    }
                                                });
                                            });
                                        }
                                    });
                                } else {
                                    that.start();
                                }
                            });
                        });
                    }
                });
            }
        }
    },
    methods: {
        getMailboxPropertiesFile: function() {
            let that = this;
            let filePath = peergos.client.PathUtils.directoryToPath([this.mailboxFolderPrefix, this.MAILBOX_CONFIG_FILENAME]);
            return that.sandboxedApp.readInternal(filePath).thenApply(data => {
                return JSON.parse(new TextDecoder().decode(data));
            }).exceptionally(function(throwable) {//File not found
                if (throwable.detailMessage.startsWith("File not found")) {
                    let props = new Object();
                    props.userFolders = [];
                    return props;
                } else {
                    that.showError("Unable to load mailbox config file","Please close app and try again");
                }
            });
        },
        closeNote: function() {
            this.showNote = false;
            this.closeSandbox();
        },
        initialiseMailBox: function() {
            let that = this;
            that.showSpinner = true;
            that.spinnerMessage = "Creating mailbox folders";
            peergos.shared.email.EmailClient.load(that.sandboxedApp, that.context.crypto).thenApply(client => {
                client.connectToBridge(that.context).thenApply(secretLink => {
                    that.showSpinner = false;
                    that.spinnerMessage = "";
                    let secretLinkText = secretLink.toLink();
                    let title = "Please provide the below text securely to the " + that.currentAppName + " Mailbox Administrator";
                    that.noteTitle = title;
                    that.noteContents = secretLinkText;
                    that.showNote = true;
                });
            });
        },
        isMailboxPendingDirectoryCreated: function() {
            let path = peergos.client.PathUtils.directoryToPath([this.mailboxFolderPrefix, 'pending']);
            let future = peergos.shared.util.Futures.incomplete();
            this.sandboxedApp.dirInternal(path).thenApply(files => {
                let filesArray = files.toArray([]);
                future.complete(filesArray.length != 0);
            });
            return future;
        },
        closeGroupMembership() {
            let that = this;
            Vue.nextTick(function() {
                that.showGroupMembership = false;
                Vue.nextTick(function() {
                    that.buildResponse(that.chatResponseHeader, null, that.ACTION_FAILED);
                });
            });
        },
        appInstallSuccess(appName) {
        },
        closeAppInstallation() {
            this.showAppInstallation = false;
        },
        appSandboxSupportAvailable() {
            return this.supportsStreaming();
        },
        appSandboxIsCrossOriginIsolated() {
            return window.crossOriginIsolated;
        },
        getMirrorBatId(file) {
            return file.getOwnerName() == this.context.username ? this.mirrorBatId : java.util.Optional.empty()
        },
        appHasFileAssociation: function(props) {
            return props.fileExtensions.length > 0
                || props.mimeTypes.length > 0
                || props.fileTypes.length > 0;
        },
        appHasWildcardFileRegistration: function(props) {
            let matchOnFileExtension = this.sandboxedApps.appFileExtensionWildcardRegistrationList
                        .filter(a => a.name == props.name);
            if (matchOnFileExtension.length > 0) {
                return true;
            }
            let matchOnMimeType = this.sandboxedApps.appMimeTypeWildcardRegistrationList
                        .filter(a => a.name == props.name);
            if (matchOnMimeType.length > 0) {
                return true;
            }
            let matchOnFileType = this.sandboxedApps.appFileTypeWildcardRegistrationList
                        .filter(a => a.name == props.name);
            if (matchOnFileType.length > 0) {
                return true;
            }
            return false;
        },
        getAppSubdomain: function() {
            let that = this;
            var future = peergos.shared.util.Futures.incomplete();
            if (this.currentAppName == 'htmlviewer') {
                peergos.shared.user.App.getAppSubdomainWithAnonymityClass(that.workspaceName, this.appPath, that.context.crypto.hasher).thenApply(appSubdomain => {
                    future.complete(appSubdomain);
                });
            } else {
                peergos.shared.user.App.getAppSubdomain(that.workspaceName, that.context.crypto.hasher).thenApply(appSubdomain => {
                    future.complete(appSubdomain);
                });
            }
            return future;
        },
        extractWorkspace: function(path) {
                return path.substring(1, path.indexOf('/', 1));
        },
        loadAppProperties: function(appFolderLocation) {
           let that = this;
           var future = peergos.shared.util.Futures.incomplete();
           if (this.currentProps != null) {
                future.complete(this.currentProps);
           } else {
                this.readAppProperties(that.currentAppName, appFolderLocation).thenApply(props => {
                    future.complete(props);
                });
            }
            return future;
        },
        getFullPathForDisplay: function() {
            let pathToDisplay = this.fullPathForDisplay;
            if (pathToDisplay.length > 0 && this.browserMode && !this.isMobile) {
                this.displayFullScreenIcon = true;
            }
            return pathToDisplay;
        },
        toggleBookmark: function(remove) {
            if(this.showSpinner || this.isSecretLink) {
                return;
            }
            let that = this;
            let address = this.fullPathForDisplay;
            if (address.length <= 1) {
                return;
            }
            let bookmark = this.shortcuts.shortcutsMap.get(address);
            let fileCreatedDate = new Date(this.targetFile.getFileProperties().created.toString() + "+00:00")
            if (remove) {
                if (bookmark != null) {
                    this.refreshAndDeleteBookmark(address);
                }
            } else {
                if (bookmark == null) {
                    this.refreshAndAddBookmark(address, fileCreatedDate);
                }
            }
        },
        refreshAndAddBookmark(link, created) {
            let that = this;
            this.showSpinner = true;
            this.loadShortcutsFile(this.launcherApp).thenApply(shortcutsMap => {
                if (shortcutsMap.get(link) == null) {
                    let entry = {added: new Date(), created: created};
                    shortcutsMap.set(link, entry)
                    that.updateShortcutsFile(that.launcherApp, shortcutsMap).thenApply(res => {
                        that.showSpinner = false;
                        that.displayToBookmark = false;
                        that.$store.commit("SET_SHORTCUTS", shortcutsMap);
                    });
                } else {
                    that.showSpinner = false;
                }
            })
        },
        refreshAndDeleteBookmark(link) {
            let that = this;
            this.showSpinner = true;
            this.loadShortcutsFile(this.launcherApp).thenApply(shortcutsMap => {
                if (shortcutsMap.get(link) != null) {
                    shortcutsMap.delete(link)
                    that.updateShortcutsFile(that.launcherApp, shortcutsMap).thenApply(res => {
                        that.showSpinner = false;
                        that.displayToBookmark = true;
                        that.$store.commit("SET_SHORTCUTS", shortcutsMap);
                    });
                } else {
                    that.showSpinner = false;
                }
            })
        },
        validatePermissions: function(props) {
            let allPermissions = new Map();
            props.permissions.forEach(permission => {
                allPermissions.set(permission, new Date());
            });
            this.permissionsMap = allPermissions;
            if (!props.folderAction && this.isAppPathAFolder) {
                console.log('App configured as NOT a FolderAction, but Path is a folder!');
                return false;
            }
            if (props.folderAction && !this.isAppPathAFolder) {
                console.log('App configured as a FolderAction, but Path is not a folder!');
                return false;
            }
            if (this.isAppPathAFolder) {
                if (!this.permissionsMap.get(this.PERMISSION_READ_CHOSEN_FOLDER)) {
                    console.log('App configured as a FolderAction, but permission READ_CHOSEN_FOLDER not set!');
                    return false;
                }
                this.isSaveActionEnabled = false;
            }
            if (props.template == 'messaging' && !this.permissionsMap.get(this.PERMISSION_EXCHANGE_MESSAGES_WITH_FRIENDS)) {
                console.log('App configured as a Template, but permission EXCHANGE_MESSAGES_WITH_FRIENDS not set!');
                return false;
            }
            return true;
        },
    	giveUp: function() {
            this.fatalError('Unable to start sandbox. Are you running incognito mode? Perhaps restart browser');
    	},
        fatalError: function(msg) {
            this.showError(msg);
            this.closeSandbox();
        },
        frameUrl: function() {
            let url= this.frameDomain() + "/sandbox.html";
            return url;
        },
        printFrameUrl: function() {
            let url= this.frameDomain() + "/print-preview.html";
            return url;
        },
        frameDomain: function() {
            return window.location.protocol + "//" + this.appSubdomain + "." + window.location.host;
        },
        postMessage: function(obj) {
            let iframe = document.getElementById("sandboxId");
            try {
                iframe.contentWindow.postMessage(obj, '*');
            } catch(ex) {
                this.closeSandbox();
            }
        },
        postPrintMessage: function(obj) {
            let iframe = document.getElementById("print-data-container");
            try {
                iframe.contentWindow.postMessage(obj, '*');
            } catch(ex) {
                console.log('unable to open print preview modal: ' + ex);
            }
        },
        resizeHandler: function() {
            // https://stackoverflow.com/a/35175835
            let fullscreenElement = document.fullscreenElement || document.mozFullScreenElement
                || document.webkitFullscreenElement || document.msFullscreenElement;
            this.fullscreenMode = fullscreenElement != null;

            let iframe = document.getElementById("sandboxId");
            if (iframe == null) {
                return;
            }
            iframe.style.width = '100%';
            iframe.style.height = '100%';
        },
        messageHandler: function(e) {
            let that = this;
            let iframe = document.getElementById("sandboxId");
            let win = iframe.contentWindow;
            if (win == null ) {
                that.closeSandbox();
            } else {
                if ((e.origin === "null" || e.origin === that.frameDomain()) && e.source === iframe.contentWindow) {
                    if (e.data.action == 'pong') {
                        that.isIframeInitialised = true;
                    } else if (e.data.action == 'failedInit') {
                        that.giveUp();
                    } else if (e.data.action == 'streamFile') {
                        that.streamFile(e.data.seekHi, e.data.seekLo, e.data.seekLength, e.data.streamFilePath);
                    } else if(e.data.action == 'actionRequest') {
                        that.actionRequest(e.data.filePath, e.data.requestId, e.data.api, e.data.apiMethod, e.data.bytes,
                            e.data.hasFormData, e.data.params, e.data.isFromRedirect, e.data.isNavigate);
                    }
                }
            }
        },
        start: function() {
            let that = this;
            peergos.shared.user.App.init(this.context, "launcher").thenApply(launcher => {
                that.launcherApp = launcher;
                if (that.appProperties != null && that.appProperties.template.length > 0) {
                    that.readTemplateAppConfiguration(() => that.startListener());
                } else {
                    that.startListener();
                }
            });
        },
        isUserRemovedFromApp: function(members, admins, hasFriendsInChat) {
            let isAdmin = admins.findIndex(v => v === this.context.username) > -1;
            if (isAdmin) {
                return false;
            } else {
                return (members.findIndex(v => v === this.context.username) == -1 || members.length == 0)
                    || (members.findIndex(v => v === this.context.username) == 0 || members.length == 1)
                    || !hasFriendsInChat;
            }
        },
        readTemplateAppConfiguration: function(callback) {
            let that = this;
            let startIndex = 0;
            let chatId = that.appProperties.chatId;
            let withoutPrefix = chatId.substring(chatId.indexOf("$") +1);
            let chatOwner = withoutPrefix.substring(0,withoutPrefix.indexOf("$"));
            this.messenger.getChat(that.appProperties.chatId).thenApply(function(controller) {
                that.messenger.mergeAllUpdates(controller, that.socialData).thenApply(updatedController => {
                    let members = updatedController.getMemberNames().toArray();
                    let admins = updatedController.getAdmins().toArray();
                    let friendsInChat = that.friendnames.filter(friend => members.findIndex(v => v === friend) > -1);
                    if (that.isUserRemovedFromApp(members, admins, friendsInChat.length > 0)) {
                        that.fatalError('You are no longer a member of: ' + that.appProperties.displayName);
                    } else {
                        callback();
                    }
                });
            });
        },
        startListener: function() {
            var that = this;
            var iframeContainer = document.getElementById("sandbox-container");
            var iframe = document.createElement('iframe');
            iframe.id = 'sandboxId';
            iframe.style.width = '100%';
            iframe.style.height = '100%';
            iframe.frameBorder="0";
            iframe.scrolling="no";
            iframe.allow="cross-origin-isolated";
            iframeContainer.appendChild(iframe);
            Vue.nextTick(function() {
                iframe.src = that.frameUrl();
                window.addEventListener('message', that.messageHandler);
                window.addEventListener("resize", that.resizeHandler);
                that.resizeHandler();
                let theme = that.$store.getters.currentTheme;
                let href = window.location.href;
                let url = new URL(href);
                let localAppDev = url.searchParams.get("local-app-dev");
                let appName =  that.isTemplateApp ? that.currentAppName.substring(0, that.currentAppName.indexOf("!")) : that.currentAppName;
                let allowUnsafeEvalInCSP = that.permissionsMap.get(that.PERMISSION_CSP_UNSAFE_EVAL) != null;
                let props = { appDevMode: appName === localAppDev, allowUnsafeEvalInCSP: allowUnsafeEvalInCSP, isPathWritable: that.isPathWritable(),
                    htmlAnchor: that.htmlAnchor == null ? "" : that.htmlAnchor};
                let func = function() {
                    that.postMessage({type: 'init', appName: appName, appPath: that.appPath,
                    allowBrowsing: that.browserMode, theme: theme, chatId: that.currentChatId,
                    username: that.context.username, props: props});
                };
                that.setupIFrameMessaging(iframe, func);
            });
            let iframeForPrint = document.getElementById("print-data-container");
            iframeForPrint.src = that.printFrameUrl();
        },
        setupIFrameMessaging: function(iframe, func) {
            if (this.isIframeInitialised) {
                func();
            } else {
                iframe.contentWindow.postMessage({type: 'ping'}, '*');
                let that = this;
                window.setTimeout(function() {that.setupIFrameMessaging(iframe, func);}, 30);
            }
        },
        isPathWritable: function() {
                return this.targetFile != null && this.targetFile.isWritable();
        },
        streamFile: function(seekHi, seekLo, seekLength, streamFilePath) {
            let that = this;
            let originalStreamFilePath = streamFilePath;
            if (this.browserMode && streamFilePath.includes('/.')) {
                that.showError('Path not accessible: ' + streamFilePath);
            } else {
                var prefix = '';
                if (!this.browserMode && !streamFilePath.startsWith(this.appPath)) {
                    if(streamFilePath.startsWith(that.apiRequest + '/data')) {
                        streamFilePath = streamFilePath.substring(that.apiRequest.length);
                    } else {
                        prefix = '/assets';
                    }
                }
                this.findFile(prefix + streamFilePath).thenApply(file => {
                    if (file != null) {
                        that.stream(seekHi, seekLo, seekLength, file, originalStreamFilePath);
                    }
                });
            }
        },
        fixMimeType: function (filePath, mimeTypeInput) {
            var mimeType = "application/octet-stream";
            if (mimeTypeInput != null && mimeTypeInput.trim().length > 0) {
                if (filePath.toLowerCase().endsWith('.html')) {
                    mimeType = "text/html";
                } else if (filePath.toLowerCase().endsWith('.css')) {
                    mimeType = "text/css";
                } else if (filePath.toLowerCase().endsWith('.js')) {
                    mimeType = "text/javascript";
                } else if (filePath.toLowerCase().endsWith('.wasm')) {
                    mimeType = "application/wasm";
                } else {
                    let lastSlashIdx = filePath.lastIndexOf('/');
                    let dotIndex =  filePath.indexOf('.', lastSlashIdx);
                    if (dotIndex == -1 && mimeTypeInput.startsWith('text/')) {
                        mimeType = "text/html";
                    } else {
                        mimeType = mimeTypeInput;
                    }
                }
            }
            return mimeType;
        },
        buildHeader: function(filePath, mimeTypeInput, requestId, streamingInfo) {
            var mimeType = this.fixMimeType(filePath, mimeTypeInput);
            let encoder = new TextEncoder();
            let filePathBytes = encoder.encode(filePath + requestId);
            let mimeTypeBytes = encoder.encode(mimeType);
            let pathSize = filePathBytes.byteLength;
            if (pathSize >= 255) {
                throw new Error("Path too long!");
            }
            let mimeTypeSize = mimeTypeBytes.byteLength;
            if (mimeTypeSize >= 255) {
                throw new Error("MimeType too long!");
            }
            var headerSize = 1 + 1 + pathSize + 1 + mimeTypeSize;
            let sizeHighBytes = 0;
            let sizeLowBytes = 0;
            if (streamingInfo != null) {
                sizeHighBytes = this.writeUnsignedLeb128(streamingInfo.sizeHigh);
                sizeLowBytes = this.writeUnsignedLeb128(streamingInfo.sizeLow);
                headerSize = headerSize + sizeHighBytes.byteLength + sizeLowBytes.byteLength;
            }
            var data = new Uint8Array(headerSize);
            var offset = 0;
            var mode = 0;
            if (streamingInfo != null) {
                if (streamingInfo.appFileStreaming) {
                    mode = 11;
                } else {
                    mode = 1;
                }
            }
            data.set([mode], offset); //status code (or mode)
            offset = offset + 1;
            data.set([pathSize], offset);
            offset = offset + 1;
            data.set(filePathBytes, offset);
            offset = offset + pathSize;
            data.set([mimeTypeSize], offset);
            offset = offset + 1;
            data.set(mimeTypeBytes, offset);
            if (streamingInfo != null) {
                offset = offset + mimeTypeSize;
                data.set(sizeHighBytes, offset);
                offset = offset + sizeHighBytes.byteLength;
                data.set(sizeLowBytes, offset);
            }
            return data;
        },
        buildResponse: function(header, body, mode) {
            var bytes = body == null ? new Uint8Array(header.byteLength)
                : new Uint8Array(body.byteLength + header.byteLength);
            for(var i=0;i < header.byteLength;i++){
                bytes[i] = header[i];
            }
            if (body != null) {
                for(var j=0;j < body.byteLength;j++){
                    bytes[i+j] = body[j];
                }
            }
            bytes[0] = mode;
            let data = convertToByteArray(bytes);
            this.postData(data);
        },
        actionRequest: function(path, requestId, api, apiMethod, data, hasFormData, params, isFromRedirect, isNavigate) {
            let that = this;
            let headerFunc = (mimeType, streamingInfo) => that.buildHeader(path, mimeType, requestId, streamingInfo);
            if (this.browserMode) {
                if (this.isAppGalleryMode) {
                    if (!(apiMethod == 'GET' || apiMethod == 'POST' )) {
                        that.showError("app-gallery does not support: " + apiMethod);
                        that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                        return;
                    }
                } else if (apiMethod != 'GET') {
                    that.showError("HTMLViewer does not support: " + apiMethod);
                    that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                    return;
                }
            }
            try {
                if (api =='/peergos-api/v0/install-app/') {
                    that.handleInstallAppRequest(headerFunc(), path, apiMethod, data, hasFormData, params);
                }else if (api =='/peergos-api/v0/chat/') {
                    if (!that.permissionsMap.get(that.PERMISSION_EXCHANGE_MESSAGES_WITH_FRIENDS)) {
                        that.showError("App attempted to access chat without permission :" + path);
                        that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                    } else {
                        that.handleChatRequestV0(headerFunc(), path, apiMethod, data, hasFormData, params);
                    }
                }else if (api =='/peergos-api/v1/chat/') {
                    if (!that.permissionsMap.get(that.PERMISSION_EXCHANGE_MESSAGES_WITH_FRIENDS)) {
                        that.showError("App attempted to access chat without permission :" + path);
                        that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                    } else {
                        that.handleChatRequestV1(headerFunc(), path, apiMethod, data, hasFormData, params);
                    }
                }else if (api =='/peergos-api/v0/mailbox/') {
                    if (!that.permissionsMap.get(that.PERMISSION_USE_MAILBOX)) {
                        that.showError("App attempted to access mailbox without permission :" + path);
                        that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                    } else {
                        that.handleMailboxRequest(headerFunc(), path, apiMethod, data, hasFormData, params);
                    }
                } else if (api =='/peergos-api/v0/print/') {
                    that.handlePrintPreviewRequest(headerFunc, path, apiMethod, data, hasFormData, params);
                } else if (api =='/peergos-api/v0/save/') {
                    if (this.isSaveActionEnabled) {
                        that.handleSaveFileRequest(headerFunc, path, apiMethod, data, hasFormData, params);
                    } else {
                        that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                    }
                } else if (api =='/peergos-api/v0/file-picker/') {
                    that.handleFilePickerRequest(headerFunc, path, apiMethod, data, hasFormData, params);
                } else if (api =='/peergos-api/v0/folders/') {
                    that.handleFolderPickerRequest(headerFunc, path, apiMethod, data, hasFormData, params);
                } else if (api =='/peergos-api/v0/profile/') {
                    that.handleProfileRequest(headerFunc(), path, apiMethod, data, hasFormData, params);
                } else {
                    var bytes = convertToByteArray(new Int8Array(data));
                    if (apiMethod == 'GET') {
                        //requestId is set if it is a GET request to /peergos-api/v0/form or /peergos-api/v0/data
                        if (requestId.length > 0 && !requestId.startsWith("HEAD-") && !requestId.startsWith("GET-")) {
                            if (!that.permissionsMap.get(that.PERMISSION_STORE_APP_DATA)) {
                                that.showError("App attempted to access file without permission :" + path);
                                that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                            } else {
                                that.readFileOrFolder(headerFunc, '/data/' + path, params, true, false);
                            }
                        } else {
                            let prefix = !this.browserMode
                                && !(path == this.appPath || (this.isAppPathAFolder && path.startsWith(this.appPath)))
                                && !(this.appPath.length > 0 && !this.isAppPathAFolder && path.startsWith(that.getPath))
                                && !path.startsWith(that.apiRequest + '/data')
                                && !(this.isSelectedFolder(path))
                                && !(path == this.pickerSelectedFile)
                                ? '/assets' : '';
                            if (this.browserMode) {
                                that.handleBrowserRequest(headerFunc, path, params, isFromRedirect, isNavigate);
                            } else {
                                that.readFileOrFolder(headerFunc, prefix + path, params, false, false);
                            }
                        }
                    } else {
                        if (that.appPath.length > 0 && path == that.appPath) {
                            if (path.includes('/.')) {
                                that.showError('Path not accessible: ' + path);
                                that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                            }
                            if (that.isAppPathAFolder) {
                                that.showError("App attempted to write folder without permission :" + path);
                                that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                            } else {
                                if (apiMethod == 'POST' || apiMethod == 'PUT') {
                                    if (!that.permissionsMap.get(that.PERMISSION_EDIT_CHOSEN_FILE)) {
                                        that.showError("App attempted to write to file without permission :" + path);
                                        that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                                    } else {
                                        that.overwriteFile(headerFunc(), path, bytes, that.targetFile, true);
                                    }
                                } else {
                                    that.showError("App attempted unexpected action: " + apiMethod);
                                    that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                                }
                            }
                        } else {
                            if (!that.permissionsMap.get(that.PERMISSION_STORE_APP_DATA)) {
                                that.showError("App attempted to access file without permission :" + path);
                                that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                            } else {
                                if(apiMethod == 'DELETE') {
                                    that.deleteAction(headerFunc(), path);
                                } else if(apiMethod == 'POST') {
                                    that.createAction(headerFunc(), path, bytes, hasFormData);
                                } else if(apiMethod == 'PUT') {
                                    that.putAction(headerFunc(), path, bytes);
                                } else if(apiMethod == 'PATCH') {
                                    that.patchAction(headerFunc(), path, bytes);
                                }
                            }
                        }
                    }
                }
            } catch(ex) {
                console.log('Exception:' + ex);
                that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
            }
        },
        handlePrintPreviewRequest: function(headerFunc, path, apiMethod, data, hasFormData, params) {
            let that = this;
            if (apiMethod == 'POST' && hasFormData) {
                let requestBody = JSON.parse(new TextDecoder().decode(data));
                that.postPrintMessage({type: 'printPreviewRequest', html: requestBody.html, css: requestBody.css, title: requestBody.title});
                that.buildResponse(headerFunc(), null, that.UPDATE_SUCCESS);
            } else {
                that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
            }
        },
        handleSaveFileRequest: function(headerFunc, path, apiMethod, data, hasFormData, params) {
            let that = this;
            if (that.appPath.length > 0) {
                if (path.includes('/')) {
                    that.showError('Path includes invalid filename: ' + path);
                    that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                    return
                }
                if (apiMethod == 'POST' || apiMethod == 'PUT') {
                    let folderPath = that.appPath.substring(0, that.appPath.lastIndexOf('/') + 1);
                    this.prompt_placeholder = 'Save File';
                    this.prompt_message = 'Folder: ' + folderPath;
                    this.prompt_value = path;
                    this.prompt_consumer_func = function (prompt_result) {
                        this.showPrompt = false;
                        if (prompt_result === null) {
                            that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                            return;
                        }
                        let filename = prompt_result.trim();
                        if (filename === '') {
                            that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                            return;
                        }
                        if (filename.startsWith('.')) {
                            that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                            return;
                        }
                        if (filename.includes('/') || filename.includes('\\')) {
                            that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                            return;
                        }
                        if (folderPath + filename  == that.appPath) {
                            that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                            return;
                        }
                        var bytes = convertToByteArray(new Int8Array(data));
                        let fullPathToNewFile = folderPath + filename;
                        that.findFile(fullPathToNewFile, false).thenApply(file => {
                            if (file != null) {
                                that.overwriteFile(headerFunc(), fullPathToNewFile, bytes, file, false);
                            } else {
                                let filePath = peergos.client.PathUtils.directoryToPath(fullPathToNewFile.split('/').filter(n => n.length > 0));
                                that.writeNewFile(filePath, bytes).thenApply(res => {
                                    that.buildResponse(headerFunc(), null, that.UPDATE_SUCCESS);
                                });
                            }
                        });
                    }.bind(this);
                    this.showPrompt = true;
                } else {
                    that.showError("App attempted unexpected action: " + apiMethod);
                    that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                }
            } else {
                that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
            }
        },
        closePrompt() {
            this.showPrompt = false;
        },
        handleFilePickerRequest: function(headerFunc, path, apiMethod, data, hasFormData, params) {
            let that = this;
            if (apiMethod == 'GET') {
                let fromCurrentFolder = params.get('currentFolder');
                let baseCurrentFolder = fromCurrentFolder != null && fromCurrentFolder.toLowerCase() == "true";
                let currentPathExtract = this.getPath;
                let currentPathExtractWithoutSlash = currentPathExtract.substring(0, currentPathExtract.length -1);
                this.filePickerBaseFolder =  baseCurrentFolder ? currentPathExtractWithoutSlash : "/" + this.context.username;
                this.noDriveSelection = baseCurrentFolder;
                let fileExtensionFilter = params.get('extension');
                this.pickerFileExtension = fileExtensionFilter == null ? "" : fileExtensionFilter;
                let fileMediaFilter = params.get('media');
                this.pickerFilterMedia = fileMediaFilter == null ? false : fileMediaFilter.toLowerCase() == 'true';
                let thumbnail = params.get('thumbnail');
                this.pickerShowThumbnail = thumbnail == null ? false : thumbnail.toLowerCase() == 'true';
                this.selectedFileFromPicker = function (chosenFile) {
                    var selectedFile = chosenFile == null ? "" : chosenFile;
                    if (baseCurrentFolder) {
                        selectedFile = selectedFile.substring(currentPathExtract.length);
                    }
                    that.showFilePicker = false;
                    let encoder = new TextEncoder();
                    that.pickerSelectedFile = selectedFile;
                    let data = encoder.encode(JSON.stringify([selectedFile]));
                    that.buildResponse(headerFunc(), data, that.UPDATE_SUCCESS);
                }.bind(this);
                this.showFilePicker = true;
            } else {
                that.showError("App attempted unexpected action: " + apiMethod);
                that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
            }
        },
        handleFolderPickerRequest: function(headerFunc, path, apiMethod, data, hasFormData, params) {
            let that = this;
            if (apiMethod == 'GET') {
                let multipleFolders = params.get('multiple');
                if (multipleFolders != null && multipleFolders.toLowerCase() == "false") {
                    this.multipleFolderSelection = false;
                }
                this.folderPickerBaseFolder = "/" + this.context.username;
                this.selectedFoldersFromPicker = function (chosenFolders) {
                    that.selectedFolders = chosenFolders;
                    that.selectedFolderStems = chosenFolders.map(n => n + '/');
                    that.showFolderPicker = false;
                    let encoder = new TextEncoder();
                    let data = encoder.encode(JSON.stringify(chosenFolders));
                    that.buildResponse(headerFunc(), data, that.UPDATE_SUCCESS);
                }.bind(this);
                this.showFolderPicker = true;
            } else {
                that.showError("App attempted unexpected action: " + apiMethod);
                that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
            }
        },
        parsePositiveInt: function(num) {
            let number = parseInt(num, 10);
            if (isNaN(number)) {
                return 0;
            }
            if (number < 0) {
                return 0;
            }
            return number;
        },
        validateRange: function(from, to) {
            if (from == null || to == null) {
                return false;
            }
            let fromNumber = parseInt(from, 10);
            let toNumber = parseInt(to, 10);
            if (isNaN(fromNumber) || isNaN(toNumber)) {
                return false;
            }
            if (fromNumber < 0 || toNumber < 0 || fromNumber > toNumber) {
                return false;
            }
            return true;
        },
        handleInstallAppRequest: function(header, path, apiMethod, data, hasFormData, params) {
            let that = this;
            if (!this.isAppGalleryMode || !hasFormData || apiMethod != 'POST') {
                console.log('Install App API call is invalid');
                that.buildResponse(header, null, that.ACTION_FAILED);
                return;
            }
            let requestBody = JSON.parse(new TextDecoder().decode(data));
            var appPath = requestBody.path.startsWith('/') ? requestBody.path : '/' + requestBody.path;
            appPath = appPath.endsWith('/') ? appPath.substring(0, appPath.length -1) : appPath;
            let appName = requestBody.appName;
            let pathStr = appPath + '/' + appName + '/';
            this.context.getByPath(pathStr + 'peergos-app.json').thenApply(propsFileOpt => {
                if (propsFileOpt.ref != null) {
                    that.appInstallPropsFile = propsFileOpt.ref;
                    that.appInstallFolder = pathStr;
                    that.showAppInstallation = true;
                    that.buildResponse(header, null, that.CREATE_SUCCESS);
                } else {
                    console.log('App manifest file not found!');
                    that.buildResponse(header, null, that.ACTION_FAILED);
                }
            });
        },
        extractBase64Image: function(data) {
            var str = "";
            for (let i = 0; i < data.length; i++) {
                str = str + String.fromCharCode(data[i] & 0xff);
            }
            if (data.byteLength > 0) {
                return "data:image/png;base64," + window.btoa(str);
            }
            return "";
        },
        spinner: function(val) {
            this.showSpinner = val;
            if (!val) {
                this.spinnerMessage = "";
            }
        },
        handleProfileRequest: function(headerFunc, path, apiMethod, data, hasFormData, params) {
            let that = this;
            if(apiMethod == 'GET') {
                let username = path;
                index = this.friendnames.indexOf(username);
                if (index > -1 || username == this.context.username) {
                    if (params.get('thumbnail') == 'true') {
                        if (!this.permissionsMap.get(this.PERMISSION_ACCESS_PROFILE_PHOTO)) {
                            this.showError("App attempted to access profile photo without permission");
                            this.buildResponse(headerFunc, null, this.ACTION_FAILED);
                        } else {
                            let encoder = new TextEncoder();
                            peergos.shared.user.ProfilePaths.getProfilePhoto(username, this.context).thenApply(result => {
                                if (result.ref != null) {
                                    let data = encoder.encode(JSON.stringify({profileThumbnail: that.extractBase64Image(result.ref)}));
                                    that.buildResponse(headerFunc, data, that.GET_SUCCESS);
                                } else {
                                    let data = encoder.encode(JSON.stringify({profileThumbnail: ''}));
                                    that.buildResponse(headerFunc, data, that.GET_SUCCESS);
                                }
                            }).exceptionally(function(throwable) {
                                console.log(throwable);
                                let data = encoder.encode(JSON.stringify({profileThumbnail: ''}));
                                that.buildResponse(headerFunc, data, that.GET_SUCCESS);
                            });
                        }
                    } else {
                        peergos.shared.user.ProfilePaths.getProfile(username, this.context).thenApply(profileInfo => {
                            let base64Image = profileInfo.profilePhoto.isPresent() ? that.extractBase64Image(profileInfo.profilePhoto.get()) : "";
                            let json = {
                                firstName: profileInfo.firstName.isPresent() ? profileInfo.firstName.get() : "",
                                lastName: profileInfo.lastName.isPresent() ? profileInfo.lastName.get() : "",
                                biography: profileInfo.bio.isPresent() ? profileInfo.bio.get() : "",
                                primaryPhone: profileInfo.phone.isPresent() ? profileInfo.phone.get() : "",
                                primaryEmail: profileInfo.email.isPresent() ? profileInfo.email.get() : "",
                                profileImage: base64Image,
                                status: profileInfo.status.isPresent() ? profileInfo.status.get() : "",
                                webRoot: profileInfo.webRoot.isPresent() ? profileInfo.webRoot.get() : ""
                            };
                            that.profile = json;
                            that.showProfileViewForm = true;
                            that.buildResponse(headerFunc, null, that.GET_SUCCESS);
                        }).exceptionally(function(throwable) {
                            console.log(throwable);
                            that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                        });
                    }
                } else {
                    that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                }
            } else {
                that.buildResponse(headerFunc, null, that.ACTION_FAILED);
            }
        },
        copyArray: function(jArray) {
            let arr = [];
            for(var i=0; i < jArray.length; i++) {
                arr.push(jArray[i]);
            }
            return arr;
        },
        filterChats: function(allChats) {
            let that = this;
            let filteredChats = [];
            let recentMessages = [];
            for(var i = 0; i < allChats.length; i++) {
                let chat = allChats[i];
                if (this.currentAppName == "chat") {
                    if(!chat.chatUuid.startsWith("chat-")) { //chat-<appname>
                        filteredChats.push({chatId: chat.chatUuid, title: chat.getTitle()
                        , members: that.copyArray(chat.getMemberNames().toArray())
                        , admins: that.copyArray(chat.getAdmins().toArray()) });
                        recentMessages.push(chat.getRecent().toArray());
                    }
                } else {
                    if(chat.chatUuid.startsWith("chat-" + this.currentAppName)) {
                        filteredChats.push({chatId: chat.chatUuid, title: chat.getTitle()
                        , members: that.copyArray(chat.getMemberNames().toArray())
                        , admins: that.copyArray(chat.getAdmins().toArray()) });
                        recentMessages.push(chat.getRecent().toArray());
                    }
                }
            }
            return {chats: filteredChats, recentMessages: recentMessages};
        },
        addPendingAttachments: function(messagePairs) {
            let refs = [];
            for(var j = 0; j < messagePairs.length; j++) {
                let chatEnvelope = messagePairs[j].message;
                let payload = chatEnvelope.payload;
                let type = payload.type().toString();
                if (type == 'Application' || type == 'ReplyTo') {
                    let body = type == 'Application' ? payload.body.toArray() : payload.content.body.toArray();
                    if (body.length > 1) {
                        for(var i = 1; i < body.length; i++) {
                            let mediaRef = body[i].reference().ref;
                            if (refs.findIndex(v => v.path == mediaRef.path) == -1) {
                                refs.push(mediaRef);
                            }
                        }
                    }
                }
            }
            return refs;
        },
        decodeLatestMessage: function (controller, message) {
            let chatEnvelope = message;
            let payload = chatEnvelope.payload;
            let type = payload.type().toString();
            let author = controller.getUsername(chatEnvelope.author);
            if (type == 'GroupState') {//type
                if(payload.key == "title") {
                    return "Chat name changed to " + payload.value;
                } else if(payload.key == "admins") {
                    return "Chat admins changed to " + payload.value;
                }
            } else if(type == 'Invite') {
                let username = chatEnvelope.payload.username;
                return author + " invited " + username;
            } else if(type == 'RemoveMember') {
                let username = controller.getUsername(chatEnvelope.payload.memberToRemove);
                return author + " removed " + username;
            } else if(type == 'Join') {
                let username = chatEnvelope.payload.username;
                return username + " joined the chat";
            } else if(type == 'Application') {
                return payload.body.toArray()[0].inlineText();
            } else if(type == 'Edit') {
                return payload.content.body.toArray()[0].inlineText();
            } else if(type == 'Delete') {
                return "[Message Deleted]";
            } else if(type == 'ReplyTo') {
                return payload.content.body.toArray()[0].inlineText();
            }
        },
        fromUTCtoLocal: function(dateTime) {
            let date = new Date(dateTime.toString() + "+00:00");//adding UTC TZ in ISO_OFFSET_DATE_TIME ie 2021-12-03T10:25:30+00:00
            let formatted = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate()
                + ' ' + (date.getHours() < 10 ? '0' : '') + date.getHours()
                + ':' + (date.getMinutes() < 10 ? '0' : '') + date.getMinutes()
                + ':' + (date.getSeconds() < 10 ? '0' : '') + date.getSeconds();
            return formatted;
        },
        buildLatestMessageMap: function(index, chats, chatRecentMessages, latestMessageMap, future) {
            let that = this;
            if (index == chats.length) {
                future.complete(true);
            } else {
                let chatInfo = chats[index];
                this.messenger.getChat(chatInfo.chatId).thenApply(function(controller) {
                    let recentMessages = chatRecentMessages[index];
                    let latestMessage = recentMessages.length == 0 ? null : recentMessages[recentMessages.length-1];
                    if (latestMessage != null) {
                        latestMessageMap.set(chatInfo.chatId, {message: that.decodeLatestMessage(controller, latestMessage),
                            creationTime: that.fromUTCtoLocal(latestMessage.creationTime)
                        });
                    }
                    that.buildLatestMessageMap(index + 1, chats, chatRecentMessages, latestMessageMap, future);
                });
            }
        },
        reduceGetAllMessages: function(chatController, messages, startIndex, future) {
            let that = this;
            chatController.getMessages(startIndex, startIndex + 1000).thenApply(result => {
                let newMessages = result.toArray();
                if (newMessages.length < 1000) {
                    future.complete({messages: messages.concat(newMessages), startIndex: startIndex + newMessages.length});
                } else {
                    that.reduceGetAllMessages(chatController, messages.concat(newMessages),
                        startIndex + newMessages.length, future);
                }
            }).exceptionally(err => {
                console.log(err);
                future.complete({messages: messages, startIndex: startIndex});
            });
        },
        getAllMessages: function(chatController, startIndex) {
            let future = peergos.shared.util.Futures.incomplete();
            this.reduceGetAllMessages(chatController, [], startIndex, future);
            return future;
        },
        generateMessageHashes: function(chatController, messages) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let messagePairs = [];
            if (messages.length == 0) {
                future.complete(messagePairs);
            } else {
                messages.forEach(message => {
                    chatController.generateHash(message).thenApply(messageRef => {
                        messagePairs.push({message: message, messageRef: messageRef});
                        if(messagePairs.length == messages.length) {
                            future.complete(messagePairs);
                        }
                    });
                });
            }
            return future;
        },
        replaceOwnerInPath: function(owner, path) {
            let pathWithoutLeadingSlash = path.startsWith("/") ? path.substring(1) : path;
            let pathWithoutOwner = pathWithoutLeadingSlash.substring(pathWithoutLeadingSlash.indexOf("/"));
            return owner + pathWithoutOwner;
        },
        extractOwnerFromPath: function(path) {
            let pathWithoutLeadingSlash = path.startsWith("/") ? path.substring(1) : path;
            return pathWithoutLeadingSlash.substring(0, pathWithoutLeadingSlash.indexOf("/"));
        },
        loadAttachments: function(refs) {
            let future = peergos.shared.util.Futures.incomplete();
            let that = this;
            let attachmentMap = new Map();
            if (refs.length == 0) {
                future.complete(attachmentMap);
            } else {
                var loadedCount = 0;
                refs.forEach(ref => {
                    //Load media from local mirror
                    let mirrorPath = that.replaceOwnerInPath(that.context.username, ref.path);
                    that.context.getByPath(mirrorPath).thenApply(function(optFile) {
                        let mediaFile = optFile.ref;
                        if (mediaFile != null) {
                            let fullPath = ref.path.startsWith("/") ? ref.path : "/" + ref.path;
                            attachmentMap.set(fullPath, {fileRef: JSON.parse(ref.toJson()), mimeType: mediaFile.getFileProperties().mimeType, fileType: mediaFile.getFileProperties().getType(),
                                thumbnail: mediaFile.getFileProperties().thumbnail.ref != null ? mediaFile.getBase64Thumbnail() : ""});
                            loadedCount++;
                            if (loadedCount == refs.length) {
                                future.complete(attachmentMap);
                            }
                        } else {
                            //fallback to attachment sender
                            let owner = that.extractOwnerFromPath(ref.path);
                            that.context.network.getFile(ref.cap, owner).thenApply(optFile => {
                               let mediaFile = optFile.ref;
                               if (mediaFile != null) {
                                   let fullPath = ref.path.startsWith("/") ? ref.path : "/" + ref.path;
                                   attachmentMap.set(fullPath, {fileRef: JSON.parse(ref.toJson()), mimeType: mediaFile.getFileProperties().mimeType, fileType: mediaFile.getFileProperties().getType(),
                                        thumbnail: mediaFile.getFileProperties().thumbnail.ref != null ? mediaFile.getBase64Thumbnail() : ""});
                               }
                               loadedCount++;
                               if (loadedCount == refs.length) {
                                   future.complete(attachmentMap);
                               }
                            }).exceptionally(err => {
                                console.log(err);
                                loadedCount++;
                                if (loadedCount == refs.length) {
                                    future.complete(attachmentMap);
                                }
                            });
                        }
                    }).exceptionally(err => {
                        console.log(err);
                        loadedCount++;
                        if (loadedCount == refs.length) {
                            future.complete(attachmentMap);
                        }
                    });
                });
            }
            return future;
        },
        showToastError: function(msg) {
            console.log(msg);
            this.$toast.error(msg, {timeout:false});
            this.showSpinner = false;
        },
        updatedGroupMembership: function(chatId, updatedGroupTitle, updatedMembers, updatedAdmins) {
            this.showGroupMembership = false;
            let that = this;
            Vue.nextTick(function() {
                if (chatId.length == 0) {
                    that.createNewChatGroup(chatId, updatedGroupTitle, updatedMembers, updatedAdmins);
                }else {
                    that.updateExistingChatGroup(chatId, updatedGroupTitle, updatedMembers, updatedAdmins);
                }
            });
        },
        createNewChatGroup: function(chatId, updatedGroupTitle, updatedMembers, updatedAdmins) {
            let that = this;
            if (updatedMembers.length == 0 || updatedAdmins.length == 0) {
                that.buildResponse(this.chatResponseHeader, null, that.ACTION_FAILED);
                return;
            }
            this.spinner(true);
            this.spinnerMessage = "Creating new chat";
            this.messenger.createAppChat(this.currentAppName == "chat" ? null : this.currentAppName).thenApply(function(controller){
                let chatId = controller.chatUuid;
                let addedAdmins = that.extractAddedParticipants(controller.getAdmins().toArray(), updatedAdmins);
                let addedMembers = that.extractAddedParticipants(controller.getMemberNames().toArray(), updatedMembers);
                that.changeTitle(chatId, updatedGroupTitle).thenApply(function(res1) {
                    that.inviteNewMembers(chatId, addedMembers).thenApply(function(res2) {
                        that.inviteNewAdmins(chatId, addedAdmins).thenApply(function(res3) {
                            let chatItem = {chatId: chatId, title: updatedGroupTitle, members: updatedMembers.slice(), admins: updatedAdmins.slice()};
                            let encoder = new TextEncoder();
                            let data = encoder.encode(JSON.stringify(chatItem));
                            Vue.nextTick(function() {
                                that.spinner(false);
                                Vue.nextTick(function() {
                                    that.buildResponse(that.chatResponseHeader, data, that.CREATE_SUCCESS);
                                });
                            });
                        });
                    });
                });
            }).exceptionally(err => {
                that.showToastError("Unable to create chat");
                console.log(err);
                Vue.nextTick(function() {
                    that.spinner(false);
                    Vue.nextTick(function() {
                        that.buildResponse(that.chatResponseHeader, null, that.ACTION_FAILED);
                    });
                });
            });
        },
        updateExistingChatGroup: function(chatId, updatedGroupTitle, updatedMembers, updatedAdmins) {
            let that = this;
            this.spinner(true);
            let existingChatItem = {chatId: chatId};
            that.messenger.getChat(chatId).thenApply(function(controller) {
                let existingMembers = controller.getMemberNames().toArray();
                let added = that.extractAddedParticipants(existingMembers, updatedMembers);
                let removed = that.extractRemovedParticipants(existingMembers, updatedMembers);
                let existingAdmins = controller.getAdmins().toArray();
                let addedAdmins = that.extractAddedParticipants(existingAdmins, updatedAdmins);
                let removedAdmins = that.extractRemovedParticipants(existingAdmins, updatedAdmins);
                var proposedAdminsLength = existingAdmins.length - removedAdmins.length + addedAdmins.length;
                if (proposedAdminsLength < 1) {
                    that.buildResponse(that.chatResponseHeader, null, that.ACTION_FAILED);
                }
                if (existingAdmins.filter(v => v == that.context.username).length == -1) {
                    if (removedAdmins.length > 0 || addedAdmins.length > 0) {
                        that.buildResponse(that.chatResponseHeader, null, that.ACTION_FAILED);
                    }
                }
                that.changeChatTitleIfNecessary(controller, existingChatItem, updatedGroupTitle).thenApply(function(res) {
                    that.inviteNewAdmins(chatId, addedAdmins).thenApply(function(res3) {
                       that.removeAdmins(chatId, removedAdmins).thenApply(function(res4) {
                            that.inviteNewMembers(chatId, added).thenApply(function(res1) {
                                that.removeMembers(chatId, removed).thenApply(function(res2) {
                                    Vue.nextTick(function() {
                                        that.spinner(false);
                                        Vue.nextTick(function() {
                                            let chatItem = {chatId: chatId, title: updatedGroupTitle, members: updatedMembers.slice(), admins: updatedAdmins.slice()};
                                            let encoder = new TextEncoder();
                                            let data = encoder.encode(JSON.stringify(chatItem));
                                            that.buildResponse(that.chatResponseHeader, data, that.UPDATE_SUCCESS);
                                        });
                                    });
                               });
                            });
                        });
                    });
                });
            });
        },
        changeChatTitleIfNecessary: function(controller, existingChatItem, updatedGroupTitle) {
            let future = peergos.shared.util.Futures.incomplete();
            if (controller.getTitle() != updatedGroupTitle) {
                existingChatItem.title = updatedGroupTitle;
                this.changeTitle(existingChatItem.chatId, updatedGroupTitle).thenApply(function(res) {
                    future.complete(res);
                });
            } else {
                    future.complete(true);
            }
            return future;
        },
        diff: function(origList, updatedList) {
            let notFoundList = [];
            updatedList.forEach(member => {
                let index = origList.findIndex(v => v === member);
                if (index == -1) {
                    notFoundList.push(member);
                }
            });
            return notFoundList;
        },
        extractAddedParticipants: function(origParticipants, updatedParticipants) {
            return this.diff(origParticipants, updatedParticipants);
        },
        extractRemovedParticipants: function(origParticipants, updatedParticipants) {
            return this.diff(updatedParticipants, origParticipants);
        },
        changeTitle: function(chatId, text) {
            let future = peergos.shared.util.Futures.incomplete();
            let that = this;
            this.messenger.getChat(chatId).thenApply(function(controller) {
                that.messenger.setGroupProperty(controller, "title", text).thenApply(function(updatedController) {
                    future.complete(true);
                }).exceptionally(function(throwable) {
                    console.log(throwable);
                    that.showToastError("Unable to change Title");
                    future.complete(false);
                });
            });
            return future;
        },
        inviteNewMembers: function(chatId, updatedMembers) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            if (updatedMembers.length == 0) {
                future.complete(true);
            } else {
                let usernames = peergos.client.JsUtil.asList(updatedMembers);
                this.spinnerMessage = "adding participant(s) to chat";
                this.messenger.getChat(chatId).thenApply(function(controller) {
                    that.getPublicKeyHashes(updatedMembers).thenApply(pkhList => {
                        that.messenger.invite(controller, usernames, pkhList).thenApply(updatedController => {
                            that.spinnerMessage = "";
                            future.complete(true);
                        }).exceptionally(err => {
                            that.spinnerMessage = "";
                            that.showToastError("Unable to add members to chat");
                            console.log(err);
                            future.complete(false);
                        });
                    });
                });
            }
            return future;
        },
        getPublicKeyHashes: function(usernames) {
            let that = this;
            const usernameToPKH = new Map();
            let future = peergos.shared.util.Futures.incomplete();
            usernames.forEach(username => {
                that.context.getPublicKeys(username).thenApply(pkOpt => {
                    usernameToPKH.set(username, pkOpt.get().left);
                    if(usernameToPKH.size == usernames.length) {
                        let pkhs = [];
                        usernames.forEach(user => {
                            pkhs.push(usernameToPKH.get(user));
                        });
                        future.complete(peergos.client.JsUtil.asList(pkhs));
                    }
                });
            });
            return future;
        },
        reduceAddingAdmins: function(chatId, adminsToAdd, index, future) {
            let that = this;
            if (index == adminsToAdd.length) {
                future.complete(true);
            } else {
                let username = adminsToAdd[index];
                this.spinnerMessage = "adding " + username + " as chat admin";
                this.messenger.getChat(chatId).thenApply(function(controller) {
                    controller.addAdmin(username).thenApply(updatedController => {
                        that.spinnerMessage = "";
                        that.reduceAddingAdmins(chatId, adminsToAdd, ++index, future);
                    }).exceptionally(function(throwable) {
                        that.spinnerMessage = "";
                        console.log(throwable);
                        that.showToastError("Unable to add " + username + " as chat admin");
                        that.reduceAddingAdmins(chatId, adminsToAdd, ++index, future);
                    });
                });
            }
            return future;
        },
        inviteNewAdmins: function(chatId, adminsToAdd) {
            let future = peergos.shared.util.Futures.incomplete();
            this.reduceAddingAdmins(chatId, adminsToAdd, 0, future);
            return future;
        },
        reduceRemovingInvitations: function(chatId, membersToRemove, index, future) {
            let that = this;
            if (index == membersToRemove.length) {
                future.complete(true);
            } else {
                let username = membersToRemove[index];
                this.spinnerMessage = "removing " + username + " from chat";
                this.messenger.getChat(chatId).thenApply(function(controller) {
                    that.messenger.removeMember(controller, username).thenApply(updatedController => {
                        that.spinnerMessage = "";
                        that.reduceRemovingInvitations(chatId, membersToRemove, ++index, future);
                    }).exceptionally(function(throwable) {
                        that.spinnerMessage = "";
                        console.log(throwable);
                        that.showToastError("Unable to remove " + username + " from chat");
                        that.reduceRemovingInvitations(chatId, membersToRemove, ++index, future);
                    });
                });
            }
            return future;
        },
        removeMembers: function(chatId, membersToRemove) {
            let future = peergos.shared.util.Futures.incomplete();
            this.reduceRemovingInvitations(chatId, membersToRemove, 0, future);
            return future;
        },
        reduceRemovingAdmins: function(chatId, adminsToRemove, index, future) {
            let that = this;
            if (index == adminsToRemove.length) {
                future.complete(true);
            } else {
                let username = adminsToRemove[index];
                this.spinnerMessage = "removing " + username + " as chat admin";
                this.messenger.getChat(chatId).thenApply(function(controller) {
                    controller.removeAdmin(username).thenApply(updatedController => {
                        that.spinnerMessage = "";
                        that.reduceRemovingAdmins(chatId, adminsToRemove, ++index, future);
                    }).exceptionally(function(throwable) {
                        that.spinnerMessage = "";
                        console.log(throwable);
                        that.showToastError("Unable to remove " + username + " as chat admin");
                        that.reduceRemovingAdmins(chatId, adminsToRemove, ++index, future);
                    });
                });
            }
            return future;
        },
        removeAdmins: function(chatId, adminsToRemove) {
            let future = peergos.shared.util.Futures.incomplete();
            this.reduceRemovingAdmins(chatId, adminsToRemove, 0, future);
            return future;
        },
        convertToPath: function(dir) {
            let dirWithoutLeadingSlash = dir.startsWith("/") ? dir.substring(1) : dir;
            return peergos.client.PathUtils.directoryToPath(dirWithoutLeadingSlash.split('/'));
        },
        reduceMovingEmailsToInboxFolder: function(emailsToRead, index, future) {
            let that = this;
            if (index >= emailsToRead.length) {
                future.complete(true);
            } else {
                that.mailboxClient.moveToPrivateInbox(emailsToRead[index]).thenApply(res => {
                    that.reduceMovingEmailsToInboxFolder(emailsToRead, ++index, future);
                });
            }
        },
        requestLoadFolder: function(folderName, filterStarredEmails, callback) {
            let that = this;
            this.spinner(true);
            let fullFolderPath = this.mailboxFolderPrefix + '/' + folderName;
            let directoryPath = peergos.client.PathUtils.directoryToPath(fullFolderPath.split('/'));
            that.sandboxedApp.dirInternal(directoryPath, this.context.username).thenApply(filenames => {
                that.loadEmails(fullFolderPath, filenames.toArray()).thenApply(results => {
                    that.spinner(false);
                    callback({data: results, folderName: folderName, filterStarredEmails: filterStarredEmails});
                });
            });
        },
        loadEmails: function(directory, filenames) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            that.reduceLoadingEmails(directory, filenames, [], future);
            return future;
        },
        reduceLoadingEmails: function(directory, filenames, accumulator, future) {
            let that = this;
            let filename = filenames.pop();
            if (filename == null) {
                let sorted = accumulator.sort(function (a, b) {
                        let aDate = new Date(a.timestamp);
                        let bDate = new Date(b.timestamp);
                        return bDate - aDate;
                    });
                future.complete(sorted);
            } else {
                let filePath = peergos.client.PathUtils.toPath(directory.split('/'), filename);
                that.sandboxedApp.readInternal(filePath, this.context.username).thenApply(data => {
                    let emailJava = peergos.shared.util.Serialize.parse(data, c => peergos.shared.email.EmailMessage.fromCbor(c));
                    that.messageToTimestamp.set(emailJava.id, emailJava.created);
                    let emailJS =
                    {   id: emailJava.id, msgId: emailJava.msgId, from: emailJava.from, subject: emailJava.subject
                        , timestamp: emailJava.created.toString()
                        , to: that.toJsList(emailJava.to)
                        , cc: that.toJsList(emailJava.cc)
                        , bcc: that.toJsList(emailJava.bcc)
                        , content: emailJava.content
                        , unread: emailJava.unread, star: emailJava.star, selected: false
                        , attachments: that.toJsAttachmentList(emailJava.attachments)
                        , icalEvent: emailJava.icalEvent
                    };

                    accumulator.push(emailJS);
                    that.reduceLoadingEmails(directory, filenames, accumulator, future);
                });
            }
        },
        toJsAttachmentList: function(javaList) {
            let javaArray = javaList.toArray([]);
            let jsAttachmentList = [];
            for(var i = 0; i < javaArray.length; i++) {
                let item = javaArray[i];
                let attachment = {filename: item.filename, size: item.size, type: item.type, uuid: item.uuid};
                jsAttachmentList.push(attachment);
            }
            return jsAttachmentList;
        },
        toJsList: function(javaList) {
            let javaArray = javaList.toArray([]);
            let jsList = [];
            for(var i = 0; i < javaArray.length; i++) {
                jsList.push(javaArray[i]);
            }
            return jsList;
        },
        reduceMovingEmailsToSentFolder: function(emailsToRead, index, future) {
            let that = this;
            if (index >= emailsToRead.length) {
                future.complete(true);
            } else {
                that.mailboxClient.moveToPrivateSent(emailsToRead[index]).thenApply(res => {
                    that.reduceMovingEmailsToSentFolder(emailsToRead, ++index, future);
                });
            }
        },
        requestUpdateEmail: function(data, folder, callback) {
            const that = this;
            that.spinner(true);
            let bytes = that.buildEmailBytes(data);
            that.saveEmail(folder, bytes, data.id).thenApply(function(res) {
                that.spinner(false);
                callback();
            }).exceptionally(function(throwable) {
                that.showError("Unable to save email");
                console.log(throwable.getMessage());
            });
        },
        saveEmail: function(folder, bytes, id) {
            let fullFolderPath = this.mailboxFolderPrefix + "/" + folder;
            let folderDirs = fullFolderPath.split('/');
            let filePath = peergos.client.PathUtils.directoryToPath(folderDirs.concat(
                    [id + this.EMAIL_FILE_EXTENSION]));
            return this.sandboxedApp.writeInternal(filePath, bytes);
        },
        buildEmailBytes: function(data) {
            let email = this.buildEmail(data, true);
            return email.toBytes();
        },

        buildEmail: function(data, recurse) {
            let that = this;
            let allAttachments = [];
            data.attachments.forEach(item => {
                let attachment = new peergos.shared.email.Attachment(item.filename, item.size,
                    item.type, item.uuid);
                allAttachments.push(attachment);
            });
            let attachments = peergos.client.JsUtil.asList(allAttachments);
            let to = peergos.client.JsUtil.asList(data.to);
            let cc = peergos.client.JsUtil.asList(data.cc);
            let bcc = peergos.client.JsUtil.asList(data.bcc);

            let createdTimestamp = this.messageToTimestamp.get(data.id);

            let replyingToEmail = data.replyingToEmail == null || !recurse ? peergos.client.JsUtil.emptyOptional()
                : peergos.client.JsUtil.optionalOf(this.buildEmail(data.replyingToEmail, false));

            let forwardingToEmail = data.forwardingToEmail == null || !recurse ? peergos.client.JsUtil.emptyOptional()
                : peergos.client.JsUtil.optionalOf(this.buildEmail(data.forwardingToEmail, false));

            let sendError = peergos.client.JsUtil.emptyOptional();
            let emailJava = new peergos.shared.email.EmailMessage(data.id, data.msgId, data.from, data.subject,
                 createdTimestamp, to, cc, bcc,
                 data.content, data.unread, data.star, attachments, data.icalEvent,
                 replyingToEmail, forwardingToEmail, sendError);
            return emailJava;
        },
        createUUID: function() {
            let uuid = ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
                (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
            ).split("-").join("");
            return uuid;
        },
        requestImportCalendarEvent: function(bytes, callback) {
            //fixme. creating a temp file is not ideal
            let path = 'default/attachments';
            let filename =  this.createUUID() + '.ics';
            let fullPath = path + '/' + filename;
            let icalFilePath = peergos.client.PathUtils.directoryToPath(fullPath.split('/'));
            let that = this;
            this.spinner(true);
            this.sandboxedApp.writeInternal(icalFilePath, bytes).thenApply(done => {
                that.spinner(false);
                callback();
                setTimeout(() => {
                    that.navigateTo = { app: "Calendar", navigationPath: that.context.username + '/.apps/' + that.currentAppName + '/data/' + path
                        , navigationFilename: filename};
                    that.closeSandbox();
                });
            });
        },
        requestMoveEmail: function(data, fromFolder, toFolder, callback) {
            const that = this;
            this.spinner(true);
            that.moveEmail(data, fromFolder, toFolder).thenApply(function(done) {
                that.spinner(false);
                callback(done);
            });
        },
        moveEmail: function(data, fromFolder, toFolder) {
            const that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let bytes = that.buildEmailBytes(data);
            that.saveEmail(toFolder, bytes, data.id).thenApply(function(res2) {
                that.removeEmail(fromFolder, data, false).thenApply(function(res) {
                    future.complete(true);
                }).exceptionally(function(throwable) {
                    that.showError("Unable to delete moved email from source folder");
                    console.log(throwable.getMessage());
                    future.complete(false);
                });
            }).exceptionally(function(throwable) {
                that.showError("Unable to move email");
                console.log(throwable.getMessage());
                future.complete(false);
            });
            return future;
        },
        reduceDeletingAttachments: function(attachments, index, future) {
            let that = this;
            if (index >= attachments.length) {
                future.complete(true);
            } else {
                let attachment = attachments[index];
                let fullFolderPath = this.mailboxFolderPrefix + '/attachments';
                let filePath = peergos.client.PathUtils.toPath(fullFolderPath.split('/'), attachment.uuid);
                this.sandboxedApp.deleteInternal(filePath).thenApply( res => {
                    that.reduceDeletingAttachments(attachments, ++index, future);
                }).exceptionally(function(throwable) {
                    if (throwable.toString() == "java.util.NoSuchElementException") {
                        that.reduceDeletingAttachments(attachments, ++index, future);
                    } else {
                        that.showError("Unable to delete attachment:" + attachment.filename);
                        console.log(throwable.getMessage());
                        future.complete(false);
                    }
                });
            }
        },
        removeEmail: function(folder, data, deleteAttachment) {
            let that = this;
            let filename = data.id + this.EMAIL_FILE_EXTENSION;
            let fullFolderPath = this.mailboxFolderPrefix + '/' + folder;
            let filePath = peergos.client.PathUtils.toPath(fullFolderPath.split('/'), filename);
            let future = peergos.shared.util.Futures.incomplete();
            this.sandboxedApp.deleteInternal(filePath).thenApply( res => {
                if (deleteAttachment) {
                    let future2 = peergos.shared.util.Futures.incomplete();
                    that.reduceDeletingAttachments(data.attachments, 0, future2);
                    future2.thenApply(done => {
                        future.complete(true);
                    }).exceptionally(function(throwable) {
                        future.complete(false);
                    });
                } else {
                    future.complete(true);
                }
            }).exceptionally(function(throwable) {
                that.showError("Unable to delete email");
                console.log(throwable.getMessage());
                future.complete(false);
            });
            return future;
        },
        requestMoveEmails: function(data, fromFolder, toFolder, callback) {
            let that = this;
            this.spinner(true);
            let future = peergos.shared.util.Futures.incomplete();
            that.reduceMovingEmails(data, fromFolder, toFolder, 0, future);
            future.thenApply(done => {
                that.spinner(false);
                callback(done);
            });
        },
        reduceMovingEmails: function(data, fromFolder, toFolder, index, future) {
            let that = this;
            if (index >= data.length) {
                future.complete(true);
            } else {
                let item = data[index];
                this.moveEmail(item, fromFolder, toFolder).thenApply(res => {
                    that.reduceMovingEmails(data, fromFolder, toFolder, ++index, future);
                });
            }
        },
        reduceDeletingEmails: function(data, folder, index, future) {
            let that = this;
            if (index >= data.length) {
                future.complete(true);
            } else {
                let item = data[index];
                this.removeEmail(folder, item, true).thenApply(function(res) {
                    that.reduceDeletingEmails(data, folder, ++index, future);
                });
            }
        },
        requestDeleteEmails: function(data, folder, callback) {
            let that = this;
            this.spinner(true);
            let future = peergos.shared.util.Futures.incomplete();
            that.reduceDeletingEmails(data, folder, 0, future);
            future.thenApply(done => {
                that.spinner(false);
                callback(done);
            });
        },
        requestDeleteEmail: function(data, folder, callback) {
            const that = this;
            this.spinner(true);
            this.removeEmail(folder, data, true).thenApply(function(done) {
                that.spinner(false);
                callback(done);
            });
        },
        requestNewMailboxFolder: function(callback) {
            let that = this;
            this.prompt_placeholder = 'New Folder name';
            this.prompt_value = "";
            this.prompt_message = 'Enter a new folder name';
            this.prompt_max_input_size = 10;
            this.prompt_consumer_func = function(prompt_result) {
                if (prompt_result === null) {
                    callback(null);
                    return;
                }
                let newName = prompt_result.trim();
                if (newName === '') {
                    callback(null);
                    return;
                }
                if (newName === '.' || newName === '..') {
                    callback(null);
                    return;
                }
                if (!newName.match(/^[a-z\d\-_\s]+$/i)) {
                    that.showError("Invalid folder name. Use only alphanumeric characters plus space, dash and underscore");
                    callback(null);
                    return;
                }
                setTimeout(function(){
                    //make sure names are unique
                    if (that.isInbuiltFolderName(newName)) {
                        that.showError("Folder already exists!");
                        callback(null);
                        return;
                    }
                    for (var i=0;i < that.mailboxClientProperties.userFolders.length; i++) {
                        let folder = that.mailboxClientProperties.userFolders[i];
                        if (folder.name == newName) {
                            that.showError("Folder already exists!");
                            callback(null);
                            return;
                        }
                    }
                    that.spinner(true);
                    let dirName = that.generateDirectoryName();
                    let newFolder = {name: newName, path: dirName};
                    that.mailboxClientProperties.userFolders.push(newFolder);
                    that.updatePropertiesFile(that.mailboxClientProperties).thenApply(res => {
                        that.spinner(false);
                        callback(newFolder);
                    });
                });
            };
            this.showPrompt =  true;
        },
        isInbuiltFolderName: function(folderName) {
            let specialFolders = ['inbox','sent','trash','spam','archive','pending'];
            return specialFolders.findIndex(v => v === folderName.toLowerCase()) > -1;
        },
        generateDirectoryName: function() {
          return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
          ).substring(0, 12);
        },
        updatePropertiesFile: function(json) {
            let filePath = peergos.client.PathUtils.directoryToPath([this.mailboxFolderPrefix, this.MAILBOX_CONFIG_FILENAME]);
            let encoder = new TextEncoder();
            let uint8Array = encoder.encode(JSON.stringify(json));
            let bytes = convertToByteArray(uint8Array);
            return this.sandboxedApp.writeInternal(filePath, bytes);
        },
        findFolderDirectory: function(folderName) {
            for (var i=0; i < this.mailboxClientProperties.userFolders.length; i++) {
                let folder = this.mailboxClientProperties.userFolders[i];
                if (folder.name == folderName) {
                    return folder.path;
                }
            }
            throw new Error("Folder not found!");
        },
        requestDeleteFolder: function(folderName, callback) {
            let that = this;
            if (this.isInbuiltFolderName(folderName)) {
                callback(false);
            }
            this.confirmDeleteFolder(folderName,
                () => {
                    setTimeout(function(){
                        that.showConfirm = false;
                        that.spinner(true);
                        let dirPath = peergos.client.PathUtils.directoryToPath(
                            [that.mailboxFolderPrefix, that.findFolderDirectory(folderName)]);
                        that.sandboxedApp.deleteInternal(dirPath).thenApply(function(res) {
                            that.postDeleteFolder(folderName, callback);
                        }).exceptionally(function(throwable) {
                            if (throwable.toString() == "java.util.NoSuchElementException") { //Because folder is empty
                                that.postDeleteFolder(folderName, callback);
                            } else {
                                that.spinner(false);
                                that.showError("Unable to delete Folder");
                                console.log(throwable.getMessage());
                                callback(false);
                            }
                        });
                    });
                },
                () => {
                    that.showConfirm = false;
                    callback(false);
                }
            );
        },
        postDeleteFolder: function(folderName, callback) {
            let that = this;
            this.mailboxClientProperties.userFolders.splice(this.mailboxClientProperties.userFolders.findIndex(v => v.name === folderName), 1);
            this.updatePropertiesFile(this.mailboxClientProperties).thenApply(res => {
                that.spinner(false);
                callback(res);
            });
        },
        confirmDeleteFolder: function(folderName, deleteFunction, cancelFunction) {
            this.confirm_message='Are you sure you want to delete folder: ' + folderName + " ?";
            this.confirm_body='';
            this.confirm_consumer_cancel_func = cancelFunction;
            this.confirm_consumer_func = deleteFunction;
            this.showConfirm = true;
        },
        requestUploadAttachment: function(data, callback) {
            let that = this;
            this.spinner(true);
            that.uploadAttachment(data).thenApply(resp => {
                that.spinner(false);
                callback(resp);
            });
        },
        requestSendEmail: function(data, callback) {
            let that = this;
            this.spinner(true);
            //Note: msgId, timestamp and from email address are replaced serverside for security
            data.id = this.createUUID();
            data.msgId = this.createUUID();
            data.from = "";
            let timestamp = peergos.client.JsUtil.now();
            this.messageToTimestamp.set(data.id, timestamp);
            data.timestamp = timestamp.toString();
            this.uploadForwardedAttachments(data).thenApply(forwardedAttachments => {
                if (!forwardedAttachments) {
                    callback(false);
                } else {
                    let javaEmail = that.buildEmail(data, true);
                    that.mailboxClient.send(javaEmail).thenApply(copiedToOutbox => {
                        that.spinner(false);
                        callback(copiedToOutbox);
                    });
                }
            });
        },
        uploadForwardedAttachments: function(data) {
            let future = peergos.shared.util.Futures.incomplete();
            if (data.forwardingToEmail == null) {
                future.complete(true);
            } else {
                this.reduceMovingForwardedAttachments(data.forwardingToEmail.attachments, 0, future);
            }
            return future;
        },
        reduceMovingForwardedAttachments: function(attachments, index, future) {
            let that = this;
            if (index >= attachments.length) {
                future.complete(true);
            } else {
                let attachment = attachments[index];
                let srcDirStr = this.mailboxFolderPrefix + '/attachments/' + attachment.uuid;
                let srcFilePath = peergos.client.PathUtils.directoryToPath(srcDirStr.split('/'));
                this.sandboxedApp.readInternal(srcFilePath).thenApply(bytes => {
                    let destDirStr = this.mailboxFolderPrefix + '/pending/outbox/attachments/' + attachment.uuid;
                    let destFilePath = peergos.client.PathUtils.directoryToPath(destDirStr.split('/'));
                    that.sandboxedApp.writeInternal(destFilePath, bytes).thenApply(res => {
                        that.reduceMovingForwardedAttachments(attachments, ++index, future);
                    }).exceptionally(function(throwable) {
                        that.showError("Unable to move attachment to pending outbox:" + destFilePath);
                        console.log(throwable.getMessage());
                        future.complete(false);
                    });
                }).exceptionally(function(throwable) {
                    that.showError("Unable to read existing attachment:" + srcFilePath);
                    console.log(throwable.getMessage());
                    future.complete(false);
                });
            }
        },
        checkAvailableSpace: function(fileSize) {
            return Number(this.quotaBytes.toString()) - (Number(this.usageBytes.toString()) + fileSize);
        },
        uploadAttachment: function(data) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let totalSize = data.byteLength;
            let spaceAfterOperation = this.checkAvailableSpace(totalSize);
            if (spaceAfterOperation < 0) {
                that.showError("Attachment exceeds available Space",
                    "Please free up " + this.convertBytesToHumanReadable('' + -spaceAfterOperation) + " and try again");
                future.complete(null);
            } else {
                this.mailboxClient.uploadAttachment(data).thenApply(function(uuid) {
                    future.complete(uuid);
                }).exceptionally(err => {
                    that.showError("unable to upload attachment");
                    console.log(err);
                    future.complete(null);
                });
            }
            return future;
        },
        requestImportCalendarAttachment: function(attachment, callback) {
            let path = this.context.username + '/.apps/' + this.currentAppName + '/data/default/attachments';
            callback();
            let that = this;
            setTimeout(() => {
                that.navigateTo = { app: "Calendar", navigationPath: path, navigationFilename: attachment.uuid};
                that.closeSandbox();
            });
        },
        retrieveAttachment: function(uuid) {
            let path = this.context.username + '/.apps/' + this.currentAppName + '/data/default/attachments/' + uuid;
            return this.context.getByPath(path);
        },
        requestDownloadAttachment: function(attachment, callback) {
            let that = this;
            this.retrieveAttachment(attachment.uuid).thenApply(function(optFile) {
                callback(optFile.ref != null);
                that.downloadFile(optFile.ref, attachment.filename);
                //that.showError("Unable to find email attachment:" + attachment.filename);
            });
        },
        getStringRequestParam: function(params, name) {
            var val = params.get(name);
            if (val.startsWith('"') && val.endsWith('"')) {
                val = val.substring(1, val.length -1);
            }
            return val;
        },
        // need to add error handling, null params, invalid chars etc... look at chat api handling for checks
        handleMailboxRequest: function(headerFunc, path, apiMethod, data, hasFormData, params) {
            let that = this;
            let encoder = new TextEncoder();
            if(apiMethod == 'GET') {
                let filterStarredEmailsParam = params.get('filterStarredEmails');
                let filterStarredEmails = filterStarredEmailsParam != null && filterStarredEmailsParam.toLowerCase() == "true";
                if (path.length == 0) {
                    let userFolders = [];
                    for(var i=0;i < that.mailboxClientProperties.userFolders.length;i++) {
                        let folder = that.mailboxClientProperties.userFolders[i];
                        userFolders.push({name: folder.name, path: folder.path});
                    }
                    let data = encoder.encode(JSON.stringify({userFolders: userFolders, mailboxAddress: that.clientMailboxAddress}));
                    that.buildResponse(headerFunc, data, that.GET_SUCCESS);
                } else if (path === "inbox") {
                    that.spinner(true);
                    that.mailboxClient.getNewIncoming().thenApply(emails => {
                        let emailsToRead = emails.toArray([]);
                        let future = peergos.shared.util.Futures.incomplete();
                        that.reduceMovingEmailsToInboxFolder(emailsToRead, 0, future);
                        future.thenApply(done => {
                            that.requestLoadFolder('inbox', filterStarredEmails, (obj) => {
                                that.spinner(false);
                                let data = encoder.encode(JSON.stringify(obj));
                                that.buildResponse(headerFunc, data, that.GET_SUCCESS);
                            });
                        });
                    });
                } else if (path === "sent") {
                    that.spinner(true);
                    that.mailboxClient.getNewSent().thenApply(emails => {
                        let emailsToRead = emails.toArray([]);
                        let future = peergos.shared.util.Futures.incomplete();
                        that.reduceMovingEmailsToSentFolder(emailsToRead, 0, future);
                        future.thenApply(done => {
                            that.requestLoadFolder('sent', filterStarredEmails, (obj) => {
                                that.spinner(false);
                                let data = encoder.encode(JSON.stringify(obj));
                                that.buildResponse(headerFunc, data, that.GET_SUCCESS);
                            });
                        });
                    });
                } else {
                    that.spinner(true);
                    that.requestLoadFolder(path, filterStarredEmails, (obj) => {
                        that.spinner(false);
                        let data = encoder.encode(JSON.stringify(obj));
                        that.buildResponse(headerFunc, data, that.GET_SUCCESS);
                    });
                }
            } else if(apiMethod == 'DELETE') {
                let folderName = path;
                that.requestDeleteFolder(folderName, (result) => {
                    if (result) {
                        that.buildResponse(headerFunc, null, that.DELETE_SUCCESS);
                    } else {
                        that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                    }
                });
            } else if(apiMethod == 'POST') { //REST be damned! RPC rules...
                if (path === "move") {
                    let from = that.getStringRequestParam(params, 'from');
                    let to = that.getStringRequestParam(params, 'to');
                    let emailObj = JSON.parse(new TextDecoder().decode(data));
                    if (!(emailObj.constructor === Array)) {
                        that.requestMoveEmail(emailObj, from, to, (result) => {
                            if (result) {
                                that.buildResponse(headerFunc, null, that.UPDATE_SUCCESS);
                            } else {
                                that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                            }
                        });
                    } else {
                        that.requestMoveEmails(emailObj, from, to, (result) => {
                            if (result) {
                                that.buildResponse(headerFunc, null, that.UPDATE_SUCCESS);
                            } else {
                                that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                            }
                        });
                    }
                } else if(path === "delete") {
                    let folder = that.getStringRequestParam(params, 'folder');
                    let emailObj = JSON.parse(new TextDecoder().decode(data));
                    if (!(emailObj.constructor === Array)) {
                        that.requestDeleteEmail(emailObj, folder, (result) => {
                            if (result) {
                                that.buildResponse(headerFunc, null, that.UPDATE_SUCCESS);
                            } else {
                                that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                            }
                        });
                    } else {
                        that.requestDeleteEmails(emailObj, folder, (result) => {
                            if (result) {
                                that.buildResponse(headerFunc, null, that.UPDATE_SUCCESS);
                            } else {
                                that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                            }
                        });
                    }
                } else if (path === "download") {
                    let attachment = JSON.parse(new TextDecoder().decode(data));
                    that.requestDownloadAttachment(attachment, (result) => {
                        if(result) {
                            that.buildResponse(headerFunc, null, that.GET_SUCCESS);
                        } else {
                            that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                        }
                    });
                }
            } else if(apiMethod == 'PUT') {
                if (path === "attachment") {
                    let bytes = convertToByteArray(new Uint8Array(data));
                    that.requestUploadAttachment(bytes, (resp) => {
                        if (resp != null) {
                            let encoder = new TextEncoder();
                            let json = encoder.encode(JSON.stringify({uuid: resp}));
                            that.buildResponse(headerFunc, json, that.CREATE_SUCCESS);
                        } else {
                            that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                        }
                    });
                } else if (path === "post") {
                    let email = JSON.parse(new TextDecoder().decode(data));
                    that.requestSendEmail(email, (result) => {
                        if (result) {
                            that.buildResponse(headerFunc, null, that.CREATE_SUCCESS);
                        } else {
                            that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                        }
                    });
                } else if (path === "event-inline") {
                    let bytes = convertToByteArray(new Uint8Array(data));
                    that.requestImportCalendarEvent(bytes, () => {
                        that.buildResponse(headerFunc, null, that.CREATE_SUCCESS);
                    });
                } else if (path === "event") {
                    let attachment = JSON.parse(new TextDecoder().decode(data));
                    that.requestImportCalendarAttachment(attachment, () => {
                        that.buildResponse(headerFunc, null, that.CREATE_SUCCESS);
                    });
                } else if (path === "folder") {
                    that.requestNewMailboxFolder((result) => {
                        if (result != null) {
                            let data = encoder.encode(JSON.stringify(result));
                            that.buildResponse(headerFunc, data, that.CREATE_SUCCESS);
                        } else {
                            that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                        }
                    });
                } else if (path === "inbox") {
                    let email = JSON.parse(new TextDecoder().decode(data));
                    that.requestUpdateEmail(email, path, () => {
                        that.buildResponse(headerFunc, null, that.CREATE_SUCCESS);
                    });
                }
            } else if(apiMethod == 'PATCH') {
                // not implemented
            }
        },
        handleChatRequestV1: function(headerFunc, path, apiMethod, data, hasFormData, params) {
            let that = this;
            if(apiMethod == 'GET') {
                let startIndex = params.get("startIndex");
                let chatId = path;
                if (path.length == 0) {
                    this.messenger.listChats().thenApply(function(chats) {
                        let allChats = chats.toArray();
                        let filteredChats = that.filterChats(allChats);
                        let future = peergos.shared.util.Futures.incomplete();
                        let latestMessageMap = new Map();
                        that.buildLatestMessageMap(0, filteredChats.chats, filteredChats.recentMessages, latestMessageMap, future);
                        future.thenApply(res => {
                            let encoder = new TextEncoder();
                            //sort chats
                            let sortedChatRefs = [];
                            latestMessageMap.forEach(function(value, key) {
                                sortedChatRefs.push({chatId: key, lastModified: value.creationTime});
                            });
                            sortedChatRefs.sort(function(aVal, bVal){
                                return bVal.lastModified.localeCompare(aVal.lastModified)
                            });
                            let chatsKV = new Map();
                            filteredChats.chats.forEach(function(value) {
                                chatsKV.set(value.chatId, value);
                            });
                            let sortedChats = [];
                            let latestMessages = [];
                            for(var i = 0; i < sortedChatRefs.length; i++) {
                                let chat = sortedChatRefs[i];
                                sortedChats.push(chatsKV.get(chat.chatId));
                                latestMessages.push(latestMessageMap.get(chat.chatId));
                            }
                            let data = encoder.encode(JSON.stringify({chats: sortedChats, latestMessages: latestMessages}));
                            that.buildResponse(headerFunc, data, that.GET_SUCCESS);
                        });
                    }).exceptionally(function(throwable) {
                        console.log(throwable);
                        that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                    });
                } else if (startIndex != null){
                    let index = this.parsePositiveInt(startIndex);
                    this.messenger.getChat(chatId).thenApply(function(controller) {
                        that.messenger.mergeAllUpdates(controller, that.socialData).thenApply(updatedController => {
                            that.getAllMessages(updatedController, index).thenApply(messageResults => {
                                that.generateMessageHashes(updatedController, messageResults.messages).thenApply(messagePairs => {
                                    let mediaRefs = that.addPendingAttachments(messagePairs);
                                    that.loadAttachments(mediaRefs).thenApply(attachmentMap => {
                                        let messages = [];
                                        for(var j = 0; j < messagePairs.length; j++) {
                                            let messageEnvelope = messagePairs[j].message;
                                            let payload = messageEnvelope.payload;
                                            let type = payload.type().toString();
                                            let author = updatedController.getUsername(messageEnvelope.author);
                                            let removeUsername = type == 'RemoveMember' ?
                                                updatedController.getUsername(messageEnvelope.payload.memberToRemove) : null;
                                            let inviteUsername = type == 'Invite' ? messageEnvelope.payload.username : null;
                                            let joinUsername = type == 'Join' ? messageEnvelope.payload.username : null;
                                            var text = null;
                                            if(type == 'Application') {
                                                let body = payload.body.toArray();
                                                text = body[0].inlineText();
                                            }
                                            if (type == 'Edit' || type == 'ReplyTo') {
                                                let body = payload.content.body.toArray();
                                                text = body[0].inlineText();
                                            }
                                            let attachments = [];
                                            if(type == 'Application' || type == 'ReplyTo') {
                                                let body = type == 'Application' ? payload.body.toArray() : payload.content.body.toArray();
                                                for(var i = 1; i < body.length; i++) {
                                                    let refPath = body[i].reference().ref.path;
                                                    let path = refPath.startsWith("/") ? refPath : "/" + refPath;
                                                    let mediaFile = attachmentMap.get(path);
                                                    if (mediaFile != null) {
                                                        attachments.push(mediaFile);
                                                    }
                                                }
                                            }
                                            var editPriorVersion = null;
                                            if(type == 'Edit') {
                                                editPriorVersion = payload.priorVersion.toString();
                                            }
                                            var deleteTarget = null;
                                            if(type == 'Delete') {
                                                deleteTarget = payload.target.toString();
                                            }
                                            var replyToParent = null;
                                            if(type == 'ReplyTo') {
                                                replyToParent = payload.parent.toString();
                                            }
                                            let messageEnvelopeBytes = messageEnvelope.serialize();
                                            var str = "";
                                            for (var i = 0; i < messageEnvelopeBytes.byteLength; i++) {
                                                str = str + String.fromCharCode(messageEnvelopeBytes[i] & 0xff);
                                            }
                                            let serialisedEnvelope = window.btoa(str);
                                            let groupState = null;
                                            if (type == 'GroupState') {
                                                groupState = { key: payload.key, value: payload.value};
                                            }
                                            let timestamp = that.fromUTCtoLocal(messageEnvelope.creationTime);
                                            let message = { messageRef: messagePairs[j].messageRef.toString(), author: author, timestamp: timestamp, type: type,
                                                  removeUsername: removeUsername, inviteUsername: inviteUsername, joinUsername: joinUsername,
                                                  editPriorVersion: editPriorVersion, deleteTarget: deleteTarget, replyToParent: replyToParent,
                                                  text: text, envelope: serialisedEnvelope,
                                                  groupState: groupState, attachments : attachments
                                            };
                                            messages.push(message);
                                        }
                                        let chatMembers = updatedController.getMemberNames().toArray();
                                        let friendsInChat = that.friendnames.filter(friend => chatMembers.findIndex(v => v === friend) > -1);
                                        let response = {
                                            chatId: chatId,
                                            startIndex: messageResults.startIndex,
                                            messages: messages,
                                            hasFriendsInChat: friendsInChat.length > 0
                                        };
                                        let encoder = new TextEncoder();
                                        let data = encoder.encode(JSON.stringify(response));
                                        that.buildResponse(headerFunc, data, that.GET_SUCCESS);
                                    });
                                });
                            });
                        }).exceptionally(function(throwable) {
                            console.log(throwable);
                            that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                        });
                    });
                } else if (path.endsWith("/icon") || path.endsWith("/icon/")) {
                    let chatId = path.substring(0, path.indexOf("/icon"));
                    that.messenger.getChat(chatId).thenApply(function(controller) {
                        let encoder = new TextEncoder();
                        if(controller.hasGroupProperty("iconBase64")) {
                            let appIconBase64 = controller.getGroupProperty("iconBase64");
                            let data = encoder.encode(appIconBase64);
                            that.buildResponse(headerFunc, data, that.GET_SUCCESS);
                        } else {
                            let data = encoder.encode("");
                            that.buildResponse(headerFunc, data, that.GET_SUCCESS);
                        }
                    });
                }
            } else if(apiMethod == 'DELETE') {
                let chatId = path;
                if(path.startsWith(that.currentAppName + "$") || path.startsWith("chat-" + that.currentAppName + "$")) {
                    this.messenger.getChat(chatId).thenApply(function(controller) {
                        that.messenger.deleteChat(controller).thenApply(res => {
                            that.buildResponse(headerFunc, null, that.DELETE_SUCCESS);
                        }).exceptionally(function(throwable) {
                            console.log(throwable);
                            that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                        });
                    });
                } else {
                    let filePath = decodeURIComponent(path);
                    if (!(filePath.startsWith(this.context.username + "/.messaging/" + this.currentAppName + "$")
                        || filePath.startsWith(this.context.username + "/.messaging/chat-" + this.currentAppName + "$")
                        )) {
                        that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                    } else {
                        let parentPath = filePath.substring(0, filePath.lastIndexOf('/'));
                        this.context.getByPath(parentPath).thenApply(function(optParent){
                            that.context.getByPath(filePath).thenApply(function(optMediaFile){
                                optMediaFile.get().remove(optParent.get(), that.convertToPath(filePath), that.context).thenApply(function(b){
                                    that.buildResponse(headerFunc, null, that.DELETE_SUCCESS);
                                }).exceptionally(function(throwable) {
                                    console.log(throwable);
                                    that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                                });
                            }).exceptionally(function(throwable) {
                                console.log(throwable);
                                that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                            });
                        }).exceptionally(function(throwable) {
                            console.log(throwable);
                            that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                        });
                    }
                }
            } else if(apiMethod == 'POST') {
                if (path.length == 0) {
                    this.messenger.listChats().thenApply(function(chats) {
                        let allChats = chats.toArray();
                        let filteredChats = that.filterChats(allChats).chats;
                        let existingGroupTitles = [];
                        filteredChats.forEach(chat => {
                            existingGroupTitles.push(chat.title);
                        });
                        that.groupId = "";
                        that.groupTitle = "New Chat";
                        that.existingGroups = existingGroupTitles;
                        that.existingGroupMembers = [that.context.username];
                        that.existingAdmins = [that.context.username];
                        that.showGroupMembership = true;
                        that.chatResponseHeader = headerFunc;
                    });
                } else {
                    if (params.get("view")!= null) {
                        let decoder = new TextDecoder();
                        let fileRefJson = decoder.decode(data);
                        let fileRef = peergos.shared.display.FileRef.fromJson(fileRefJson);
                        if ((path.startsWith(this.currentAppName) || path.startsWith("chat-" + this.currentAppName)) && fileRef.path.includes(path + '/shared/media/')) {
                            this.retrieveFileFromFileRef(fileRef).thenApply(filePair => {
                                if (filePair.file != null) {
                                    let props = filePair.file.getFileProperties();
                                    if (props.isHidden || props.isDirectory) {
                                        console.log("Unable to view file. path:" + fileRef.path);
                                        that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                                    } else {
                                        let app = that.getApp(filePair.file, filePair.path);
                                        //that.openFileOrDir(app, fileRef.path, {filename: filePair.file.getName()});
                                        if (app == "Gallery") {
                                            that.filesToViewInGallery = [filePair.file];
                                            that.showEmbeddedGallery = true;
                                            that.buildResponse(headerFunc, null, that.GET_SUCCESS);
                                        } else {
                                            that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                                        }
                                    }
                                } else {
                                    that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                                }
                            });
                        } else {
                            that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                        }
                    }else if (params.get('download') == 'true') {
                        let decoder = new TextDecoder();
                        let fileRefJson = decoder.decode(data);
                        let fileRef = peergos.shared.display.FileRef.fromJson(fileRefJson);
                        if ((path.startsWith(this.currentAppName) || path.startsWith("chat-" + this.currentAppName)) && fileRef.path.includes(path + '/shared/media/')) {
                            this.retrieveFileFromFileRef(fileRef).thenApply(filePair => {
                                if (filePair != null) {
                                    let props = filePair.file.getFileProperties();
                                    if (props.isHidden || props.isDirectory) {
                                        console.log("Unable to download file. path:" + fileRef.path);
                                        that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                                    } else {
                                        let extension = filePair.file.getName().substring(filePair.file.getName().lastIndexOf('.') + 1);
                                        that.downloadFile(filePair.file, "attachment." + extension);
                                        that.buildResponse(headerFunc, null, that.GET_SUCCESS);
                                    }
                                } else {
                                    that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                                }
                            });
                        } else {
                            that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                        }
                    }else if (params.get('contents') == 'true') {
                        let decoder = new TextDecoder();
                        let fileRefJson = decoder.decode(data);
                        let fileRef = peergos.shared.display.FileRef.fromJson(fileRefJson);
                        if ((path.startsWith(this.currentAppName) || path.startsWith("chat-" + this.currentAppName)) && fileRef.path.includes(path + '/shared/media/')) {
                            this.retrieveFileFromFileRef(fileRef).thenApply(filePair => {
                                if (filePair != null) {
                                    let props = filePair.file.getFileProperties();
                                    if (props.isHidden || props.isDirectory) {
                                        console.log("Unable to find file. path:" + fileRef.path);
                                        that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                                    } else {
                                        that.contents(filePair.file).thenApply(data => {
                                            that.buildResponse(headerFunc, data, that.GET_SUCCESS);
                                        });
                                    }
                                } else {
                                    that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                                }
                            });
                        } else {
                            that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                        }
                    } else if (path.endsWith("/attachment") || path.endsWith("/attachment/")) {
                        let filename = decodeURIComponent(params.get('filename')).trim();
                        if (filename == null || filename.length == 0) {
                            that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                        } else {
                            let bytes = convertToByteArray(new Uint8Array(data));
                            let chatId = path.substring(0, path.indexOf("/attachment"))
                            let availableSpace = Number(this.quotaBytes.toString()) - Number(this.usageBytes.toString());
                            let spaceAfterOperation = availableSpace - data.length;
                            if (spaceAfterOperation < 0) {
                                this.showToastError("Attachment size exceeds available Space: " + filename);
                                this.buildResponse(headerFunc, null, that.ACTION_FAILED);
                            } else {
                                this.uploadFileAction(headerFunc, filename, bytes, chatId);
                            }
                        }
                    } else if (path.endsWith("/icon") || path.endsWith("/icon/")) {
                        let chatId = path.substring(0, path.indexOf("/icon"));
                        this.app_prompt_value = '';
                        this.prompt_action = that.translate("PROMPT.OK");
                        var existingAppIconBase64 = "";
                        let encoder = new TextEncoder();
                        let data = encoder.encode("");
                        this.messenger.getChat(chatId).thenApply(function(controller) {
                            that.app_prompt_message = controller.getTitle();
                            if(controller.hasGroupProperty("iconBase64")) {
                                existingAppIconBase64 = controller.getGroupProperty("iconBase64");
                                that.appIconBase64Image = existingAppIconBase64.length == 0 ? "" : existingAppIconBase64;
                            } else {
                                that.appIconBase64Image = "";
                            }
                            that.closeAppTemplatePrompt_func = function () {
                                that.showAppTemplatePrompt = false;
                            };
                            that.app_prompt_consumer_func = function (prompt_result, appIconBase64) {
                                if (appIconBase64 != null && appIconBase64 != existingAppIconBase64) {
                                    that.messenger.setGroupProperty(controller, "iconBase64", appIconBase64).thenApply(function(updatedController2) {
                                        that.buildResponse(headerFunc, data, that.CREATE_SUCCESS);
                                        that.showAppTemplatePrompt = false;
                                    }).exceptionally(err => {
                                        console.log('iconBase64 call failed: ' + err);
                                        that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                                        that.showAppTemplatePrompt = false;
                                    });
                                } else {
                                    that.buildResponse(headerFunc, data, that.CREATE_SUCCESS);
                                    that.showAppTemplatePrompt = false;
                                }
                            };
                            that.showAppTemplatePrompt = true;
                        });
                    }else {
                        let chatId = path;
                        this.messenger.listChats().thenApply(function(chats) {
                            let allChats = chats.toArray();
                            let filteredChats = that.filterChats(allChats).chats;
                            let existingGroupTitles = [];
                            let existingChat = null;
                            filteredChats.forEach(chat => {
                                existingGroupTitles.push(chat.title);
                                if (chat.chatId == chatId) {
                                    that.groupTitle = chat.title;
                                    existingChat = chat;
                                }
                            });
                            that.groupId = chatId;
                            that.existingGroups = existingGroupTitles;
                            that.existingGroupMembers = existingChat.members.slice();
                            that.existingAdmins = existingChat.admins.slice();
                            that.showGroupMembership = true;
                            that.chatResponseHeader = headerFunc;
                        });
                    }
                }
            } else if(apiMethod == 'PUT') {
                let chatId = path;
                let json = JSON.parse(new TextDecoder().decode(data));
                if (json.createMessage != null) {
                    if (json.createMessage.attachments.length == 0) {
                        let message = peergos.shared.messaging.messages.ApplicationMessage.text(json.createMessage.text);
                        that.sendMessageAction(headerFunc, chatId, message);
                    } else {
                        let fileRefs = json.createMessage.attachments.map(i => peergos.shared.display.FileRef.fromJson(JSON.stringify(i)));
                        let fileRefList = peergos.client.JsUtil.asList(fileRefs);
                        let message = peergos.shared.messaging.messages.ApplicationMessage.attachment(json.createMessage.text, fileRefList);
                        that.sendMessageAction(headerFunc, chatId, message);
                    }
                } else if (json.editMessage != null) {
                    let message = peergos.shared.messaging.messages.ApplicationMessage.text(json.editMessage.text);
                    let contentHash = new peergos.shared.io.ipfs.Multihash.fromBase58(json.editMessage.messageRef);
                    let messageRef = new peergos.shared.messaging.MessageRef(contentHash);
                    let edit = new peergos.shared.messaging.messages.EditMessage(messageRef, message);
                    that.sendMessageAction(headerFunc, chatId, edit);
                } else if (json.replyMessage != null) {
                    let arr = Uint8Array.from(window.atob(json.replyMessage.replyTo), c => c.charCodeAt(0));
                    let replyToCbor = peergos.client.JsUtil.fromByteArray(convertToByteArray(arr));
                    let replyToEnvelope = peergos.shared.messaging.MessageEnvelope.fromCbor(replyToCbor);
                    if (json.replyMessage.attachments.length == 0) {
                        let message = peergos.shared.messaging.messages.ApplicationMessage.text(json.replyMessage.text);
                        peergos.shared.messaging.messages.ReplyTo.build(replyToEnvelope, message, this.context.crypto.hasher).thenApply(function(replyTo) {
                            that.sendMessageAction(headerFunc, chatId, replyTo);
                        });
                    } else {
                        let fileRefs = json.replyMessage.attachments.map(i => peergos.shared.display.FileRef.fromJson(JSON.stringify(i)));
                        let fileRefList = peergos.client.JsUtil.asList(fileRefs);
                        let message = peergos.shared.messaging.messages.ApplicationMessage.attachment(json.replyMessage.text, fileRefList);
                        peergos.shared.messaging.messages.ReplyTo.build(replyToEnvelope, message, this.context.crypto.hasher).thenApply(function(replyTo) {
                            that.sendMessageAction(headerFunc, chatId, replyTo);
                        });
                    }
                } else if (json.deleteMessage != null) {
                    let contentHash = new peergos.shared.io.ipfs.Multihash.fromBase58(json.deleteMessage.messageRef);
                    let messageRef = new peergos.shared.messaging.MessageRef(contentHash);
                    let deleteMessage = new peergos.shared.messaging.messages.DeleteMessage(messageRef);
                    that.sendMessageAction(headerFunc, chatId, deleteMessage);
                } else {
                    that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                }
            } else if(apiMethod == 'PATCH') {
                // not implemented
            }
        },
        sendMessageAction: function(headerFunc, chatId, msg) {
            let that = this;
            this.messenger.getChat(chatId).thenApply(function(controller) {
                that.messenger.sendMessage(controller, msg).thenApply(function(updatedController) {
                    that.buildResponse(headerFunc, null, that.CREATE_SUCCESS);
                }).exceptionally(function(throwable) {
                    console.log(throwable);
                    that.showToastError("Unable to send message");
                    that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                });
            });
        },
        retrieveFileFromFileRef: function(ref) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let mirrorPath = this.replaceOwnerInPath(this.context.username, ref.path);
            this.context.getByPath(mirrorPath).thenApply(function(optFile) {
                let mediaFile = optFile.ref;
                if (mediaFile != null) {
                    future.complete({path: mirrorPath, file: mediaFile});
                } else {
                    //fallback to attachment sender
                    let owner = that.extractOwnerFromPath(ref.path);
                    that.context.network.getFile(ref.cap, owner).thenApply(optFile => {
                       let mediaFile = optFile.ref;
                       if (mediaFile != null) {
                           future.complete({path: ref.path, file: mediaFile});
                       } else {
                           future.complete(null);
                       }
                    }).exceptionally(err => {
                        future.complete(null);
                    });
                }
            }).exceptionally(err => {
                future.complete(null);
            });
            return future;
        },
        uploadFileAction: function(headerFunc, filename, fileData, chatId) {
            let that = this;
            let progress = {};
            let thumbnailAllocation = Math.min(100000, fileData.length / 10);
            let resultingSize = fileData.length + thumbnailAllocation;
            let progressTitle = fileData.length < 1 * 1024 * 1024 ? "Uploading file" : "Encrypting and uploading " + filename;
            progress = {
                title: progressTitle,
                done:0,
                max:resultingSize,
                name: filename
            };
            this.$toast({component: ProgressBar,props:  progress,}
                , { icon: false , timeout:false, id: filename})
            this.progressMonitors.push(progress);
            let updateProgressBar = function(len){
                progress.done += len.value_0;
                that.$toast.update(progress.name, {content:
                    {
                        component: ProgressBar,
                        props:  {
                        title: progress.title,
                        done: progress.done,
                        max: progress.max
                        },
                    }
                });
                if (progress.done >= progress.max) {
                    that.$toast.dismiss(progress.name);
                }
            };
            this.uploadMedia(filename, fileData, updateProgressBar, chatId).thenApply(function(mediaResponse) {
                if (mediaResponse == null) {
                    that.buildResponse(headerFunc, null, that.ACTION_FAILED);
                } else {
                    let fileRefJson = mediaResponse.mediaItem.toJson();
                    let fileRefObj = JSON.parse(fileRefJson);
                    let json = {
                        fileRef: fileRefObj,
                        hasMediaFile: mediaResponse.mediaFile != null,
                        hasThumbnail: mediaResponse.mediaFile != null && mediaResponse.mediaFile.getFileProperties().thumbnail.ref != null,
                        thumbnail: mediaResponse.mediaFile.getBase64Thumbnail(),
                        fileType: mediaResponse.mediaFile.getFileProperties().getType(),
                        mimeType: mediaResponse.mediaFile.getFileProperties().mimeType,
                        size: mediaResponse.mediaFile.getFileProperties().sizeLow()
                    };
                    let idx = that.progressMonitors.indexOf(progress);
                    if(idx >= 0) {
                        that.progressMonitors.splice(idx, 1);
                    }
                    let encoder = new TextEncoder();
                    let data = encoder.encode(JSON.stringify(json));
                    that.buildResponse(headerFunc, data, that.CREATE_SUCCESS);
                }
            });
        },
        uploadMedia: function(filename, fileData, updateProgressBar, chatId) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let reader = new peergos.shared.user.fs.AsyncReader.ArrayBacked(fileData);
            var fileExtension = "";
            let dotIndex = filename.lastIndexOf('.');
            if (dotIndex > -1 && dotIndex <= filename.length -1) {
                fileExtension = filename.substring(dotIndex + 1);
            }
            let postTime = peergos.client.JsUtil.now();
            that.messenger.getChat(chatId).thenApply(function(controller) {
                that.messenger.uploadMedia(controller, reader, fileExtension, fileData.length, postTime, updateProgressBar).thenApply(function(pair) {
                    var thumbnailAllocation = Math.min(100000, fileData.length / 10);
                    updateProgressBar({ value_0: thumbnailAllocation});
                    that.context.getByPath(pair.right.path).thenApply(function(fileOpt){
                        let file = fileOpt.ref;
                        future.complete({mediaItem: pair.right, mediaFile: file});
                    }).exceptionally(err => {
                        that.showToastError("unable to get uploaded media");
                        console.log(err);
                        future.complete(null);
                    });
                }).exceptionally(err => {
                    that.showToastError("unable to upload media");
                    console.log(err);
                    future.complete(null);
                });
            });
            return future;
        },
        handleChatRequestV0: function(header, path, apiMethod, data, hasFormData, params) {
            let that = this;
            if(apiMethod == 'GET') {
                let chatId = path;
                let messenger = new peergos.shared.messaging.Messenger(this.context);
                if (chatId.length == 0) {
                    messenger.listChats().thenApply(function(chats) {
                        let allChats = chats.toArray();
                        let filteredChats = [];
                        for(var i = 0; i < allChats.length; i++) {
                            let chat = allChats[i];
                            if(chat.chatUuid.startsWith("chat-" + that.currentAppName + "$")) {
                                filteredChats.push({chatId: chat.chatUuid, title: chat.getTitle()});
                            }
                        }
                        let encoder = new TextEncoder();
                        let data = encoder.encode(JSON.stringify(filteredChats));
                        that.buildResponse(header, data, that.GET_SUCCESS);
                    });
                } else {
                    let from = params.get("from");
                    let to = params.get("to");
                    if (!this.validateRange(from, to)) {
                        console.log('Get messages paging parameters are invalid');
                        that.buildResponse(header, null, that.ACTION_FAILED);
                        return;
                    }
                    let startIndex = parseInt(from, 10);
                    let endIndex = startIndex + parseInt(to, 10);
                    messenger.getChat(chatId).thenApply(function(controller) {
                        messenger.mergeAllUpdates(controller, that.socialData).thenApply(updatedController => {
                            updatedController.getMessages(startIndex, endIndex).thenApply(result => {
                                let newMessages = result.toArray();
                                let accumulator = {messages:[], count: newMessages.length};
                                let future = peergos.shared.util.Futures.incomplete();
                                that.buildOutputMessages(updatedController, 0, newMessages, accumulator, future);
                                future.thenApply(done => {
                                    let encoder = new TextEncoder();
                                    let data = encoder.encode(JSON.stringify(accumulator));
                                    that.buildResponse(header, data, that.GET_SUCCESS);
                                });
                            });
                        });
                    });
                }
            } else if(apiMethod == 'DELETE') {
                let chatId = path;
                let messenger = new peergos.shared.messaging.Messenger(this.context);
                messenger.getChat(chatId).thenApply(function(controller) {
                    messenger.deleteChat(controller).thenApply(res => {
                        that.buildResponse(header, null, that.DELETE_SUCCESS);
                    }).exceptionally(err => {
                        console.log('deleteChat call failed: ' + err);
                        that.buildResponse(header, null, that.ACTION_FAILED);
                    });
                }).exceptionally(err => {
                    console.log('getChat call failed: ' + err);
                    that.buildResponse(header, null, that.ACTION_FAILED);
                });
            } else if(apiMethod == 'POST') {
                let requestBody = JSON.parse(new TextDecoder().decode(data));
                let min = 1;
                let max = requestBody.maxInvites;
                if (!this.validateRange(min, max)) {
                    console.log('CreateChat params are invalid');
                    that.buildResponse(header, null, that.ACTION_FAILED);
                    return;
                }
                this.chatResponseHeader = header;
                this.appDisplayName = this.appProperties.displayName;
                this.maxFriendsToAdd = parseInt(max, 10);
                this.chatTitle = requestBody.title;
                this.showInviteFriends = true;
            } else if(apiMethod == 'PUT') {
                let requestBody = JSON.parse(new TextDecoder().decode(data));
                let msg = peergos.shared.messaging.messages.ApplicationMessage.text(requestBody.text);
                let chatId = path;
                let messenger = new peergos.shared.messaging.Messenger(this.context);
                messenger.getChat(chatId).thenApply(function(controller) {
                    messenger.sendMessage(controller, msg).thenApply(function(updatedController) {
                        that.buildResponse(header, null, that.CREATE_SUCCESS);
                    });
                });
            } else if(apiMethod == 'PATCH') {
                // not implemented
            }
        },
        updateChat: function(usersToAdd, chatTitle) {
            let that = this;
            let messenger = new peergos.shared.messaging.Messenger(this.context);
            messenger.createAppChat(this.currentAppName).thenApply(function(controller){
                that.inviteChatParticipants(messenger, controller, usersToAdd).thenApply(updatedController => {
                    messenger.setGroupProperty(updatedController, "title", chatTitle).thenApply(function(updatedController2) {
                        let encoder = new TextEncoder();
                        let chatIdBytes = encoder.encode(updatedController2.chatUuid);
                        that.buildResponse(that.chatResponseHeader, chatIdBytes, that.CREATE_SUCCESS);
                    }).exceptionally(err => {
                        console.log('setTitle call failed: ' + err);
                        that.buildResponse(that.chatResponseHeader, null, that.ACTION_FAILED);
                    });
                }).exceptionally(err => {
                    console.log('inviteChatParticipants call failed: ' + err);
                    that.buildResponse(that.chatResponseHeader, null, that.ACTION_FAILED);
                });
            }).exceptionally(err => {
                console.log('createAppChat call failed: ' + err);
                that.buildResponse(that.chatResponseHeader, null, that.ACTION_FAILED);
            });
        },
        getPublicKeyHashes: function(usernames) {
            let that = this;
            const usernameToPKH = new Map();
            let future = peergos.shared.util.Futures.incomplete();
            usernames.forEach(username => {
                that.context.getPublicKeys(username).thenApply(pkOpt => {
                    usernameToPKH.set(username, pkOpt.get().left);
                    if(usernameToPKH.size == usernames.length) {
                        let pkhs = [];
                        usernames.forEach(user => {
                            pkhs.push(usernameToPKH.get(user));
                        });
                        future.complete(peergos.client.JsUtil.asList(pkhs));
                    }
                });
            });
            return future;
        },
        inviteChatParticipants: function(messenger, controller, usernames) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            this.getPublicKeyHashes(usernames).thenApply(pkhList => {
                let usernameList = peergos.client.JsUtil.asList(usernames);
                messenger.invite(controller, usernameList, pkhList).thenApply(updatedController => {
                    future.complete(updatedController);
                }).exceptionally(err => {
                    that.showError("Unable to add users to chat");
                    console.log(err);
                    future.complete(null);
                });
            });
            return future;
        },
        buildOutputMessages: function(chatController, index, messages, accumulator, future) {
            let that = this;
            if (index == messages.length) {
                future.complete(true);
            } else {
                let envelope = messages[index];
                chatController.generateHash(envelope).thenApply(messageRef => {
                    let payload = envelope.payload;
                    let timestamp = that.fromUTCtoLocal(envelope.creationTime);
                    let type = payload.type().toString();
                    let author = chatController.getUsername(envelope.author);
                    if(type == 'Application') {
                        let body = payload.body.toArray();
                        let text = body[0].inlineText();
                        accumulator.messages.push({type: type, id: messageRef.toString(), text: text, author: author, timestamp: timestamp});
                    } else if(type== 'Join') {
                        let username = envelope.payload.username;
                        accumulator.messages.push({type: type, username: username, timestamp: timestamp});
                    }
                    that.buildOutputMessages(chatController, index + 1, messages, accumulator, future);
                });
            }
        },
        fromUTCtoLocal: function(dateTime) {
            let date = new Date(dateTime.toString() + "+00:00");//adding UTC TZ in ISO_OFFSET_DATE_TIME ie 2021-12-03T10:25:30+00:00
            let formatted = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate()
                + ' ' + (date.getHours() < 10 ? '0' : '') + date.getHours()
                + ':' + (date.getMinutes() < 10 ? '0' : '') + date.getMinutes()
                + ':' + (date.getSeconds() < 10 ? '0' : '') + date.getSeconds();
            return formatted;
        },
        handleBrowserRequest: function(headerFunc, path, params, isFromRedirect, isNavigate) {
            let that = this;
            if (path.includes('/.')) {
                that.showError('Path not accessible: ' + path);
                that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                return;
            }
            this.findFile(path, isFromRedirect).thenApply(file => {
                if (file == null) {
                    that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                } else {
                    let props = file.getFileProperties();
                    if (props.isHidden) {
                        that.showError('Path not accessible: ' + filePath);
                        that.buildResponse(header, null, that.ACTION_FAILED);
                    } else if(props.isDirectory) {
                        let indexPath = path + '/index.html';
                        that.findFile(indexPath, isFromRedirect).thenApply(indexFile => {
                            if (indexFile == null) {
                                that.closeAndLaunchApp(headerFunc, "Drive", path, "");
                            } else {
                                that.handleBrowserRequest(headerFunc, indexPath, params, isFromRedirect, isNavigate);
                            }
                        });
                    } else {
                        if (isNavigate) {
                            that.fullPathForDisplay = path;
                            if (!that.running) {
                                that.running = true;
                                that.setBookmarkIcon();
                                that.readFileOrFolder(headerFunc, path, params, false, false);
                            } else {
                                let fullPath = that.expandFilePath(path, isFromRedirect);
                                var app = that.getApp(file, fullPath);
                                let navigationPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
                                var navigationFilename = fullPath.substring(fullPath.lastIndexOf('/') + 1);
                                if (app == 'hex') {
                                   app = 'Drive';
                                   navigationFilename = '';
                                }
                                // If we are navigating to an 'external' link, use a new context on a different subdomain
                                if (app == 'htmlviewer' && that.extractWorkspace(fullPath) == that.workspaceName) {
                                    that.setBookmarkIcon();
                                    that.readFileOrFolder(headerFunc, path, params, false, true);
                                } else {
                                    that.closeAndLaunchApp(headerFunc, app, navigationPath, navigationFilename);
                                }
                            }
                        } else {
                            that.readFileOrFolder(headerFunc, path, params, false, false);
                        }
                    }
                }
            });
        },
        setBookmarkIcon: function() {
            if (this.shortcuts.shortcutsMap.get(this.fullPathForDisplay) == null) {
                this.displayToBookmark = true;
            } else {
                this.displayToBookmark = false;
            }
        },
        closeAndLaunchApp: function(headerFunc, app, path, filename) {
            this.buildResponse(headerFunc(), null, this.NAVIGATE_TO);
            this.navigateTo = { app: app, navigationPath: path, navigationFilename: filename};
            this.closeSandbox();
        },
        readFileOrFolder: function(headerFunc, path, params, ignoreHiddenFolderCheck, updateTargetFile) {
            let that = this;
            let expandedFilePath = this.expandFilePath(path);
            if (this.browserMode && expandedFilePath.includes('/.')) {
                that.showError('Path not accessible: ' + expandedFilePath);
                that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
            } else {
                this.context.getByPath(expandedFilePath).thenApply(function(respOpt){
                    if (respOpt.ref == null) {
                        console.log('Path not found: ' + expandedFilePath);
                        that.buildResponse(headerFunc(), null, that.FILE_NOT_FOUND);
                    } else {
                        let resp = respOpt.get();
                        let props = resp.getFileProperties();
                        if (!props.isDirectory && props.isHidden) {
                            that.showError('File not accessible: ' + expandedFilePath);
                            that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                        } else if (props.isDirectory && props.isHidden && !ignoreHiddenFolderCheck) {
                            that.showError('Folder not accessible: ' + expandedFilePath);
                            that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                        } else {
                            if (props.isDirectory) {
                                let filterResults =  !that.appRegisteredWithWildcardFileAssociation
                                    && (that.appProperties.folderAction
                                        && expandedFilePath.startsWith(that.appPath)
                                        && that.appRegisteredWithFileAssociation
                                        );
                                that.readFolderListing(filterResults, headerFunc("text/plain"), resp);
                            } else {
                                let fileType = props.getType();
                                if (params.get('preview') == 'true') {
                                    if (fileType == 'image' || fileType == 'video') {
                                        that.readInThumbnail(headerFunc("text/plain"), resp);
                                    } else {
                                        that.buildResponse(headerFunc(), null, that.ACTION_FAILED);
                                    }
                                } else {
                                    if (updateTargetFile) {
                                        that.targetFile = resp;
                                    }
                                    that.readInFile(headerFunc, resp);
                                }
                            }
                        }
                    }
                });
            }
        },
        readInThumbnail: function(header, file) {
            let thumbnail = file.getBase64Thumbnail();
            let encoder = new TextEncoder();
            let data = encoder.encode(thumbnail);
            this.buildResponse(header, data, this.GET_SUCCESS);
        },
        readFolderListing: function(filterResults, header, folder) {
            let that = this;
            folder.getChildren(that.context.crypto.hasher, that.context.network).thenApply(function(children) {
                let arr = children.toArray();
                let folderListing = {files:[], subFolders:[]};
                arr.forEach(function(child){
                    let props = child.getFileProperties();
                    if (!props.isHidden) {
                        if(props.isDirectory) {
                            folderListing.subFolders.push(child.getName());
                        } else {
                            if (filterResults) {
                                if (that.isFileAssociatedWithApp(child)) {
                                    folderListing.files.push(child.getName());
                                }
                            } else {
                                folderListing.files.push(child.getName());
                            }
                        }
                    }
                });
                let encoder = new TextEncoder();
                let data = encoder.encode(JSON.stringify(folderListing));
                that.buildResponse(header, data, that.GET_SUCCESS);
            });
        },
        isFileAssociatedWithApp: function(file) {
            let that = this;
            let fileProperties = file.getFileProperties();
            let filename = fileProperties.name;
            let extension = filename.substring(filename.lastIndexOf(".") + 1);
            var matchOnFileExtension = this.sandboxedApps.appFileExtensionRegistrationMap.get(extension);
            matchOnFileExtension = matchOnFileExtension == null ? [] : matchOnFileExtension;
            if (matchOnFileExtension.filter(a => a.name == that.appProperties.name).length > 0) {
                return true;
            }
            let mimeType = fileProperties.mimeType;
            var matchOnMimeType = this.sandboxedApps.appMimeTypeRegistrationMap.get(mimeType)
            matchOnMimeType = matchOnMimeType == null ? [] : matchOnMimeType;
            if (matchOnMimeType.filter(a => a.name == that.appProperties.name).length > 0) {
                return true;
            }
            let fileType = fileProperties.getType();
            var matchOnFileType = this.sandboxedApps.appFileTypeRegistrationMap.get(fileType)
            matchOnFileType = matchOnFileType == null ? [] : matchOnFileType;
            if (matchOnFileType.filter(a => a.name == that.appProperties.name).length > 0) {
                return true;
            }
            return false;
        },
        overwriteFile: function(header, filePath, bytes, fileToOverwrite, refreshTargetFile) {
            let that = this;
            let props = fileToOverwrite.getFileProperties();
            if (props.isHidden) {
                that.showError('Path not accessible: ' + filePath);
                that.buildResponse(header, null, that.ACTION_FAILED);
            } else if(props.isDirectory) {
                that.showError('Unable to overwrite folder: ' + filePath);
                that.buildResponse(header, null, that.ACTION_FAILED);
            } else {
                this.invokeOverwriteFile((isOK) => {
                    let future = peergos.shared.util.Futures.incomplete();
                    if (!isOK) {
                        that.buildResponse(header, null, that.ACTION_FAILED);
                        future.complete(true);
                    } else {
                        let java_reader = peergos.shared.user.fs.AsyncReader.build(bytes);
                        let sizeHi = (bytes.length - (bytes.length % Math.pow(2, 32)))/Math.pow(2, 32);
                        let moreRecentFile = that.commandFileRefs.get(filePath);
                        let currentFile = moreRecentFile != null ? moreRecentFile : fileToOverwrite;
                        currentFile.overwriteFileJS(java_reader, sizeHi, bytes.length, that.context.network, that.context.crypto, len => {})
                        .thenApply(function(updatedFile) {
                            if (refreshTargetFile) {
                                that.targetFile = updatedFile;
                            }
                            that.commandFileRefs.set(filePath, updatedFile);
                            that.$emit("refresh");
                            that.buildResponse(header, null, that.UPDATE_SUCCESS);
                            future.complete(true);
                        }).exceptionally(function(throwable) {
                            let msg = that.uriDecode(throwable.detailMessage);
                            if (msg.includes('Concurrent modification of a file or directory!')) {
                                that.currentSaveConflictBytes = bytes;
                                that.save_conflict_consumer_func = function (bytes) {
                                    that.continueSaveConflictPrompt(bytes, refreshTargetFile, (res, path, filename) => {
                                        if (res) {
                                            setTimeout(() => {
                                                that.navigateTo = { app: that.currentAppName, navigationPath: "/" + path, navigationFilename: filename};
                                                that.closeSandbox();
                                            }, 10);
                                        }
                                    });
                                };
                                that.close_conflict_consumer_func = function (bytes) {
                                    that.showSaveConflictPrompt = false;
                                    that.buildResponse(header, null, that.ACTION_FAILED);
                                    future.complete(false);
                                };
                                that.cancel_conflict_consumer_func = function (bytes) {
                                    that.showSaveConflictPrompt = false;
                                    that.buildResponse(header, null, that.ACTION_FAILED);
                                    future.complete(false);
                                };
                                that.showSaveConflictPrompt = true;
                            } else {
                                that.showError("Unexpected error: " + throwable.detailMessage);
                                console.log(throwable.getMessage());
                                that.buildResponse(header, null, that.ACTION_FAILED);
                                future.complete(false);
                            }
                        });
                    }
                    return future;
                });
            }
        },
        continueSaveConflictPrompt(data, refreshTargetFile, callback) {
            let that = this;
            that.showSaveConflictPrompt = false;
            Vue.nextTick(function() {
                let currentFilename = that.currentFile.getName();
                let extension = currentFilename.substring(currentFilename.lastIndexOf('.'));
                that.newFileExtension = extension.substring(1);
                let filenameWithoutExtension = currentFilename.substring(0, currentFilename.lastIndexOf('.'));
                that.initialNewFilename = filenameWithoutExtension + '(1)' + extension;
                that.file_picker_consumer_func = function (prompt_result, folder) {
                    if (prompt_result == null) {
                        callback(false);
                        return;
                    }
                    let filename = prompt_result.trim();
                    if (!filename.endsWith(extension)) {
                        that.showToastError("Incorrect file extension!");
                        callback(false);
                        return;
                    }
                    if (filename === '' || prompt_result == currentFilename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
                        callback(false);
                        that.showToastError("Invalid filename!");
                        return;
                    }
                    let folderPath = folder.endsWith("/") ? folder : folder + "/";
                    let fullPathToNewFile = folderPath + filename;
                    that.findFileByPath(fullPathToNewFile, false).thenApply(file => {
                        if (file != null) {
                            that.showToastError("File already exists. File not saved!");
                            callback(false);
                        } else {
                            let filePath = peergos.client.PathUtils.directoryToPath(fullPathToNewFile.split('/').filter(n => n.length > 0));
                            that.writeNewFileAfterSaveConflict(filePath, data, refreshTargetFile, callback);
                        }
                    });
                };
                that.showNewFilePicker = true;
            });
        },
        writeNewFileAfterSaveConflict: function(path, data, refreshTargetFile, callback) {
            let that = this;
            let pathNameCount = peergos.client.PathUtils.getNameCount(path);
            let pathWithoutFilename = peergos.client.PathUtils.subpath(path, 0, pathNameCount -1);
            this.context.getByPath(pathWithoutFilename.toString()).thenApply(dirOpt => {
                let dir = dirOpt.get();
                if(!dir.isWritable()) {
                    that.showError("You do not have write access to folder!");
                    callback(false);
                } else {
                    let filename = peergos.client.PathUtils.getFileName(path).toString();
                    dir.uploadOrReplaceFile(filename,
                            new peergos.shared.user.fs.AsyncReader.build(data),
                            0, data.length, that.context.network, that.context.crypto, x => {})
                                .thenApply(function(updatedFolder) {
                                    that.context.getByPath(path.toString()).thenApply(fileOpt => {
                                        callback(true, pathWithoutFilename, filename);
                                    });
                                }).exceptionally(function(throwable) {
                                    let msg = that.uriDecode(throwable.detailMessage);
                                    that.showError("Unexpected error", throwable.detailMessage);
                                    console.log(throwable.getMessage());
                                    callback(false);
                                })
                }
            });
        },
        findFileByPath: function(filePath) {
            var future = peergos.shared.util.Futures.incomplete();
            let that = this;
            this.context.getByPath(filePath).thenApply(function(fileOpt){
                if (fileOpt.ref == null) {
                    future.complete(null);
                } else {
                    let file = fileOpt.get();
                    future.complete(file);
                }
            }).exceptionally(function(throwable) {
                console.log(throwable.getMessage());
                future.complete(null);
            });
            return future;
        },
        reduceCommands: function(future) {
            let that = this;
            let command = this.commandQueue.shift();
            if (command == null) {
                future.complete(true);
            } else {
                command(true).thenApply(function(res){
                    if (res) {
                        that.reduceCommands(future);
                    } else {
                        future.complete(false);
                    }
                });
            }
            return future;
        },
        emptyCommandQueue: function() {
            let that = this;
            let command = this.commandQueue.shift();
            if (command != null) {
                command(false).thenApply(function(res){
                    that.emptyCommandQueue();
                });
            }
        },
        invokeOverwriteFile: function(overwriteCommand) {
            this.commandQueue.push(overwriteCommand);
            let that = this;
            if (!that.executingCommands) {
                that.executingCommands = true;
                let future = peergos.shared.util.Futures.incomplete();
                that.reduceCommands(future);
                future.thenApply(res => {
                    if (!res) {
                        that.emptyCommandQueue();
                    }
                    that.commandFileRefs.clear();
                    that.executingCommands = false;
                });
            }
        },
        putAction: function(header, filePath, bytes) {
            let that = this;
            this.existsInternal(filePath).thenApply(function(existsResult) {
                if (existsResult == -1) { // not found
                    that.updateAction(header, filePath, bytes, true);
                } else if(existsResult == 0) { //file
                    that.updateAction(header, filePath, bytes, false);
                } else if(existsResult == 1) { //directory
                    that.createAction(header, filePath, bytes, false);
                }
            }).exceptionally(function(throwable) {
                console.log(throwable.getMessage());
                that.buildResponse(header, null, that.ACTION_FAILED);
            });
        },
        exists: function(path) {
            let future = peergos.shared.util.Futures.incomplete();
            let expandedFilePath = this.expandFilePath(path);
            this.context.getByPath(expandedFilePath).thenApply(opt => {
                if(opt.ref == null) {
                    future.complete(-1);
                } else {
                    future.complete(opt.get().getFileProperties().isDirectory ? 1 : 0);
                }
            });
            return future;
        },
        existsInternal: function(filePath) {
            if (this.currentProps != null) {
                return this.exists('data/' + filePath);
            }else {
                let dataPath = peergos.client.PathUtils.directoryToPath(filePath.split('/'));
                return this.sandboxedApp.existsInternal(dataPath);
            }
        },
        updateAction: function(header, filePath, bytes, newFile) {
            let that = this;
            this.writeInternal(filePath, bytes).thenApply(function(res) {
                if (res) {
                    if (newFile) {
                        let encoder = new TextEncoder();
                        let relativePathBytes = encoder.encode(filePath);
                        that.buildResponse(header, relativePathBytes, that.CREATE_SUCCESS);
                    } else {
                        that.buildResponse(header, null, that.UPDATE_SUCCESS);
                    }
                } else {
                    console.log("unable to update file: " + filePath);
                    that.buildResponse(header, null, that.ACTION_FAILED);
                }
            }).exceptionally(function(throwable) {
                console.log(throwable.getMessage());
                that.buildResponse(header, null, that.ACTION_FAILED);
            });
        },
        createAction: function(header, filePath, bytes, hasFormData) {
            let that = this;
            let relativePath = hasFormData ? filePath : filePath + "/" + this.generateUUID();
            this.writeInternal(relativePath, bytes).thenApply(function(res) {
                if (res) {
                    let encoder = new TextEncoder();
                    let relativePathBytes = encoder.encode(relativePath);
                    that.buildResponse(header, relativePathBytes, hasFormData ? that.UPDATE_SUCCESS : that.CREATE_SUCCESS);
                } else {
                    console.log("unable to create file: " + relativePath);
                    that.buildResponse(header, null, that.ACTION_FAILED);
                }
            }).exceptionally(function(throwable) {
                console.log(throwable.getMessage());
                that.buildResponse(header, null, that.ACTION_FAILED);
            });
        },
        writeInternal: function(filePath, bytes) {
            if (this.currentProps != null) {
                let expandedFilePath = this.expandFilePath('data/' + filePath);
                let dirPath = peergos.client.PathUtils.directoryToPath(expandedFilePath.split('/').filter(n => n.length > 0));
                return this.writeFile(dirPath, bytes);
            }else {
                let dataPath = peergos.client.PathUtils.directoryToPath(filePath.split('/'));
                return this.sandboxedApp.writeInternal(dataPath, bytes);
            }
        },
        writeFile: function(path, data) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let pathNameCount = peergos.client.PathUtils.getNameCount(path);
            let pathWithoutUsername = peergos.client.PathUtils.subpath(path, 1, pathNameCount);
            this.context.getByPath(this.context.username).thenApply(userRoot =>
                userRoot.get().getOrMkdirs(peergos.client.PathUtils.getParent(pathWithoutUsername), that.context.network, false,
                    that.getMirrorBatId(userRoot.get()), that.context.crypto)
                    .thenApply(dir => dir.uploadOrReplaceFile(peergos.client.PathUtils.getFileName(path).toString(),
                        new peergos.shared.user.fs.AsyncReader.build(data),
                        0, data.length, that.context.network, that.context.crypto, x => {})
                            .thenApply(fw => future.complete(true))
                    ));
            return future;
        },
        writeNewFile: function(path, data) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let pathNameCount = peergos.client.PathUtils.getNameCount(path);
            let pathWithoutFilename = peergos.client.PathUtils.subpath(path, 0, pathNameCount -1);
            this.context.getByPath(pathWithoutFilename.toString()).thenApply(dirOpt =>
                dirOpt.get().uploadOrReplaceFile(peergos.client.PathUtils.getFileName(path).toString(),
                        new peergos.shared.user.fs.AsyncReader.build(data),
                        0, data.length, that.context.network, that.context.crypto, x => {})
                            .thenApply(fw => future.complete(true))
            );
            return future;
        },
        patchAction: function(header, filePath, bytes) {
            let that = this;
            this.appendInternal(filePath, bytes).thenApply(function(res) {
                if (res) {
                    let encoder = new TextEncoder();
                    let relativePathBytes = encoder.encode(filePath);
                    that.buildResponse(header, relativePathBytes, that.PATCH_SUCCESS);
                } else {
                    console.log("unable to append to file: " + filePath);
                    that.buildResponse(header, null, that.ACTION_FAILED);
                }
            }).exceptionally(function(throwable) {
                console.log(throwable.getMessage());
                that.buildResponse(header, null, that.ACTION_FAILED);
            });
        },
        appendInternal: function(filePath, bytes) {
            if (this.currentProps != null) {
                let expandedFilePath = this.expandFilePath('data/' + filePath);
                let fullPath = peergos.client.PathUtils.directoryToPath(expandedFilePath.split('/').filter(n => n.length > 0));
                return this.appendFile(fullPath, bytes);
            }else {
                let dataPath = peergos.client.PathUtils.directoryToPath(filePath.split('/'));
                return this.sandboxedApp.appendInternal(dataPath, bytes);
            }
        },
        appendFile: function(path, data) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let pathNameCount = peergos.client.PathUtils.getNameCount(path);
            let pathWithoutUsername = peergos.client.PathUtils.subpath(path, 1, pathNameCount);
            this.context.getByPath(this.context.username).thenApply(userRoot =>
                userRoot.get().getOrMkdirs(peergos.client.PathUtils.getParent(pathWithoutUsername), that.context.network, false,
                    that.getMirrorBatId(userRoot.get()), that.context.crypto)
                    .thenApply(dir => dir.appendFileJS(peergos.client.PathUtils.getFileName(path).toString(),
                        new peergos.shared.user.fs.AsyncReader.build(data), 0,
                        data.length, that.context.network, that.context.crypto, x => {})
                            .thenApply(fw => future.complete(true))
                    ));
            return future;
        },
        //https://stackoverflow.com/questions/105034/how-to-create-guid-uuid
        generateUUID: function() {
          return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
          );
        },
        deleteAction: function(header, filePath) {
            let that = this;
            this.deleteInternal(filePath).thenApply(function(res) {
                if (res) {
                    that.buildResponse(header, null, that.DELETE_SUCCESS);
                } else {
                    console.log("unable to delete: " + filePath);
                    that.buildResponse(header, null, that.ACTION_FAILED);
                }
            }).exceptionally(function(throwable) {
                console.log(throwable.getMessage());
                that.buildResponse(header, null, that.ACTION_FAILED);
            });
        },

        deleteInternal: function(filePath) {
            if (this.currentProps != null) {
                return this.deleteFile('data/' + filePath);
            }else {
                let dirPath = peergos.client.PathUtils.directoryToPath(filePath.split('/'));
                return this.sandboxedApp.deleteInternal(dirPath);
            }
        },
        deleteFile(path) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            let expandedFilePath = this.expandFilePath(path);
            let parentPath = expandedFilePath.substring(0, expandedFilePath.lastIndexOf('/'));
            this.context.getByPath(parentPath).thenApply(function(dirOpt){
                if(dirOpt.ref == null || path.endsWith('/')) {
                    future.complete(false);
                } else {
                    let dir = dirOpt.get();
                    let filename = expandedFilePath.substring(expandedFilePath.lastIndexOf('/') + 1);
                    let filePath = peergos.client.PathUtils.toPath(parentPath.split('/').filter(n => n.length > 0), filename);
                    dir.getChild(filename, that.context.crypto.hasher, that.context.network)
                        .thenApply(file => {
                            if(file.ref == null) {
                                future.complete(false);
                            }
                            file.get().remove(dir, filePath, that.context).thenApply(fw => future.complete(true))
                        });
                }
            });
            return future;
        },
        postData: function(bytes) {
            this.postMessage({type: 'respondToLoadedChunk', bytes: bytes});
        },
        stream: function(seekHi, seekLo, seekLength, file, filePath) {
            var props = file.getFileProperties();
            let that = this;
            function Context(file, filePath, mimeType, network, crypto, sizeHigh, sizeLow) {
                this.maxBlockSize = 1024 * 1024 * 5;
                this.writer = null;
                this.file = file;
                this.network = network;
                this.crypto = crypto;
                this.sizeHigh = sizeHigh,
                this.sizeLow = sizeLow;
                this.counter = 0;
                this.readerFuture = null;
                this.postData = function(data) {
                   that.postData(data);
                }
                this.stream = function(seekHi, seekLo, length) {
                    this.counter++;
                    var work = function(thatRef, currentCount) {
                        var currentSize = length;
                        var blockSize = currentSize > this.maxBlockSize ? this.maxBlockSize : currentSize;
                        var pump = function(reader, header) {
                            if(blockSize > 0 && thatRef.counter == currentCount) {
                                var bytes = new Uint8Array(blockSize + header.byteLength);
                                for(var i=0;i < header.byteLength;i++){
                                    bytes[i] = header[i];
                                }
                                var data = convertToByteArray(bytes);
                                return reader.readIntoArray(data, header.byteLength, blockSize).thenApply(function(read){
                                       currentSize = currentSize - read.value_0;
                                       blockSize = currentSize > thatRef.maxBlockSize ? thatRef.maxBlockSize : currentSize;
                                       thatRef.postData(data);
                                       return pump(reader, header);
                                });
                            } else {
                                var future = peergos.shared.util.Futures.incomplete();
                                future.complete(true);
                                return future;
                            }
                        }
                        var updated = thatRef.readerFuture != null && thatRef.counter == currentCount ?
                        thatRef.readerFuture :
                            file.getBufferedInputStream(network, crypto, sizeHigh, sizeLow, 10, function(read) {})
                            updated.thenCompose(function(reader) {
                                return reader.seekJS(seekHi, seekLo).thenApply(function(seekReader){
                                    var readerFuture = peergos.shared.util.Futures.incomplete();
                                    readerFuture.complete(seekReader);
                                    thatRef.readerFuture = readerFuture;

                                    let streamingInfo = {sizeHigh: sizeHigh, sizeLow: sizeLow, appFileStreaming: false};
                                    let header = that.buildHeader(filePath, mimeType, '', streamingInfo);
                                    return pump(seekReader, header);
                                })
                            });
                    }
                    return work(this, this.counter);
                }
            }

            const context = new Context(file, filePath, props.mimeType, this.context.network, this.context.crypto, props.sizeHigh(), props.sizeLow());
            if (seekLength < 0) { //first 1 Mib block of file
                var end = (1024 * 1024 * 1) - 1;
                if(end > props.sizeLow() - 1) {
                    end = props.sizeLow() - 1;
                }
                context.stream(0, 0, end + 1);
            } else {
                context.stream(seekHi, seekLo, seekLength);
            }
        },
        isSelectedFolder(folderPath) {
            if (this.permissionsMap.get(this.PERMISSION_READ_CHOSEN_FOLDER) != null) {
                if (this.selectedFolders.includes(folderPath)) {
                    return true;
                } else {
                    return this.selectedFolderStems.filter(e => folderPath.startsWith(e)).length > 0;
                }
            } else {
                return false;
            }
        },
        expandFilePath(filePath, isFromRedirect) {
             if (this.browserMode) {
                if (filePath.startsWith(this.currentPath) || isFromRedirect) {
                    return filePath;
                } else {
                    return this.currentPath.substring(0, this.currentPath.length -1) + filePath;
                }
            } else if (this.isFileViewerMode && filePath.startsWith("/assets/")) {
                return this.workspaceName + filePath;
            } else if ( (this.appPath.length > 0 && filePath.startsWith(this.getPath)) || this.isSelectedFolder(filePath)) {
                return filePath;
            } else if (this.appPath.length > 0 && filePath === this.pickerSelectedFile) {
                return filePath;
            } else if (this.currentProps != null) { //running in-place
                let filePathWithoutSlash = filePath.startsWith('/') ? filePath.substring(1) : filePath;
                return this.getPath + filePathWithoutSlash;
            } else {
                return this.context.username + "/.apps/" + this.currentAppName + filePath;
            }
        },
        findFile: function(filePath, isFromRedirect) {
            var future = peergos.shared.util.Futures.incomplete();
            let that = this;
            let expandedFilePath = this.expandFilePath(filePath, isFromRedirect);
            this.context.getByPath(expandedFilePath).thenApply(function(fileOpt){
                if (fileOpt.ref == null) {
                    console.log('file not found: ' + filePath);
                    future.complete(null);
                } else {
                    let file = fileOpt.get();
                    if (file.getFileProperties().isHidden) {
                        future.complete(null);
                    } else {
                        future.complete(file);
                    }
                }
            }).exceptionally(function(throwable) {
                console.log(throwable.getMessage());
                future.complete(null);
            });
            return future;
        },
        readInFile: function(headerFunc, file) {
            let that = this;
            let props = file.getFileProperties();
            let size = props.sizeLow();
            let maxChunkSize = 1024 * 1024 * 10;
            if (size < maxChunkSize) {
                let header = headerFunc(props.mimeType);
                file.getLatest(this.context.network).thenApply(updatedFile => {
                    updatedFile.getInputStream(that.context.network, that.context.crypto, props.sizeHigh(), props.sizeLow(), read => {}).thenApply(reader => {
                        var bytes = new Uint8Array(size + header.byteLength);
                        for(var i=0;i < header.byteLength;i++){
                            bytes[i] = header[i];
                        }
                        let data = convertToByteArray(bytes);
                        reader.readIntoArray(data, header.byteLength, size).thenApply(function(read){
                            that.postData(data);
                        });
                    });
                });
            } else if(props.sizeHigh() > 0) {
                let header = headerFunc(props.mimeType);
                that.buildResponse(header, null, that.ACTION_FAILED);
            } else {
                let streamingInfo = {sizeHigh: props.sizeHigh(), sizeLow: props.sizeLow(), appFileStreaming: true};
                let header = headerFunc(props.mimeType, streamingInfo);
                file.getLatest(this.context.network).thenApply(updatedFile => {
                    updatedFile.getBufferedInputStream(that.context.network, that.context.crypto, props.sizeHigh(), props.sizeLow(), 10, read => {}).thenApply(reader => {
                        var currentSize = props.sizeLow();
                        var blockSize = currentSize > maxChunkSize ? maxChunkSize : currentSize;
                        var pump = function() {
                            if(blockSize > 0) {
                                var bytes = new Uint8Array(blockSize + header.byteLength);
                                for(var i=0;i < header.byteLength;i++){
                                    bytes[i] = header[i];
                                }
                                var data = convertToByteArray(bytes);
                                reader.readIntoArray(data, header.byteLength, blockSize).thenApply(function(read){
                                    currentSize = currentSize - read.value_0;
                                    blockSize = currentSize > maxChunkSize ? maxChunkSize : currentSize;
                                    that.postData(data);
                                    Vue.nextTick(function() {
                                        pump();
                                    });
                                });
                            }
                        }
                        pump();
                    });
                });
            }
        },
        writeUnsignedLeb128: function(value) {
            let out = [];
            var remaining = value >>> 7;
            while (remaining != 0) {
                out.push((value & 0x7f) | 0x80);
                value = remaining;
                remaining >>>= 7;
            }
            out.push(value & 0x7f);
            let array = new Uint8Array(new ArrayBuffer(out.length));
            for(var i = 0; i < out.length; i++) {
                array[i] = out[i];
            }
            return array;
        },
        showError: function(msg) {
            console.log(msg);
            this.$toast.error(msg, {timeout:false});
        },
        closeAppFromToolbar: function () {
            let that = this;
            if (this.recreateFileThumbnailOnClose) {
                this.findFile(this.appPath, false).thenApply(file => {
                    if (file != null) {
                        file.calculateAndUpdateThumbnail(that.context.network, that.context.crypto).thenApply(res => {
                            that.closeSandbox();
                        }).exceptionally(err => {
                            that.showError("Unable to update file");
                            console.log(err);
                            that.closeSandbox();
                        });
                    }
                });
            } else {
                this.closeSandbox();
            }
        },
        requestFullscreenFromToolbar: function () {
            let that = this;
            let elem = document.documentElement;
            elem.requestFullscreen({ navigationUI: "auto" })
                .then(() => {
                    that.fullscreenMode = true;
                })
                .catch((err) => {
                    alert(
                        `An error occurred while trying to switch into fullscreen mode: ${err.message} (${err.name})`,
                    );
                });
        },
        closeSandbox: function () {
            let iframe = document.getElementById("sandboxId");
            if (iframe != null) {
                iframe.src="#";
                iframe.parentNode.removeChild(iframe);
            }
            window.removeEventListener('message', this.messageHandler);
            window.removeEventListener("resize", this.resizeHandler);
            this.running = false;

            if (!this.browserMode) {
                this.$emit("refresh");
            }
            if (this.navigateTo != null) {
                this.$emit("close-app-sandbox");
                this.openFileOrDir(this.navigateTo.app, this.navigateTo.navigationPath, {filename: this.navigateTo.navigationFilename});
            } else {
                this.$emit("hide-app-sandbox");
            }
        }
    }
}
</script>
<style>
</style>