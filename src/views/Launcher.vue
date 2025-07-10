<template>
<Article class="app-view launcher-view">
	<AppHeader>
	</AppHeader>
        <div class="modal-body">
            <Spinner v-if="showSpinner" :message="spinnerMessage"></Spinner>
            <Replace
                v-if="showReplace"
                v-on:hide-replace="showReplace = false"
                :replace_message='replace_message'
                :replace_body="replace_body"
                :consumer_cancel_func="replace_consumer_cancel_func"
                :consumer_func="replace_consumer_func"
                :showApplyAll=replace_showApplyAll>
            </Replace>
            <NewFilePicker
                v-if="showNewFilePicker"
                @hide-prompt="closeNewFilePicker()"
                :pickerFileExtension="pickerFileExtension"
                :pickerMultipleFileExtensions="pickerMultipleFileExtensions"
                :consumer_func="prompt_consumer_func"
            />
            <FilePicker
                v-if="showFilePicker"
                :baseFolder="filePickerBaseFolder"
                :pickerFileExtension="pickerFileExtension"
                :pickerFilterMedia="pickerFilterMedia"
                :pickerFilters="pickerFilters"
                :pickerShowThumbnail="pickerShowThumbnail"
                :selectedFile_func="selectedFileFromPicker"
            />
            <FolderPicker
                v-if="showFolderPicker"
                :baseFolder="folderPickerBaseFolder" :selectedFolder_func="selectedFoldersFromPicker"
                :multipleFolderSelection="multipleFolderSelection"
                :initiallySelectedPaths="initiallySelectedPaths">
            </FolderPicker>
            <AppInstall
                v-if="showAppInstallation"
                v-on:hide-app-installation="closeAppInstallation"
                :appInstallSuccessFunc="appInstallSuccess"
                :appPropsFile="appInstallPropsFile"
                :installFolder="appInstallFolder"
                :templateInstanceAppName="templateInstanceAppName">
            </AppInstall>
            <AppSandbox
                v-if="showAppSandbox"
                v-on:hide-app-sandbox="closeAppSandbox"
                :sandboxAppName="sandboxAppName"
                :currentFile="currentFile"
                :currentPath="currentPath"
                :htmlAnchor="htmlAnchor">
            </AppSandbox>
            <Confirm
                    v-if="showConfirm"
                    v-on:hide-confirm="showConfirm = false"
                    :confirm_message='confirm_message'
                    :confirm_body="confirm_body"
                    :consumer_cancel_func="confirm_consumer_cancel_func"
                    :consumer_func="confirm_consumer_func">
            </Confirm>
            <AppDetails
                v-if="showAppDetails"
                v-on:hide-app-details="closeAppDetails"
                :appPropsFile=currentAppPropertiesFile>
            </AppDetails>
            <Group
                    v-if="showGroupMembership"
                    v-on:hide-group="closeTemplateAppGroupMembership"
                    :groupId="groupId"
                    :groupTitle="groupTitle"
                    :existingGroupMembers="existingGroupMembers"
                    :existingAdmins="existingAdmins"
                    :friendNames="friendnames"
                    :updatedGroupMembership="updatedTemplateAppGroupMembership"
                    :existingGroups="existingGroups"
                    :isTemplateApp="isTemplateApp">
            </Group>
            <ul id="appMenu" v-if="showAppMenu" class="dropdown-menu" v-bind:style="{top:menutop, left:menuleft}" style="cursor:pointer;display:block;min-width:100px;padding: 10px;">
                <li id='open-in-app' style="padding-bottom: 5px;color: black;" v-for="app in availableApps" v-on:keyup.enter="appOpen($event, app.name, app.path, app.file)" v-on:click="appOpen($event, app.name, app.path, app.file)">{{app.contextMenuText}}</li>
            </ul>
            <div>
                <h3>
                    <button class="btn btn-success" @click="navigateToRecommendedApps()" style="margin-left: 10px;">
                        <svg class="white-svg" viewBox="0 0 1792 1792" xmlns="http://www.w3.org/2000/svg"><path d="M1728 1098q0 81-44.5 135t-123.5 54q-41 0-77.5-17.5t-59-38-56.5-38-71-17.5q-110 0-110 124 0 39 16 115t15 115v5q-22 0-33 1-34 3-97.5 11.5t-115.5 13.5-98 5q-61 0-103-26.5t-42-83.5q0-37 17.5-71t38-56.5 38-59 17.5-77.5q0-79-54-123.5t-135-44.5q-84 0-143 45.5t-59 127.5q0 43 15 83t33.5 64.5 33.5 53 15 50.5q0 45-46 89-37 35-117 35-95 0-245-24-9-2-27.5-4t-27.5-4l-13-2q-1 0-3-1-2 0-2-1v-1024q2 1 17.5 3.5t34 5 21.5 3.5q150 24 245 24 80 0 117-35 46-44 46-89 0-22-15-50.5t-33.5-53-33.5-64.5-15-83q0-82 59-127.5t144-45.5q80 0 134 44.5t54 123.5q0 41-17.5 77.5t-38 59-38 56.5-17.5 71q0 57 42 83.5t103 26.5q64 0 180-15t163-17v2q-1 2-3.5 17.5t-5 34-3.5 21.5q-24 150-24 245 0 80 35 117 44 46 89 46 22 0 50.5-15t53-33.5 64.5-33.5 83-15q82 0 127.5 59t45.5 143z"/></svg>
                        {{ translate("LAUNCHER.CUSTOM") }}
                        </button>
                    <button class="btn btn-info" @click="checkForAppUpdates()" style="margin-left: 10px;">{{ translate("LAUNCHER.UPDATE") }}</button>
                    <span style="margin-left: 40px;">{{updateMessage}}</span>
                </h3>
                <div v-if="appsList.length ==0" class="table-responsive">
                    {{ translate("LAUNCHER.NONE") }}
                </div>
                <div v-if="appsList!=0">
                    <AppGrid
                        v-if="showAppGrid"
                        :launchAppFunc="launchAppFromUI"
                        :appDetailsFunc="displayAppDetails"
                        :removeAppFunc="removeApp"
                        :updateAppFunc="updateApp"
                        :updateAccessToTemplateApp="updateAccessToTemplateApp"
                        :apps="appGridItems">
                    </AppGrid>
                </div>
            </div>
            <div>
                <h3>{{ translate("LAUNCHER.SHORTCUTS") }}</h3>
                <div v-if="shortcutList.length ==0" class="table-responsive">
                    {{ translate("LAUNCHER.ADD.SHORTCUT") }}
                </div>
                <div v-if="shortcutList!=0" class="table-responsive">
                    <table class="table">
                        <thead>
                        <tr  v-if="shortcutList.length!=0" style="cursor:pointer;">
                            <th @click="setShortcutsSortBy('added')">{{ translate("LAUNCHER.ADDED") }} <span v-if="shortcutsSortBy=='added'" v-bind:class="['fas', shortcutsNormalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setShortcutsSortBy('name')">{{ translate("LAUNCHER.NAME") }} <span v-if="shortcutsSortBy=='name'" v-bind:class="['fas', shortcutsNormalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setShortcutsSortBy('path')">{{ translate("LAUNCHER.FOLDER") }} <span v-if="shortcutsSortBy=='path'" v-bind:class="['fas', shortcutsNormalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setShortcutsSortBy('modified')">{{ translate("DRIVE.MODIFIED") }} <span v-if="shortcutsSortBy=='modified'" v-bind:class="['fas', shortcutsNormalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th @click="setShortcutsSortBy('created')">{{ translate("DRIVE.CREATED") }} <span v-if="shortcutsSortBy=='created'" v-bind:class="['fas', shortcutsNormalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
                            <th></th>
                        </tr>
                        </thead>
                        <tbody>
                        <tr v-for="shortcut in sortedShortcuts">
                            <td v-bind:class="[shortcut.missing ? 'deleted-entry' : '']">
                                {{ formatJSDate(shortcut.added) }}
                            </td>
                            <td v-bind:class="[shortcut.missing ? 'deleted-entry' : '']" v-on:click="view($event, shortcut)" style="cursor:pointer;">{{ shortcut.name }}</td>
                            <td v-bind:class="[shortcut.missing ? 'deleted-entry' : '']"  v-on:click="navigateTo(shortcut)" style="cursor:pointer;">
                                {{ shortcut.path }}
                            </td>
                            <td v-bind:class="[shortcut.missing ? 'deleted-entry' : '']">
                                {{ formatDateTime(shortcut.lastModified) }}
                            </td>
                            <td v-bind:class="[shortcut.missing ? 'deleted-entry' : '']">
                                {{ formatJSDate(shortcut.created) }}
                            </td>
                            <td> <button class="btn btn-danger" @click="removeShortcut(shortcut)">{{ translate("LAUNCHER.REMOVE") }}</button>
                            </td>
                        </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
</article>
</template>

<script>
const AppInstall = require("../components/sandbox/AppInstall.vue");
const AppHeader = require("../components/AppHeader.vue");
const AppDetails = require("../components/sandbox/AppDetails.vue");
const AppGrid = require("../components/app-grid/AppGrid.vue");
const AppSandbox = require("../components/sandbox/AppSandbox.vue");
const Confirm = require("../components/confirm/Confirm.vue");
const FilePicker = require('../components/picker/FilePicker.vue');
const FolderPicker = require('../components/picker/FolderPicker.vue');
const Group = require("../components/Group.vue");
const NewFilePicker = require("../components/picker/NewFilePicker.vue");
const Replace = require("../components/replace/Replace.vue");
const Spinner = require("../components/spinner/Spinner.vue");

const routerMixins = require("../mixins/router/index.js");
const mixins = require("../mixins/mixins.js");
const launcherMixin = require("../mixins/launcher/index.js");
const sandboxMixin = require("../mixins/sandbox/index.js");
const i18n = require("../i18n/index.js");
module.exports = {
    components: {
        AppInstall,
		AppHeader,
		AppDetails,
		AppGrid,
		AppSandbox,
		Confirm,
		FilePicker,
		FolderPicker,
		Group,
		NewFilePicker,
		Replace,
		Spinner,
    },
    data: function() {
        return {
            showSpinner: false,
            spinnerMessage: '',
            launcherApp: null,
            shortcutList: [],
            shortcutsSortBy: "added",
            shortcutsNormalSortOrder: false,
            appsList: [],
            appsSortBy: "name",
            appsNormalSortOrder: true,
            showConfirm: false,
            confirm_message: "",
            confirm_body: "",
            confirm_consumer_cancel_func: () => {},
            confirm_consumer_func: () => {},
            showAppDetails: false,
            currentAppPropertiesFile: null,
            showAppSandbox: false,
            sandboxAppName: '',
            showShare: false,
            currentFile: null,
            currentPath: null,
            updateMessage:'',
            showAppInstallation: false,
            appInstallPropsFile: null,
            appInstallFolder: '',
            availableApps: [],
            showAppMenu: false,
            menutop:"",
            menuleft:"",
            showNewFilePicker: false,
            prompt_consumer_func: () => { },
            pickerFileExtension: '',
            pickerMultipleFileExtensions: [],
            showReplace: false,
            replace_message: "",
            replace_body: "",
            replace_consumer_cancel_func: (applyToAll) => { },
            replace_consumer_func: (applyToAll) => { },
            showAppGrid: false,
            forceAppDisplayUpdate: 0,
            appGridItems: [],
            showFolderPicker: false,
            folderPickerBaseFolder: "",
            multipleFolderSelection: false,
            initiallySelectedPaths: [],
            showFilePicker: false,
            selectedFileFromPicker: null,
            pickerFilterMedia: false,
            pickerFilters: null,
            pickerShowThumbnail: false,
            filePickerBaseFolder: "",
            htmlAnchor: "",
            templateInstanceAppName: "",
            groupId: "",
            groupTitle: "",
            showGroupMembership: false,
            existingGroupMembers: [],
            existingGroups: [],
            existingAdmins: [],
            isTemplateApp: false,
            currentApp: null,
            replace_showApplyAll: false,
        }
    },
    props: [],
    mixins:[routerMixins, mixins, launcherMixin, sandboxMixin, i18n],
	watch: {
		forceAppDisplayUpdate(newUpdateCounter, oldUpdateCounter) {
		    let that = this;
            this.showAppGrid = false;
			this.appGridItems = this.appsList.slice().sort(function (a, b) {
                 return ('' + a.name).localeCompare(b.name);
             });
            for(var i=0; i < this.appGridItems.length; i++) {
                let appRow = this.appGridItems[i];
                if (appRow.template.length > 0) {
                    let appOwner = that.extractChatOwner(appRow.chatId);
                    appRow.gridDisplayName = that.context.username != appOwner ? "[" + appOwner + "] " + appRow.displayName : appRow.displayName;
                } else {
                    appRow.gridDisplayName = appRow.displayName;
                }
            }
            Vue.nextTick(function() {
                that.showAppGrid = true;
            });
		},
    },
    computed: {
        ...Vuex.mapState([
            'context',
            "shortcuts",
            "sandboxedApps",
            'mirrorBatId',
            "socialData",
        ]),
        friendnames: function() {
            return this.socialData.friends;
        },
        sortedShortcuts(){
            var sortBy = this.shortcutsSortBy;
            var reverseOrder = ! this.shortcutsNormalSortOrder;
            if(sortBy == "name") {
                return this.shortcutList.sort(function (a, b) {
                    if (reverseOrder) {
                        return ('' + b.name).localeCompare(a.name);
                    } else {
                        return ('' + a.name).localeCompare(b.name);
                    }
                });
            } else if(sortBy == "path") {
                return this.shortcutList.sort(function (a, b) {
                    if (reverseOrder) {
                        return ('' + b.path).localeCompare(a.path);
                    } else {
                        return ('' + a.path).localeCompare(b.path);
                    }
                });
            } else if(sortBy == "modified") {
                return this.shortcutList.sort(function (a, b) {
                    let aVal = a.lastModified;
                    let bVal = b.lastModified;
                    if (reverseOrder) {
                        return bVal.compareTo(aVal);
                    } else {
                        return aVal.compareTo(bVal);
                    }
                });
            } else if(sortBy == "created") {
                return this.shortcutList.sort(function (a, b) {
                    let aVal = a.created;
                    let bVal = b.created;
                    if (reverseOrder) {
                        return bVal - aVal;
                    } else {
                        return aVal - bVal;
                    }
                });
            } else if(sortBy == "added") {
                return this.shortcutList.sort(function (a, b) {
                    let aVal = a.added;
                    let bVal = b.added;
                    if (reverseOrder) {
                        return bVal - aVal;
                    } else {
                        return aVal - bVal;
                    }
                });
            }
        },
    },
    created: function() {
        let that = this;
        this.showSpinner = true;
        this.messenger = new peergos.shared.messaging.Messenger(this.context);
        peergos.shared.user.App.init(that.context, "launcher").thenApply(launcher => {
            that.launcherApp = launcher;
            that.setShortcutList(new Map(that.shortcuts.shortcutsMap));
            that.loadInstalledApps();
        });
    },
    methods: {
        extractChatOwner: function(chatUuid) {
            let withoutPrefix = chatUuid.substring(chatUuid.indexOf("$") +1);
            return withoutPrefix.substring(0,withoutPrefix.indexOf("$"));
        },
        confirmReplaceFile(filename, cancelFn, replaceFn) {
            this.showSpinner = false;
            this.replace_message = this.translate("LAUNCHER.FILE.EXISTS").replace("$NAME", filename);
            this.replace_body = this.translate("LAUNCHER.FILE.REPLACE");
            this.replace_consumer_cancel_func = cancelFn;
            this.replace_consumer_func = replaceFn;
            this.showReplace = true;
        },
        launchAppFromUI: function(app) {
            let that = this;
            if (app.createFile) {
                this.prompt_consumer_func = function (prompt_result, folder) {
                    if (prompt_result === null)
                        return;
                    let fileName = prompt_result.trim();
                    if (fileName === '')
                        return;
                    that.uploadEmptyFileToFolder(app.name, folder, fileName).thenApply(fileCreated => {
                        if (fileCreated != null && fileCreated === true) {
                            let pathString = '/' + folder;
                            that.findFile(pathString + "/" + fileName).thenApply(file => {
                                that.openFileOrDir(app.name, pathString, {filename: fileName})
                            });
                        }
                    });
                };
                this.pickerFileExtension = app.primaryFileExtension;
                this.pickerMultipleFileExtensions = app.newFileExtensions;
                this.showNewFilePicker = true;
            } else if (app.openFile) {
                this.filePickerBaseFolder = "/" + this.context.username;
                this.pickerFilters = app.openFileFilters;
                this.selectedFileFromPicker = function (pathString) {
                    if(pathString != null) {
                        let folder = pathString.substring(0, pathString.lastIndexOf('/'));
                        let filename = pathString.substring(pathString.lastIndexOf('/') + 1);
                        that.openFileOrDir(app.name, folder, {filename: filename})
                    }
                    that.showFilePicker = false;
                }.bind(this);
                this.showFilePicker = true;
            } else if (app.folderAction) {
                this.folderPickerBaseFolder = "/" + this.context.username;
                this.selectedFoldersFromPicker = function (chosenFolders) {
                    if (chosenFolders.length == 1) {
                        let pathString = chosenFolders[0];
                        let folder = pathString.substring(0, pathString.lastIndexOf('/'));
                        let filename = pathString.substring(pathString.lastIndexOf('/') + 1);
                        that.openFileOrDir(app.name, folder, {filename: filename})
                    }
                    that.showFolderPicker = false;
                };
                this.initiallySelectedPaths = [];
                that.showFolderPicker = true;
            } else {
                this.launchApp(app.name);
            }
        },
        getMirrorBatId(file) {
            return file.getOwnerName() == this.context.username ? this.mirrorBatId : java.util.Optional.empty()
        },
        uploadEmptyFileToFolder(appName, folder, filename) {
            this.showSpinner = true;
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            this.context.getByPath(folder).thenApply(function (optDir) {
                let dir = optDir.get();
                dir.hasChild(filename, that.context.crypto.hasher, that.context.network).thenApply(function (alreadyExists) {
                    if (alreadyExists) {
                        that.confirmReplaceFile(filename,
                            () => {
                                future.complete(null);
                            },
                            () => {
                                that.uploadEmptyFile(appName, dir, filename, future);
                            }
                        );
                    } else {
                        that.uploadEmptyFile(appName, dir, filename, future);
                    }
                });
            });
            return future;
        },
        readInEmptyFile: function(fullPathToFile) {
            let that = this;
            var future = peergos.shared.util.Futures.incomplete();
            this.findFile(fullPathToFile).thenApply(file => {
                if (file == null) {
                    future.complete(peergos.shared.user.JavaScriptPoster.emptyArray());
                } else {
                    const props = file.getFileProperties();
                    file.getInputStream(that.context.network, that.context.crypto, props.sizeHigh(), props.sizeLow(), function(read){})
                        .thenCompose(function(reader) {
                            var size = that.getFileSize(props);
                            var data = convertToByteArray(new Int8Array(size));
                            return reader.readIntoArray(data, 0, data.length).thenApply(function(read){
                                future.complete(data);
                            });
                    });
                }
            });
            return future;
        },

        uploadEmptyFile(appName, dir, filename, future) {
            let that = this;
            let extension = filename.substring(filename.lastIndexOf('.') + 1);
            let fullPathToAppEmptyFile = "/" + this.context.username + "/.apps/" + appName + '/assets/empty.' + extension;
            this.readInEmptyFile(fullPathToAppEmptyFile).thenApply(fileData => {
                let reader = new peergos.shared.user.fs.AsyncReader.ArrayBacked(fileData);
                dir.uploadFileJS(filename, reader, 0, fileData.length,
                    true, that.getMirrorBatId(dir), that.context.network, that.context.crypto, function (len) { },
                    that.context.getTransactionService(),
                    f => peergos.shared.util.Futures.of(false)
                ).thenApply(function (res) {
                    that.showMessage(false, that.translate("LAUNCHER.CREATED.SUCCESS"));
                    that.showSpinner = false;
                    future.complete(true);
                }).exceptionally(function (throwable) {
                    that.showSpinner = false;
                    that.showMessage(true, that.translate("LAUNCHER.CREATED.ERROR"));
                    future.complete(false);
                });
            });
            return future;
        },
        closeNewFilePicker() {
            this.showNewFilePicker = false;
        },
        appOpen(event, appName, path, file) {
            this.showAppMenu = false;
            event.stopPropagation();
            this.availableApps = [];
            this.openFileOrDir(appName, path, {filename:file.isDirectory() ? "" : file.getName()})
        },
        loadInstalledApps() {
            let that = this;
            if(!this.sandboxedApps.appsLoaded) {
                setTimeout( () => { that.loadInstalledApps();}, 1000);
            } else {
                let installedApps = that.sandboxedApps.appsInstalled.slice().filter(a => a.name != "htmlviewer");
                for(var i=0; i < installedApps.length; i++) {
                    let appRow = installedApps[i];
                    appRow.updateAvailable = false;
                }
                that.appsList = installedApps;
                that.loadAppIcons();
                that.showSpinner = false;
            }
        },
        appInstallSuccess(appName) {
            let appIndex = this.appsList.findIndex(v => v.name === appName);
            let appRow = this.appsList[appIndex];
            this.appsList.splice(appIndex, 1);
            appRow.updateAvailable = false;
            appRow.thumbnail = null;
            this.appsList.push(appRow);
            this.updateMessage = '';
            this.loadAppIcons();
        },
        closeAppInstallation() {
            this.showAppInstallation = false;
        },
        reduceRemovingTemplateAppInvitations: function(chatId, membersToRemove, index, future) {
            let that = this;
            if (index == membersToRemove.length) {
                future.complete(true);
            } else {
                let username = membersToRemove[index];
                this.spinnerMessage = "removing " + username;
                this.messenger.getChat(chatId).thenApply(function(controller) {
                    that.messenger.removeMember(controller, username).thenApply(updatedController => {
                        that.spinnerMessage = "";
                        that.reduceRemovingTemplateAppInvitations(chatId, membersToRemove, ++index, future);
                    }).exceptionally(function(throwable) {
                        that.spinnerMessage = "";
                        console.log(throwable);
                        that.showErrorMessage("Unable to remove " + username + " from chat");
                        that.reduceRemovingTemplateAppInvitations(chatId, membersToRemove, ++index, future);
                    });
                });
            }
            return future;
        },
        removeMembersFromTemplateApp: function(chatId, membersToRemove) {
            let future = peergos.shared.util.Futures.incomplete();
            this.reduceRemovingTemplateAppInvitations(chatId, membersToRemove, 0, future);
            return future;
        },
        inviteNewMembersToTemplateApp: function(chatId, updatedMembers) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            if (updatedMembers.length == 0) {
                future.complete(true);
            } else {
                let usernames = peergos.client.JsUtil.asList(updatedMembers);
                this.spinnerMessage = "adding participant(s) to App";
                this.messenger.getChat(chatId).thenApply(function(controller) {
                    that.getPublicKeyHashes(updatedMembers).thenApply(pkhList => {
                        that.messenger.invite(controller, usernames, pkhList).thenApply(updatedController => {
                            that.spinnerMessage = "";
                            future.complete(true);
                        }).exceptionally(err => {
                            that.spinnerMessage = "";
                            that.showErrorMessage("Unable to add members to chat");
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
        updatedTemplateAppGroupMembership: function(chatId, updatedGroupTitle, updatedMembers, updatedAdmins) {
            this.showGroupMembership = false;
            let that = this;
            Vue.nextTick(function() {
                that.updateExistingTemplateAppGroupMembership(chatId, updatedGroupTitle, updatedMembers, updatedAdmins);
            });
        },
        updateExistingTemplateAppGroupMembership: function(chatId, updatedGroupTitle, updatedMembers, updatedAdmins) {
            let that = this;
            this.showSpinner = true;
            let existingChatItem = {chatId: chatId};
            that.messenger.getChat(chatId).thenApply(function(controller) {
                let existingMembers = controller.getMemberNames().toArray();
                let added = that.extractAddedParticipants(existingMembers, updatedMembers);
                let removed = that.extractRemovedParticipants(existingMembers, updatedMembers);
                let existingAdmins = controller.getAdmins().toArray();
                let addedAdmins = that.extractAddedParticipants(existingAdmins, updatedAdmins);
                let removedAdmins = that.extractRemovedParticipants(existingAdmins, updatedAdmins);
                var proposedAdminsLength = existingAdmins.length - removedAdmins.length + addedAdmins.length;
                let inError = false;
                if (proposedAdminsLength < 1) {
                    that.showErrorMessage('App must have an admin!');
                    inError = true;
                }
                if (existingAdmins.filter(v => v == that.context.username).length == -1) {
                    if (removedAdmins.length > 0 || addedAdmins.length > 0) {
                        that.showErrorMessage('Invalid attempt to change App access control');
                    }
                    inError = true;
                }
                if (inError) {
                    Vue.nextTick(function() {
                        that.showSpinner = false;
                    });
                } else {
                    that.inviteNewMembersToTemplateApp(chatId, added).thenApply(function(res1) {
                        that.removeMembersFromTemplateApp(chatId, removed).thenApply(function(res2) {
                            Vue.nextTick(function() {
                                that.showSpinner = false;
                            });
                       });
                    });
                }
            });
        },
        closeTemplateAppGroupMembership() {
            let that = this;
            Vue.nextTick(function() {
                that.showGroupMembership = false;
            });
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
                filteredChats.push({chatId: chat.chatUuid, title: chat.getTitle()
                , members: that.copyArray(chat.getMemberNames().toArray())
                , admins: that.copyArray(chat.getAdmins().toArray()) });
                recentMessages.push(chat.getRecent().toArray());
            }
            return {chats: filteredChats, recentMessages: recentMessages};
        },
        updateAccessToTemplateApp: function(app) {
            let that = this;
            let chatId = app.chatId;
            this.messenger.listChats().thenApply(function(chats) {
                let allChats = chats.toArray();
                let filteredChats = that.filterChats(allChats).chats;
                let existingChat = null;
                filteredChats.forEach(chat => {
                    if (chat.chatId == chatId) {
                        that.groupTitle = chat.title;
                        existingChat = chat;
                    }
                });
                that.groupId = chatId;
                that.existingGroupMembers = existingChat.members.slice();
                that.existingAdmins = existingChat.admins.slice();
                let isAdmin = that.existingAdmins.filter(n => n === that.context.username).length == 1;
                that.isTemplateApp = true;
                if (isAdmin) {
                    that.currentApp = app;
                    that.showGroupMembership = true;
                } else {
                    that.showMessage(false, "You are not the App admin!");
                }
            });
        },
        updateApp: function(app) {
            let that = this;
            let pathStr = app.source.endsWith('/') ? app.source  : app.source + '/';
            this.context.getByPath(pathStr + 'peergos-app.json').thenApply(propsFileOpt => {
                if (propsFileOpt.ref != null) {
                    that.appInstallPropsFile = propsFileOpt.ref;
                    that.appInstallFolder = pathStr;
                    that.templateInstanceAppName = app.name;
                    that.showAppInstallation = true;
                }
            });
        },
        checkForAppUpdates: function() {
            let that = this;
            this.showSpinner = true;
            let appsInstalledWithSource = this.sandboxedApps.appsInstalled.slice().filter(a => a.source.length > 0);
            let future = peergos.shared.util.Futures.incomplete();
            this.gatherAppsWithUpdates(appsInstalledWithSource, 0, [], future);
            future.thenApply(appsWithUpdates => {
                if (appsWithUpdates.length == 0) {
                    that.updateMessage = that.translate("LAUNCHER.UPDATES.NONE");
                } else if (appsWithUpdates.length == 1) {
                    that.updateMessage = that.translate("LAUNCHER.UPDATES.ONE");
                } else {
                    that.updateMessage = that.translate("LAUNCHER.UPDATES.MANY").replace("$COUNT", appsWithUpdates.length);
                }
                for(var i=0; i < appsWithUpdates.length; i++) {
                    let appName = appsWithUpdates[i].name;
                    let appIndex = that.appsList.findIndex(v => v.name === appName);
                    let appRow = that.appsList[appIndex];
                    appRow.updateAvailable = true;
                    that.forceAppDisplayUpdate++;
                }
                that.showSpinner = false;
            });
        },
        gatherAppsWithUpdates: function(appsInstalledWithSource, index, accumulator, future) {
            if (index == appsInstalledWithSource.length) {
                future.complete(accumulator);
            } else {
                let that = this;
                let app = appsInstalledWithSource[index];
                let pathStr = app.source.endsWith('/') ? app.source + 'peergos-app.json' : app.source + '/peergos-app.json';
                this.context.getByPath(pathStr).thenApply(propsFileOpt => {
                    if (propsFileOpt.ref != null) {
                        that.readJSONFile(propsFileOpt.ref).thenApply(props => {
                            if (that.isAppVersionNewer(app.version, props.version)) {
                                accumulator.push(app);
                            }
                            that.gatherAppsWithUpdates(appsInstalledWithSource, index + 1, accumulator, future);
                        });
                    } else {
                        that.gatherAppsWithUpdates(appsInstalledWithSource, index + 1, accumulator, future);
                    }
                });
            }
        },
        isAppVersionNewer: function(existingVersionStr, sourceVersionStr) {
            try {
                let existingVersion = peergos.shared.util.Version.parse(existingVersionStr);
                let sourceVersion = peergos.shared.util.Version.parse(sourceVersionStr);
                return existingVersion.isBefore(sourceVersion);
            } catch {
                return false;
            }
        },
        navigateToRecommendedApps: function() {
            let that = this;
            let path = "/peergos/recommended-apps/";
            that.findFile(path + "index.html").thenApply(file => {
                if (file != null) {
                    that.launchApp('$$app-gallery$$', file, path);
                }
            });

        },
        loadAppIcons: function() {
            let that = this;
            this.loadAppIconsRecursively(this.appsList, 0, () => {
                    that.forceAppDisplayUpdate++;
                });
        },
        loadAppIconsRecursively: function(apps, index, cb) {
            if (index == apps.length) {
                cb();
            } else {
                let that = this;
                let app = apps[index];
                let appIndex = this.appsList.findIndex(v => v.name === app.name);
                if (app.appIcon.length == 0 ||  (appIndex > -1 && this.appsList[appIndex].thumbnail != null)) {
                    this.loadAppIconsRecursively(apps, index + 1, cb);
                } else {
                    if (app.templateIconBase64 != null && app.templateIconBase64.length > 0) {
                        let appRow = that.appsList[appIndex];
                        appRow.thumbnail = app.templateIconBase64;
                        that.loadAppIconsRecursively(apps, index + 1, cb);
                    } else {
                        let fullPathToAppIcon = "/" + this.context.username + "/.apps/" + app.name + '/assets/' + app.appIcon;
                        that.findFile(fullPathToAppIcon).thenApply(file => {
                            if (file != null) {
                               if (appIndex > -1) {
                                   let appRow = that.appsList[appIndex];
                                   appRow.thumbnail = file.getBase64Thumbnail();
                               }
                            }
                            that.loadAppIconsRecursively(apps, index + 1, cb);
                        });
                    }
                }
            }
        },
        setShortcutList: function(shortcutsMap) {
            let that = this;
            let allShortcuts = [];
            shortcutsMap.forEach(function(value, key) {
                var isDirectory = false;
                var name = '';
                if (key.endsWith('/')) {
                    isDirectory = true;
                } else {
                    name = key.substring(key.lastIndexOf('/') + 1);
                }
                let path = key.substring(0, key.lastIndexOf('/'));
                let shortcut = {missing: false, name: name, path: path, isDirectory : isDirectory, lastModified: '',
                    created: new Date(value.created), added: new Date(value.added)};
                that.populateShortcut(shortcut);
                allShortcuts.push(shortcut);
            });
            that.shortcutList = allShortcuts;
        },
        launchApp: function(appName, currentFile, currentPath) {
            this.showAppSandbox = true;
            this.sandboxAppName = appName;
            this.currentFile = currentFile;
            this.currentPath = currentPath;
        },
        closeAppSandbox() {
            this.showAppSandbox = false;
            this.setShortcutList(new Map(this.shortcuts.shortcutsMap));
            this.loadInstalledApps();
        },
        displayAppDetails: function(app) {
            let that = this;
            let fullPath = "/" + this.context.username + "/.apps/" + app.name + '/peergos-app.json';
            this.findFile(fullPath).thenApply(file => {
                if (file != null) {
                    that.currentAppPropertiesFile = file;
                    that.showAppDetails = true;
                }
            });
        },
        closeAppDetails() {
            this.currentAppPropertiesFile = null;
            this.showAppDetails = false;
        },
        confirmRemoveApp(appName, replaceFunction, cancelFunction) {
            this.confirm_message = this.translate("LAUNCHER.APP.REMOVE") + ': ' + appName;
            this.confirm_body = this.translate("LAUNCHER.APP.REMOVE.CONFIRM");
            this.confirm_consumer_cancel_func = cancelFunction;
            this.confirm_consumer_func = replaceFunction;
            this.showConfirm = true;
        },
        removeApp: function(app) {
            let that = this;
            if (app.name == 'htmlviewer') {
                this.showErrorMessage('Unable to remove HTML Viewer');
            } else {
                this.confirmRemoveApp(app.displayName,
                    () => {
                        that.showConfirm = false;
                        that.deleteApp(app);
                    },
                    () => {
                        that.showConfirm = false;
                        that.showSpinner = false;
                    }
                );
            }
        },
        deleteApp(app) {
            let that = this;
            this.showSpinner = true;
            if (app.template.length > 0) {
                let that = this;
                let messenger = new peergos.shared.messaging.Messenger(this.context);
                messenger.getChat(app.chatId).thenApply(function(controller) {
                    messenger.deleteChat(controller).thenApply(res => {
                        that.processAppDelete(app);
                    }).exceptionally(function(throwable) {
                        console.log(throwable);
                        that.showErrorMessage('Error deleting template App: ' + app.name);
                        that.showSpinner = false;
                    });
                });
            } else {
                this.processAppDelete(app);
            }
        },
        processAppDelete(app) {
            let that = this;
            let appDirName = app.name;
            this.context.getByPath("/" + this.context.username + "/.apps").thenApply(appDirOpt => {
                if (appDirOpt.ref != null) {
                    appDirOpt.ref.getChild(appDirName, that.context.crypto.hasher, that.context.network).thenApply(appToDeleteOpt => {
                        if (appToDeleteOpt.ref != null) {
                            that.deleteAppFolder(app, appToDeleteOpt.ref, appDirOpt.ref);
                        }
                    });
                }
            });
        },
        deleteAppFolder: function(app, file, parent) {
            let name = file.getFileProperties().name;
            let that = this;
            let filePath = peergos.client.PathUtils.directoryToPath([this.context.username, ".apps", name]);
            file.remove(parent, filePath, this.context).thenApply(function(b){
                that.deRegisterApp(app);
                let appIndex = that.appsList.findIndex(v => v.name === app.name);
                if (appIndex > -1) {
                    that.appsList.splice(appIndex, 1);
                    that.forceAppDisplayUpdate++;
                }
                that.showSpinner = false;
            }).exceptionally(function(throwable) {
                console.log('Unexpected error: ' + throwable);
                that.showErrorMessage('Error deleting App: ' + app.name);
                that.showSpinner = false;
            });
        },
        confirmRemoveShortcut(replaceFunction, cancelFunction) {
            this.confirm_message = this.translate("LAUNCHER.SHORTCUT.REMOVE");
            this.confirm_body = this.translate("LAUNCHER.SHORTCUT.REMOVE.CONFIRM");
            this.confirm_consumer_cancel_func = cancelFunction;
            this.confirm_consumer_func = replaceFunction;
            this.showConfirm = true;
        },
        removeShortcut: function(shortcut) {
            let that = this;
            this.confirmRemoveShortcut(
                () => {
                    that.showConfirm = false;
                    that.deleteShortcut(shortcut);
                },
                () => {
                    that.showConfirm = false;
                    that.showSpinner = false;
                }
            );
        },
        deleteShortcut: function(entry) {
            let link = entry.path + '/' + (entry.isDirectory ? "" : entry.name);
            this.refreshAndDeleteShortcutLink(link);
        },
        refreshAndDeleteShortcutLink(link) {
            let that = this;
            this.showSpinner = true;
            this.loadShortcutsFile(this.launcherApp).thenApply(shortcutsMap => {
                if (shortcutsMap.get(link) != null) {
                    shortcutsMap.delete(link)
                    that.updateShortcutsFile(that.launcherApp, shortcutsMap).thenApply(res => {
                        that.showSpinner = false;
                        that.$store.commit("SET_SHORTCUTS", shortcutsMap);
                        that.setShortcutList(new Map(shortcutsMap));
                    });
                } else {
                    that.showSpinner = false;
                }
            })
        },
        populateShortcut(entry) {
            let fullPath = entry.path + (entry.isDirectory ? "" : '/' + entry.name);
            this.findFile(fullPath).thenApply(file => {
                if (file != null) {
                    let props = file.getFileProperties();
                    entry.lastModified = props.modified;
                } else {
                    entry.missing = true;
                }
            });
        },
        getFileSize: function(props) {
                var low = props.sizeLow();
                if (low < 0) low = low + Math.pow(2, 32);
                return low + (props.sizeHigh() * Math.pow(2, 32));
        },
        uuid: function() {
          return '-' + ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
          );
        },
        showMessage: function(isError, title, body) {
            let bodyContents = body == null ? '' : ' ' + body;
            if (isError) {
                this.$toast.error(title + bodyContents, {timeout:false});
            } else {
                let id = this.uuid();
                this.$toast(title + bodyContents, {id: id});
                let that = this;
                setTimeout(() => that.$toast.dismiss(id), 3000);
            }
        },
        showErrorMessage(errMsg) {
            console.log(errMsg);
            this.showMessage(true, "", errMsg);
            this.showSpinner = false;
        },
        findFile: function(filePath) {
            let that = this;
            var future = peergos.shared.util.Futures.incomplete();
            this.context.getByPath(filePath).thenApply(function(fileOpt){
                if (fileOpt.ref == null) {
                    future.complete(null);
                } else {
                    let file = fileOpt.get();
                    const props = file.getFileProperties();
                    if (props.isHidden) {
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
        view: function (event, entry) {
            if (entry.name.length == 0 || entry.missing) {
                return;
            }
            let that = this;
            let fullPath = entry.path + (entry.isDirectory ? "" : '/' + entry.name);
            this.findFile(fullPath).thenApply(file => {
                if (file != null) {
                    let userApps = this.availableAppsForFile(file);
                    let inbuiltApps = this.getInbuiltApps(file);
                    if (userApps.length == 0) {
                        if (inbuiltApps.length == 1) {
                            if (inbuiltApps[0].name == 'hex') {
                                that.openFileOrDir("Drive", entry.path, {filename:""});
                            } else {
                                this.openFileOrDir(inbuiltApps[0].name, entry.path, {filename:file.isDirectory() ? "" : file.getName()})
                            }
                        } else {
                            this.showAppContextMenu(event, inbuiltApps, userApps, entry.path, file);
                        }
                    } else {
                        this.showAppContextMenu(event, inbuiltApps, userApps, entry.path, file);
                    }
                }
            });
        },
        showAppContextMenu(event, inbuiltApps, userApps, path, file) {
            let appOptions = [];
            for(var i = 0; i < userApps.length; i++) {
                let app = userApps[i];
                let option = {'name': app.name, 'path': path, 'file': file, 'contextMenuText': app.contextMenuText};
                appOptions.push(option);
            }
            for(var i = 0; i < inbuiltApps.length; i++) {
                let app = inbuiltApps[i];
                let option = {'name': app.name, 'path': path, 'file': file, 'contextMenuText': app.contextMenuText};
                appOptions.push(option);
            }
            this.availableApps = appOptions;
            var pos = this.getPosition(event);
            Vue.nextTick(function() {
                var top = pos.y;
                var left = pos.x;
                this.menutop = top + 'px';
                this.menuleft = left + 'px';
            }.bind(this));
            this.showAppMenu = true;
            event.stopPropagation();
        },
        getPosition: function(e) {
            var posx = 0;
            var posy = 0;

            if (!e) var e = window.event;
            if (e.clientX || e.clientY) {
                posx = Math.max(0, e.clientX - 100); //todo remove arbitrary offset
                posy = Math.max(0, e.clientY - 100);
            }
            return {
                x: posx,
                y: posy
            }
        },
        navigateTo: function (entry) {
            if (entry.missing) {
                return;
            }
            this.openFileOrDir("Drive", entry.path, {filename:""});
        },
        setShortcutsSortBy: function(prop) {
            if (this.shortcutsSortBy == prop)
                this.shortcutsNormalSortOrder = !this.shortcutsNormalSortOrder;
            this.shortcutsSortBy = prop;
        },
        setAppsSortBy: function(prop) {
            if (this.appsSortBy == prop)
                this.appsNormalSortOrder = !this.appsNormalSortOrder;
            this.appsSortBy = prop;
        },
        formatDateTime: function(dateTime) {
            if (dateTime.length == 0) {
                return dateTime;
            }
            let date = new Date(dateTime.toString() + "+00:00");//adding UTC TZ in ISO_OFFSET_DATE_TIME ie 2021-12-03T10:25:30+00:00
            return this.formatJSDate(date);
        },
        formatJSDate: function(date) {
            let formatted = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate()
                + ' ' + (date.getHours() < 10 ? '0' : '') + date.getHours()
                + ':' + (date.getMinutes() < 10 ? '0' : '') + date.getMinutes()
                + ':' + (date.getSeconds() < 10 ? '0' : '') + date.getSeconds();
            return formatted;
        },
    }
}
</script>

<style>
.deleted-entry {
    text-decoration: line-through;
}
.white-svg {
    margin-bottom: -6px;
    height: 24px;
    width: 24px;
    filter: invert(100%) sepia(100%) saturate(0%) hue-rotate(347deg) brightness(109%) contrast(101%);
}
</style>
