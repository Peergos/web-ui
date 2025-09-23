<template>
  <article class="drive-view">
    <input
      type="file"
      id="uploadFileInput"
      @change="uploadFiles"
      style="display: none"
      multiple
    />
    <input
      type="file"
      id="uploadDirectoriesInput"
      @change="uploadFiles"
      style="display: none"
      multiple
      directory
      mozDirectory
      webkitDirectory
    />

    <Spinner v-if="showSpinner" :message="spinnerMessage"></Spinner>

    <a id="downloadAnchor" style="display: none"></a>

    <DriveHeader
      :gridView="isGrid"
      :isWritable="isWritable"
      :canPaste="isPasteOptionAvailable"
      :path="path"
      @switchView="switchView()"
      @goBackToLevel="goBackToLevel($event)"
      @askMkdir="askMkdir()"
      @createFile="createBlankFile()"
      @createImageFile="createBlankImageFile()"
      @newApp="createNewApp()"
      @search="openSearch(false)"
      @paste="pasteToFolder($event)"
    />

    <AppPrompt
      v-if="showPrompt"
      @hide-prompt="closePrompt()"
      :message="prompt_message"
      :placeholder="prompt_placeholder"
      :max_input_size="prompt_max_input_size"
      :value="prompt_value"
      :consumer_func="prompt_consumer_func"
      :action="prompt_action"
    />

    <NewImageFilePrompt
      v-if="showNewImageFilePrompt"
      @hide-prompt="closeNewImageFilePrompt()"
      :consumer_func="prompt_consumer_func"
    />

    <NewAppPrompt
      v-if="showNewAppPrompt"
      @hide-prompt="closeNewAppPrompt()"
      :consumer_func="prompt_new_app_func"
    />
    <FolderProperties
      v-if="showFolderProperties"
      v-on:hide-folder-properties-view="showFolderProperties = false"
      :folder_properties="folder_properties"
    >
    </FolderProperties>

    <transition name="fade" mode="out-in" appear>
    <DriveSelected v-if="selectedFiles.length > 1" :totalFiles="files.length" :selectedFiles="selectedFiles" @selectAllOrNone="selectAllOrNone()">
      <li id="copy" v-if="allowCopy" @keyup.enter="copyMultiSelect()" @click="copyMultiSelect()">{{ translate("DRIVE.COPY") }}</li>
      <li id="cut" v-if="isWritable" @keyup.enter="cutMultiSelect()" @click="cutMultiSelect()">{{ translate("DRIVE.CUT") }}</li>
      <li id="delete" v-if="isWritable" @keyup.enter="deleteFilesMultiSelect()" @click="deleteFilesMultiSelect()">{{ translate("DRIVE.DELETE") }}</li>
      <li id="download" @keyup.enter="downloadAllMultiSelect()" @click="downloadAllMultiSelect()">{{ translate("DRIVE.DOWNLOAD") }}</li>
      <li id="zip" @keyup.enter="zipAndDownloadMultiSelect()" @click="zipAndDownloadMultiSelect()">{{ translate("DRIVE.ZIP") }}</li>
      <li id="create-thumbnail" v-if="isWritable" @keyup.enter="createThumbnailMultiSelect()" @click="createThumbnailMultiSelect()">{{ translate("DRIVE.THUMB") }}</li>
      <li id="deselect" @keyup.enter="selectedFiles = []" @click="selectedFiles = []">
        {{ translate("DRIVE.DESELECT") }}
      </li>
    </DriveSelected>
    </transition>
    <transition name="drop">
      <DriveMenu ref="drivePasteMenu" v-if="viewPasteMenu" @closeMenu="closePasteMenu()">
        <li id="paste-files" @keyup.enter="pasteMultiSelect" @click="pasteMultiSelect">
          {{ translate("DRIVE.PASTE") }}
        </li>
      </DriveMenu>
    </transition>

    <div
      id="dnd"
      @drop="dndDrop($event)"
      @dragover.prevent
      :class="{ not_owner: isNotMe, dnd: 'dnd' }"
    >
      <transition name="fade" mode="out-in" appear>
        <DriveGrid v-if="isGrid" appear>
          <DriveGridCard
            v-for="(file, index) in sortedFiles"
            :class="{ shared: isShared(file) }"
            :key="file.getFileProperties().name"
            :filename="file.getFileProperties().name"
            :src="getThumbnailURL(file)"
            :type="file.getFileProperties().getType()"
            @click.native="navigateDrive(file)"
            @openMenu="openMenu(file)"
            :dragstartFunc="dragStart"
            :dropFunc="drop"
            :file="file"
            :itemIndex="index"
            :selected="isSelected(file)"
            @toggleSelection="toggleSelection(file, $event)"
          />
          <DriveGridDrop
            v-if="
              getPath.length > 1 &&
              sortedFiles.length == 0 &&
              currentDir != null &&
              currentDir.isWritable()
            "
          >
          </DriveGridDrop>
        </DriveGrid>

        <DriveTable
          v-else
          :files="sortedFiles"
          :selectedFiles.sync="selectedFiles"
          @sortBy="setSortBy"
          @openMenu="openMenu"
          @navigateDrive="navigateDrive"
        />
      </transition>
    </div>

    <transition name="drop">
      <DriveMenu ref="driveMenu" v-if="viewMenu" @closeMenu="closeMenu()">
        <li
          id="gallery"
          v-if="canOpen && !isMarkup && !isHTML && !hexViewerAlternativeAvailable"
          @keyup.enter="viewFile()"
          @click="viewFile()"
        >
          {{ translate("DRIVE.VIEW") }}
        </li>
        <li
          id="view-markup"
          v-if="isMarkup"
          @keyup.enter="viewFile()"
          @click="viewFile()"
        >
          {{ translate("DRIVE.VIEW") }}
        </li>
        <li
          id="edit-markup"
          v-if="isMarkup"
          @keyup.enter="editFile()"
          @click="editFile()"
        >
          {{ translate("DRIVE.EDIT") }}
        </li>
        <li
          id="view-html"
          v-if="isHTML && isHTMLViewable"
          @keyup.enter="viewFile()"
          @click="viewFile()"
        >
          {{ translate("DRIVE.VIEW") }}
        </li>
        <li id="edit-html" v-if="isHTML" @keyup.enter="editFile()" @click="editFile()">
          {{ translate("DRIVE.EDIT") }}
        </li>
        <li
          id="open-in-app"
          v-for="app in availableApps"
          v-on:keyup.enter="appOpen(app.name)"
          v-on:click="appOpen(app.name)"
        >
          {{ app.contextMenuText }}
        </li>
        <li
          id="download-folder"
          v-if="canOpen"
          @keyup.enter="downloadAll"
          @click="downloadAll"
        >
          {{ translate("DRIVE.DOWNLOAD") }}
        </li>
        <li id="rename-file" v-if="isWritable" @keyup.enter="rename" @click="rename">
          {{ translate("DRIVE.RENAME") }}
        </li>
        <li
          id="delete-file"
          v-if="isWritable"
          @keyup.enter="deleteFile"
          @click="deleteFile"
        >
          {{ translate("DRIVE.DELETE") }}
        </li>
        <li id="copy-file" v-if="allowCopy" @keyup.enter="copy" @click="copy">Copy</li>
        <li id="cut-file" v-if="isWritable" @keyup.enter="cut" @click="cut">Cut</li>
        <li id="paste-file" v-if="isPasteAvailable" @keyup.enter="paste" @click="paste">
          {{ translate("DRIVE.PASTE") }}
        </li>
        <li
          id="share-file"
          v-if="allowShare"
          @keyup.enter="showShareWith"
          @click="showShareWith"
        >
          {{ translate("DRIVE.SHARE") }}
        </li>
        <li
          id="zip-folder"
          v-if="allowDownloadFolder"
          @keyup.enter="zipAndDownload"
          @click="zipAndDownload"
        >
          {{ translate("DRIVE.DOWNLOAD.ZIP") }}
        </li>
        <li
          id="create-thumbnail"
          v-if="isWritable && canCreateThumbnail"
          @keyup.enter="createThumbnail"
          @click="createThumbnail"
        >
          {{ translate("DRIVE.THUMB") }}
        </li>
        <li
          id="folder-props"
          v-if="allowViewFolderProperties"
          @keyup.enter="viewFolderProperties"
          @click="viewFolderProperties"
        >
          {{ translate("DRIVE.PROPS") }}
        </li>
        <li
          id="add-to-launcher"
          v-if="allowAddingToLauncher"
          @keyup.enter="addToLauncher"
          @click="addToLauncher"
        >
          {{ translate("DRIVE.ADD.LAUNCH") }}
        </li>
        <li id="app-run" v-if="isInstallable" @keyup.enter="runApp()" @click="runApp()">
          {{ translate("DRIVE.RUN") }}
        </li>
        <li
          id="app-install"
          v-if="isInstallable"
          @keyup.enter="installApp()"
          @click="installApp()"
        >
          {{ translate("DRIVE.INSTALL") }}
        </li>
      </DriveMenu>
    </transition>

    <Gallery
      v-if="showGallery"
      @hide-gallery="back()"
      :files="sortedFiles"
      :initial-file-name="appArgs.filename"
    >
    </Gallery>

    <Hex
      v-if="showHexViewer"
      v-on:hide-hex-viewer="back()"
      :file="selectedFiles[0]"
      :context="context"
    >
    </Hex>
    <Pdf
      v-if="showPdfViewer"
      v-on:hide-pdf-viewer="back()"
      :file="selectedFiles[0]"
      :context="context"
    >
    </Pdf>
    <CodeEditor
      v-if="showCodeEditor"
      v-on:hide-code-editor="back()"
      v-on:update-refresh="forceUpdate++"
      :file="selectedFiles[0]"
      :context="context"
    >
    </CodeEditor>
    <Markup
      v-if="showMarkupViewer"
      v-on:hide-markup-viewer="showDrive()"
      :propAppArgs="appArgs"
    >
    </Markup>
    <Identity
      v-if="showIdentityProof"
      v-on:hide-identity-proof="back()"
      :file="selectedFiles[0]"
      :context="context"
    >
    </Identity>

    <Share
      v-if="showShare"
      v-on:hide-share-with="closeShare"
      v-on:update-shared-refresh="forceSharedRefreshWithUpdate++"
      v-on:update-files="forceUpdate++"
      :data="sharedWithData"
      :fromApp="fromApp"
      :displayName="displayName"
      :allowReadWriteSharing="allowReadWriteSharing"
      :allowCreateSecretLink="allowCreateSecretLink"
      :files="filesToShare"
      :path="pathToFile"
      :currentDir="currentDir"
      :messages="messages"
    >
    </Share>
    <Search
      v-if="showSearch"
      v-on:hide-search="closeSearch"
      :path="searchPath"
      :navigateToAction="navigateToAction"
    >
    </Search>
    <AppRunner
      v-if="showAppRunner"
      v-on:hide-app-run="closeAppRunner"
      :appPropsFile="selectedFiles[0]"
    >
    </AppRunner>
    <AppInstall
      v-if="showAppInstallation"
      v-on:hide-app-installation="closeAppInstallation"
      :appInstallSuccessFunc="appInstallSuccess"
      :appPropsFile="selectedFiles[0]"
      :installFolder="getPath"
    >
    </AppInstall>
    <AppSandbox
      v-if="showAppSandbox"
      v-on:hide-app-sandbox="closeAppSandbox(true)"
      v-on:close-app-sandbox="closeAppSandbox(false)"
      v-on:refresh="forceSharedRefreshWithUpdate++"
      :sandboxAppName="sandboxAppName"
      :currentFile="currentFile"
      :currentPath="currentPath"
      :currentProps="appSandboxProps"
      :htmlAnchor="htmlAnchor"
    >
    </AppSandbox>
    <Replace
      v-if="showReplace"
      v-on:hide-replace="showReplace = false"
      :replace_message="replace_message"
      :replace_body="replace_body"
      :consumer_cancel_func="replace_consumer_cancel_func"
      :consumer_func="replace_consumer_func"
      :showApplyAll="replace_showApplyAll"
    >
    </Replace>
    <Warning
      v-if="showWarning"
      v-on:hide-warning="closeWarning"
      :warning_message="warning_message"
      :warning_body="warning_body"
      :consumer_func="warning_consumer_func"
    >
    </Warning>
    <Error
      v-if="showError"
      @hide-error="showError = false"
      :title="errorTitle"
      :body="errorBody"
      :messageId="messageId"
    >
    </Error>
    <Confirm
      v-if="showConfirm"
      v-on:hide-confirm="showConfirm = false"
      :confirm_message="confirm_message"
      :confirm_body="confirm_body"
      :consumer_cancel_func="confirm_consumer_cancel_func"
      :consumer_func="confirm_consumer_func"
    >
    </Confirm>
  </article>
</template>

<script>

const AppInstall = require("../components/sandbox/AppInstall.vue");
const AppRunner = require("../components/sandbox/AppRunner.vue");
const AppSandbox = require("../components/sandbox/AppSandbox.vue");
const CodeEditor = require("../components/code-editor/CodeEditor.vue");
const Confirm = require("../components/confirm/Confirm.vue");
const DriveHeader = require("../components/drive/DriveHeader.vue");
const DriveGrid = require("../components/drive/DriveGrid.vue");
const DriveGridCard = require("../components/drive/DriveGridCard.vue");
const DriveGridDrop = require("../components/drive/DriveGridDrop.vue");
const DriveTable = require("../components/drive/DriveTable.vue");
const Error = require("../components/error/Error.vue");
const Gallery = require("../components/drive/DriveGallery.vue");
const Identity = require("../components/identity-proof-viewer.vue");
const Share = require("../components/drive/DriveShare.vue");
const Search = require("../components/Search.vue");
const Markup = require("../components/viewers/Markup.vue");
const Hex = require("../components/viewers/Hex.vue");
const ProgressBar = require("../components/drive/ProgressBar.vue");
const DriveMenu = require("../components/drive/DriveMenu.vue");
const DriveSelected = require("../components/drive/DriveSelected.vue");

const AppPrompt = require("../components/prompt/AppPrompt.vue");
const NewImageFilePrompt = require("../components/NewImageFilePrompt.vue");
const NewAppPrompt = require("../components/sandbox/new-app/NewAppPrompt.vue");
const FolderProperties = require("../components/FolderProperties.vue");
const Pdf = require("../components/pdf/PDF.vue");
const Replace = require("../components/replace/Replace.vue");
const Spinner = require("../components/spinner/Spinner.vue");
const Warning = require('../components/Warning.vue');

const helpers = require("../mixins/storage/index.js");
const downloaderMixins = require("../mixins/downloader/index.js");
const zipMixin = require("../mixins/zip/index.js");
const i18n = require("../i18n/index.js");

const router = require("../mixins/router/index.js");
const launcherMixin = require("../mixins/launcher/index.js");
const sandboxMixin = require("../mixins/sandbox/index.js");

module.exports = {
	components: {
	    AppInstall,
	    AppRunner,
	    AppSandbox,
	    CodeEditor,
	    Confirm,
		DriveHeader,
		DriveGrid,
		DriveGridCard,
		DriveGridDrop,
		DriveTable,
		DriveMenu,
        DriveSelected,
		Error,
		AppPrompt,
		NewImageFilePrompt,
		NewAppPrompt,
		FolderProperties,
		ProgressBar,
		Gallery,
		Identity,
		Share,
		Search,
		Markup,
		Hex,
		Pdf,
		Replace,
		Spinner,
		Warning
	},
	data() {
		return {
			isGrid: true,
			// path: [],
            searchPath: null,
			currentDir: null,
			files: [],
			sortBy: "name",
			normalSortOrder: true,
			clipboard: {},
			selectedFiles: [],
			url: null,
			viewMenu: false,
			viewPasteMenu: false,
			showShare: false,
			sharedWithState: null,
			sharedWithData: {
				"edit_shared_with_users": [],
				"read_shared_with_users": []
			},
			forceSharedRefreshWithUpdate: 0,

                        appArgs: {},

			showAdmin: false,
			showGallery: false,
			showIdentityProof: false,
			showSocial: false,
			showSearch: false,
			showHexViewer: false,
			showCodeEditor: false,
			showMarkupViewer: false,
			showPdfViewer: false,
			showTextViewer: false,
			showPassword: false,
			showAccount: false,
			showRequestSpace: false,
			showBuySpace: false,
			paymentProperties: {
				isPaid() { return false; }
			},
			showFeedbackForm: false,
			admindata: { pending: [] },
			messages: [],
			messageId: null,
			messageMonitors: [],
			conversationMonitors: [],
			clipboardAction: "",
			forceUpdate: 0,
			externalChange: 0,

			prompt_message: '',
			prompt_placeholder: '',
			prompt_max_input_size: null,
			prompt_value: '',
			prompt_consumer_func: () => { },
			prompt_new_app_func: (name, permissions) => { },
			prompt_action: 'ok',
			showPrompt: false,
			showNewImageFilePrompt: false,
			showNewAppPrompt: false,
            showFolderProperties: false,
            showAppInstallation: false,
            showAppRunner: false,
            showAppSandbox: false,
            sandboxAppName: '',
            appSandboxProps: null,
			showSelect: false,
			showWarning: false,
			showReplace: false,
			warning_message: "",
			warning_body: "",
			warning_consumer_func: () => { },
			replace_message: "",
			replace_body: "",
			replace_consumer_cancel_func: (applyToAll) => { },
			replace_consumer_func: (applyToAll) => { },
			replace_showApplyAll: false,
			errorTitle: '',
			errorBody: '',
			showError: false,
            showConfirm: false,
            confirm_message: "",
            confirm_body: "",
            confirm_consumer_cancel_func: () => {},
            confirm_consumer_func: () => {},
			showSpinner: true,
			spinnerMessage: '',
			onUpdateCompletion: [], // methods to invoke when current dir is next refreshed
            dblClickDelay: 700,
            clicks: 0,
            clickTimer: null,
            clickedFilename: null,
            isStreamingAvailable: false,
            launcherApp: null,
            uploadProgressQueue: { entries:[]},
            executingUploadProgressCommands: false,
            progressBarUpdateFrequency: 15,
            zipAndDownloadFoldersCount: 0,
            htmlAnchor: "",
            previouslyOpenedApp: {path: '', filename: '', app: ''},
            disallowedFilenames: new Map(),
		};
	},
	mixins:[downloaderMixins, router, zipMixin, launcherMixin, i18n, sandboxMixin],
        mounted: function() {

        },
	computed: {
		...Vuex.mapState([
			'quotaBytes',
			'usageBytes',
			'context',
			'mirrorBatId',
			'download',
			'open',
			'initPath',
			'isLoggedIn',
			'path',
            "sandboxedApps",
            "shortcuts"
		]),
		...Vuex.mapGetters([
			'isSecretLink',
			'getPath'
		]),

        sortedFiles() {
			if (this.files == null) {
				return [];
			}
			var sortBy = this.sortBy;
			var reverseOrder = !this.normalSortOrder;
			var that = this;

			return this.files.slice(0).sort(function (a, b) {
				var aVal, bVal;
				if (sortBy == null)
					return 0;
				if (sortBy == "name") {
					aVal = a.getFileProperties().name;
					bVal = b.getFileProperties().name;
				} else if (sortBy == "size") {
					aVal = that.getFileSize(a.getFileProperties());
					bVal = that.getFileSize(b.getFileProperties());
				} else if (sortBy == "modified") {
					aVal = a.getFileProperties().modified;
					bVal = b.getFileProperties().modified;
                } else if (sortBy == "created") {
                    aVal = a.getFileProperties().created;
                    bVal = b.getFileProperties().created;
				} else if (sortBy == "type") {
					aVal = a.isDirectory();
					bVal = b.isDirectory();
				} else
					throw "Unknown sort type " + sortBy;
				if (reverseOrder) {
					var tmp = aVal;
					aVal = bVal;
					bVal = tmp;
					tmp = a;
					a = b;
					b = tmp;
				}

				if (a.isDirectory() !== b.isDirectory()) {
					return a.isDirectory() ? -1 : 1;
				} else {
					if (sortBy == "name") {
						return aVal.localeCompare(bVal, undefined, { numeric: true });
					} else if (sortBy == "modified" || sortBy == "created") {
						return aVal.compareTo(bVal);
					} else {
						if (aVal < bVal) {
							return -1;
						} else if (aVal == bVal) {
							return 0;
						} else {
							return 1;
						}
					}
				}
			});
		},

        isInstallable: function() {
           try {
               if (this.selectedFiles.length != 1)
                   return false;
               if (!this.isLoggedIn && this.path.length > 0)
                   return false;
               return !this.selectedFiles[0].isDirectory()
                    && this.selectedFiles[0].getFileProperties().name == "peergos-app.json";
           } catch (err) {
               return false;
           }
        },
        availableApps: function() {
            if (this.currentDir == null)
                return [];
            if (this.selectedFiles.length != 1)
                return [];
            return this.availableAppsForFile(this.selectedFiles[0]);
        },
		isSearchable() {
			try {
				if (this.currentDir == null)
					return false;
				if (this.selectedFiles.length != 1)
					return false;
				if (!this.selectedFiles[0].isDirectory())
					return false;
				var owner = this.currentDir.getOwnerName();
				var me = this.context.username
				if (owner != me) {
					return false;
				}
				return true;
			} catch (err) {
				return false;
			}
		},
		canCreateThumbnail() {
            if (this.selectedFiles.length != 1)
                return false;
            let file = this.selectedFiles[0];
            if (file.props.thumbnail.ref != null) {
                return false;
            }
            var mimeType = file.props.mimeType;
            if (mimeType.startsWith("video")) {
                return this.isStreamingAvailable;
            } else if(mimeType.startsWith("image") || mimeType.startsWith("audio/mpeg")) {
                return true;
            } else {
                return false;
            }
		},
        canOpen() {
            try {
                if (this.currentDir == null)
                    return false;
                if (this.selectedFiles.length != 1)
                    return false;
                return !this.selectedFiles[0].isDirectory()
            } catch (err) {
                return false;
            }
        },
        hexViewerAlternativeAvailable() {
            if (this.selectedFiles.length == 0)
                return;
            let file = this.selectedFiles[0];
            let filename = file.getName();
            let app = this.getApp(file, this.getPath, false);
            return this.availableApps.length > 0 && app === "hex";
        },
        isMarkup() {
            try {
                if (this.currentDir == null)
                    return false;
                if (this.selectedFiles.length != 1)
                    return false;
                if (this.selectedFiles[0].isDirectory())
                    return false;
                let file =  this.selectedFiles[0];
                let mimeType = file.getFileProperties().mimeType;
                return mimeType.startsWith("text/x-markdown") ||
                    (mimeType.startsWith("text/") &&
                    (file.getName().endsWith('.md') || file.getName().endsWith('.note')) );
            } catch (err) {
                return false;
            }
        },
        isHTMLViewable() {
            return this.isStreamingAvailable;
        },
        isHTML() {
            try {
                if (this.currentDir == null)
                    return false;
                if (this.selectedFiles.length != 1)
                    return false;
                if (this.selectedFiles[0].isDirectory())
                    return false;
                let file =  this.selectedFiles[0];
                let mimeType = file.getFileProperties().mimeType;
                return mimeType.startsWith("text/html") ||
                    (mimeType.startsWith("text/") && file.getName().endsWith('.html'));
            } catch (err) {
                return false;
            }
        },
		allowDownloadFolder() {
			try {
				if (this.currentDir == null)
					return false;
				if (this.selectedFiles.length != 1)
					return false;
                        if (this.path.length == 0 && this.selectedFiles[0].getName() != this.context.username) {
                            return false;
                        }
				return this.selectedFiles[0].isDirectory();
			} catch (err) {
				return false;
			}
		},
        allowViewFolderProperties() {
			try {
                if (!(this.path.length > 0)) {
                    return false;
                }
				if (this.currentDir == null)
					return false;
				if (this.selectedFiles.length != 1)
					return false;
				return this.selectedFiles[0].isDirectory();
			} catch (err) {
				return false;
			}
        },
        allowCopy() {
            return this.isLoggedIn && this.path.length > 0;
        },
		allowShare() {
			return this.isLoggedIn && this.path.length > 0;
		},
		allowAddingToLauncher() {
            try {
                if (this.currentDir == null)
                    return false;
                if (this.selectedFiles.length != 1)
                    return false;
                if (!this.isLoggedIn && this.path.length > 0)
                    return false;
                let file = this.selectedFiles[0];
                let postFix = file.isDirectory() ? '/' : '';
                let link = this.path.join('/') + '/' + file.getName() + postFix;
                let entry = this.shortcuts.shortcutsMap.get(link);
                return entry == null;
            } catch (err) {
                return false;
            }
        },
		isIcsFile() {
			try {
				if (this.currentDir == null)
					return false;
				if (this.selectedFiles.length != 1)
					return false;
				return !this.selectedFiles[0].isDirectory() &&
					this.selectedFiles[0].getFileProperties().name.toUpperCase().endsWith(".ICS");
			} catch (err) {
				return false;
			}
		},
		isWritable() {
			try {
				if (this.currentDir == null)
					return false;
				return this.currentDir.isWritable();
			} catch (err) {
				return false;
			}
		},

		isNotMe() {
			if (this.currentDir == null)
				return true;

			var owner = this.currentDir.getOwnerName();
			var me = this.context.username
			if (owner === me) {
				return false;
			}
			return true;
		},
		isPasteOptionAvailable() {
		    let singlePasteOption = this.isPasteToFolderAvailable();
		    let multiPasteOption = this.isPasteToFolderMultiSelectAvailable(this.currentDir);
		    if (multiPasteOption) {
    		    this.multiSelectTargetFolder = this.currentDir;
		    }
		    return singlePasteOption || multiPasteOption;
		},
		isPasteAvailable() {
			return this.isPasteToFolderAvailable();
		},
	},



	created() {
	    let that = this;
		this.onResize();
		let illegalFilenames = [
                                    'constructor',
                                    '__defineGetter__',
                                    '__defineSetter__',
                                    'hasOwnProperty',
                                    '__lookupGetter__',
                                    '__lookupSetter__',
                                    'isPrototypeOf',
                                    'propertyIsEnumerable',
                                    'toString',
                                    'valueOf',
                                    '__proto__',
                                    'toLocaleString'
                                  ];
		illegalFilenames.forEach(item => that.disallowedFilenames.set(item, ""));
		// TODO: throttle onResize and make it global?
		window.addEventListener('resize', this.onResize, {passive: true} );
        peergos.shared.user.App.init(that.context, "launcher").thenApply(launcher => {
            that.launcherApp = launcher;
            that.init();
        });
	},

	beforeDestroy() {
		window.removeEventListener('resize', this.onResize );

	},


	watch: {
		// manually encode currentDir dependencies to get around infinite dependency chain issues with async-computed methods
		context(newContext, oldContext) {
			this.updateCurrentDir();
			if (newContext != null && newContext.username != null) {
				this.updateUsage();
				this.updateQuota();
				const that = this;
			}
		},

		path(newPath, oldPath) {
            this.updateCurrentDir();
		},
		forceSharedRefreshWithUpdate(newCounter, oldCounter) {
			this.updateCurrentDir();
		},
		forceUpdate(newUpdateCounter, oldUpdateCounter) {
			this.updateCurrentDir();
		},

		externalChange(newExternalChange, oldExternalChange) {
			let that = this;
			this.updateSocial(() => {
			    that.updateCurrentDir();
			});
		},

		files(newFiles, oldFiles) {

			// console.log('drive oldFiles: ', oldFiles )
			// console.log('drive newFiles: ', newFiles )

			if (newFiles == null)
				return;

			if (oldFiles == null && newFiles != null)
				return this.processPending();

			if (oldFiles.length != newFiles.length) {
				this.processPending();
			} else {
				for (var i = 0; i < oldFiles.length; i++)
					if (!oldFiles[i].samePointer(newFiles[i]))
						return this.processPending();
			}
		}
	},



	methods: {
		...Vuex.mapActions([
			'updateQuota',
			'updateUsage',
            'updateSocial',
            'updateMirrorBatId'
		]),

		init() {
		    this.isStreamingAvailable = this.supportsStreaming();
		    let that = this;
            streamSaver.createWriteStream("init-sw", null,
                function (url) {
                    console.log('init-sw complete');
                },
                function (seekHi, seekLo, seekLength, uuid) {},
                undefined,
                0
            );
            Vue.nextTick(() => {
                that.setup();
            });
        },
		setup() {
			const that = this;
			if (this.context != null && this.context.username == null) {
			    // open drive from a secret link
			    this.context.getEntryPath().thenApply(function (linkPath) {
				var path = that.initPath == null ? null : decodeURIComponent(that.initPath);
				if (path != null && (path.startsWith(linkPath) || linkPath.startsWith(path))) {
                    that.$store.commit('SET_PATH', path.split('/').filter(n => n.length > 0))
                    if (that.download || that.open) {
                        that.context.getByPath(path)
                            .thenApply(function (file) {
                            if (! file.get().isDirectory()) {
                                if (that.download) {
                                that.downloadFile(file.get());
                                } else if (that.open) {
                                var open = () => {
                                    const filename = file.get().getName();
                                    that.selectedFiles = that.files.filter(f => f.getName() == filename);
                                    var app = that.getApp(file.get(), path, false);
                                    that.openInApp({filename:filename}, app);
                                    that.openFileOrDir(app, that.getPath, {filename:filename}, false);
                                };
                                that.onUpdateCompletion.push(open);
                                }
                            } else {
                                let app = that.getApp(file.get(), linkPath);
                                that.openFileOrDir(app, linkPath, {path:path});
                            }
                        });
                    } else if(path.startsWith("/peergos/recommended-apps")) {
                        let appPath = "/peergos/recommended-apps/";
                        that.context.getByPath(appPath + "index.html").thenApply(file => {
                            if (file.ref != null) {
                                var openRecApps = () => {
                                    const filename = "index.html";
                                    that.selectedFiles = that.files.filter(f => f.getName() == filename);
                                    that.sandboxAppName = '$$app-gallery$$';
                                    that.currentFile = file.ref;
                                    that.currentPath = appPath;
                                    that.showAppSandbox = true;
                                };
                                that.onUpdateCompletion.push(openRecApps);
                            }
                        });
                    }
				} else {
                                    that.$store.commit('SET_PATH', linkPath.split('/').filter(n => n.length > 0))
                                    if (that.download) {
                                        var download = () => {
                                            that.downloadFile(that.files[0]);
				 	};
				 	that.onUpdateCompletion.push(download);
                                    }
                                    if (that.open) {
                                        const props = that.getPropsFromUrl();
                                        var open = () => {
                                            const oneFile = that.files.length == 1;
                                            const openSubdir = props.args != null && props.args.path != null;
                                            const appDir = "Drive" != that.getApp(that.currentDir, linkPath);
                                            if (props.args != null && props.args.filename != null && props.args.filename != "") {
                                                // if props name a file, open it
                                                that.appArgs = props.args;
                                                const filename = props.args.filename;
                                                that.selectedFiles = that.files.filter(f => f.getName() == filename);
					        var app = props.app || that.getApp(that.selectedFiles[0], that.getPath, false);
                                                that.openInApp(props.args, app);
                                                that.openFileOrDir(app, that.getPath, props.args, false);
                                            } else if (openSubdir) {
                                                // if props name a dir, open it
                                                that.appArgs = props.args;
					        var app = props.app || that.getApp(that.currentDir, that.getPath, false);
                                                that.openInApp(props.args, app);
                                                that.openFileOrDir(app, that.getPath, props.args, false);
                                            } else if (oneFile && !appDir) { // if there is exactly 1 file, open it
                                                const filename = that.files[0].getName();
                                                that.selectedFiles = that.files;
					                            let inbuiltApps = that.getInbuiltApps(that.files[0]);
					                            if (inbuiltApps.length > 0 && inbuiltApps[0].name != "hex" && inbuiltApps[0].name != "editor") {
                                                    that.openInApp({filename:filename}, inbuiltApps[0].name);
                                                    that.openFileOrDir(inbuiltApps[0].name, that.getPath, {filename:filename}, false);
                                                } else { //get from recommended apps if possible
                                                    let recommendedApp = that.getRecommendedViewer(that.files[0]);
                                                    if (recommendedApp != null) {
                                                        that.readAppProperties(recommendedApp, "/peergos/recommended-apps/").thenApply(props => {
                                                            if (props == null) {
                                                                var app = that.getApp(that.files[0], that.getPath, false);
                                                                that.openInApp({filename:filename}, app);
                                                                that.openFileOrDir(app, that.getPath, {filename:filename}, false);
                                                            } else {
                                                                that.sandboxAppName = recommendedApp;
                                                                that.currentFile= that.files[0];
                                                                that.currentPath= that.getPath
                                                                that.appSandboxProps = props;
                                                                that.showAppSandbox = true;
                                                            }
                                                        });
                                                    } else {
                                                        var app = that.getApp(that.files[0], that.getPath, false);
                                                        that.openInApp({filename:filename}, app);
                                                        that.openFileOrDir(app, that.getPath, {filename:filename}, false);
                                                    }
                                                }
                                            } else {
                                                // open a directory
                                                let app = that.getApp(that.currentDir, linkPath);
                                                that.openFileOrDir(app, linkPath, {filename:""});
                                            }
				 	};
                                        // first init history with drive so back button/close app works
                                        that.openFileOrDir("Drive", that.getPath, {filename:""}, false);
				 	that.onUpdateCompletion.push(open);
                                    }
				}
			    });
			} else {
				const props = this.getPropsFromUrl();

				// const app = props == null ? null : props.app;
				// const path = props == null ? null : props.path;
				// const filename = props == null ? null : props.filename;

				const pathFromUrl = props == null ? null : props.path;
				const appFromUrl = props == null ? null : props.app;
				const argsFromUrl = props == null ? null : props.args;

				const apps = ['Calendar', 'NewsFeed', 'Social', 'Launcher', 'SharedWith']

				if (pathFromUrl !== null && !apps.includes(appFromUrl) ) {

					this.showSpinner = true;

					let open = () => {
					    that.openInApp(argsFromUrl, appFromUrl)
					};
					this.onUpdateCompletion.push(open);

					this.$store.commit('SET_PATH', pathFromUrl.split('/').filter(n => n.length > 0))

				} else {
					this.$store.commit('SET_PATH', [this.context.username])
					this.updateHistory('Drive', this.getPath, {filename:""})
				}
                                that.updateUsage()
                                that.updateQuota()
                                that.updateMirrorBatId()
                    
				this.updateSocial(() => {
                    

                    that.context.getPaymentProperties(false).thenApply(function (paymentProps) {
                        if (paymentProps.isPaid()) {
                            that.paymentProperties = paymentProps;
                        } else
                            that.context.getPendingSpaceRequests().thenApply(reqs => {
                                if (reqs.toArray([]).length > 0)
                                    that.$store.commit('USER_ADMIN', true);
                            });
                    });
                });
			}
			this.showPendingServerMessages();
		},

        selectAllOrNone() {
            if (this.selectedFiles.length == this.files.length) {
                this.selectedFiles = [];
            } else {
                this.selectedFiles = this.files.slice();
            }
        },

        appInstallSuccess(appName) {
        },

		setSortBy(prop) {
			if (this.sortBy == prop)
				this.normalSortOrder = !this.normalSortOrder;
			this.sortBy = prop;
		},

		onResize() {
			this.closeMenu()
			this.$store.commit('SET_WINDOW_WIDTH', window.innerWidth)
		},
        installApp() {
            this.closeMenu();
            this.showAppInstallation = true;
        },
        closeAppInstallation() {
            this.showAppInstallation = false;
            this.forceSharedRefreshWithUpdate++;
        },
        runApp() {
            this.closeMenu();
            this.showAppRunner = true;
        },
        closeAppRunner() {
            this.showAppRunner = false;
            this.forceSharedRefreshWithUpdate++;
        },
        createThumbnail() {
            this.closeMenu();
            if (this.selectedFiles.length != 1)
                return false;
            let file = this.selectedFiles[0];
            let that = this;
            file.calculateAndUpdateThumbnail(this.context.network, this.context.crypto).thenApply(res => {
                if (res) {
                    that.currentDirChanged();
                }
             });
        },
		showPendingServerMessages() {
			// let context = this.getContext();
			let that = this;
			this.context.getServerConversations().thenApply(function (conversations) {
				let allConversations = [];
				let conv = conversations.toArray();
				conv.forEach(function (conversation) {
					let arr = conversation.messages.toArray();
					let lastMessage = arr[arr.length - 1];
					allConversations.push({
						id: lastMessage.id(), sendTime: lastMessage.getSendTime().toString().replace("T", " "),
						contents: lastMessage.getContents(), previousMessageId: lastMessage.getPreviousMessageId(),
						from: lastMessage.getAuthor(), msg: lastMessage
					});
					arr.forEach(function (message) {
						that.messageMonitors.push({
							id: message.id(), sendTime: message.getSendTime().toString().replace("T", " "),
							contents: message.getContents(), previousMessageId: message.getPreviousMessageId(),
							from: message.getAuthor(), msg: message
						});
					});
				});
				if (allConversations.length > 0) {
					Vue.nextTick(function () {
						allConversations.forEach(function (msg) {
							that.conversationMonitors.push(msg);
						});
					});
				}
			}).exceptionally(function (throwable) {
                console.log(throwable.getMessage());
			});
		},
		showFiles(data) {
			// this.path = data.path;
			this.$store.commit('SET_PATH', data.path)

		},
		processPending() {
			for (var i = 0; i < this.onUpdateCompletion.length; i++) {
				this.onUpdateCompletion[i].call();
			}
			this.onUpdateCompletion = [];
		},

                back() {
                    this.previouslyOpenedApp = {path: '', filename: '', app: ''};
                    history.back();
                },

                showDrive() {
                    this.previouslyOpenedApp = {path: '', filename: '', app: ''};
                    this.updateHistory("Drive", this.getPath, {filename:""});
                },

		closeApps() {
		    this.showGallery = false;
            this.showIdentityProof = false;
		    this.showPdfViewer = false;
		    this.showCodeEditor = false;
		    this.showMarkupViewer = false;
		    this.showAppSandbox = false;
		    this.showTextViewer = false;
		    this.showHexViewer = false;
		    this.showSearch = false;
		},

		navigateToAction(directory) {
			let newPath = directory.startsWith("/") ? directory.substring(1).split('/') : directory.split('/');
			let currPath = this.path;
			if (newPath.length != currPath.length) {
				this.changePath(directory);
			} else {
				for (var i = 0; i < newPath.length; i++) {
					if (newPath[i] != currPath[i]) {
						this.changePath(directory);
						return;
					}
				}
			}
		},
        appOpen(appName) {
            this.closeMenu();
            this.sandboxAppName = appName;
            this.currentFile= this.selectedFiles[0];
            this.currentPath= this.getPath;
            this.showAppSandbox = true;
        },
        closeAppSandbox(reloadDrive) {
            this.showAppSandbox = false;
            this.appSandboxProps = null;
            if (reloadDrive) {
                this.showDrive();
            }
            if(this.htmlAnchor.length > 0) {
                let file = this.selectedFiles[0];
                let filename = file.getName();
                let writable = file.isWritable();
                let userApps = this.availableAppsForFile(file);
                var args = {filename:filename}
                this.appArgs = args;
                if (userApps.length == 1) {
                    this.openFileOrDir(userApps[0].name, this.getPath, args, writable);
                } else {
                    var app = this.getApp(file, this.getPath, writable);
                    this.openFileOrDir(app, this.getPath, args, writable);
                }
            }
            this.htmlAnchor = "";
        },
	    openInApp(args, app) {
                if (app == null || app == "" || app == "Drive") {
                    this.previouslyOpenedApp = {path: '', filename: '', app: ''};
                    this.closeApps();
                    return;
                }
                if (this.previouslyOpenedApp.path == this.getPath && this.previouslyOpenedApp.filename == args.filename && this.previouslyOpenedApp.app == app) {
                    return;
                }
                this.appArgs = args;
		        this.selectedFiles = this.files.filter(f => f.getName() == args.filename);
                let that = this;
                this.closeApps();
                if (app == "Gallery")
                    that.showGallery = true;
                else if (app == "pdf")
                    that.showPdfViewer = true;
                else if (app == "editor")
                    that.showCodeEditor = true;
                else if (app == "identity-proof")
                    that.showIdentityProof = true;
                else if (app == "hex")
                    that.showHexViewer = true;
                else if (app == "markdown" || app == "markup")
                    that.showMarkupViewer = true;
                else if (app == "htmlviewer") {
                    that.sandboxAppName = "htmlviewer";
                    that.currentFile= that.selectedFiles[0];
                    that.currentPath= that.getPath;
                    that.showAppSandbox = true;
                } else if (app == "search") {
                    that.showSearch = true;
                } else {
                    that.appOpen(app);
                }
                this.previouslyOpenedApp = {path: this.getPath, filename: args.filename, app: app};
		},
		openSearch(fromRoot) {
			var path = fromRoot ? "/" + this.context.username : this.getPath;

			if (!fromRoot) {
				// if (this.isNotBackground) {
				// 	path = path + this.selectedFiles[0].getFileProperties().name;
				// } else {
					path = path.substring(0, path.length - 1);
				// }
			}
			this.searchPath = path;
			this.showSearch = true;
			this.updateHistory("search", this.getPath, {filename:""});

			this.closeMenu();
		},
		closeSearch() {
			this.showSearch = false;
		},
		updateCurrentDir() {
			this.updateCurrentDirectory(null, null);
		},
		updateCurrentDirectory(selectedFilename, callback) {
		    if (this.context == null)
			return Promise.resolve(null);
		    var path = this.getPath;
		    var that = this;
		    this.context.getByPath(path).thenApply(function (fileOpt) {
		        if (fileOpt.isPresent()) {
                    let file = fileOpt.get();
                    file.getLatest(that.context.network).thenApply(updated => {
                        if (! updated.isDirectory()) {
                            // go to parent if we tried to navigate to file
                            if (path.endsWith("/"))
                                path = path.substring(0, path.length-1)
                            let index = path.lastIndexOf("/");
                            that.changePath(path.substring(0, index));
                            that.updateCurrentDirectory(selectedFilename, callback);
                            return;
                        }
                        that.currentDir = updated;
                        that.updateFiles(selectedFilename, callback);
                    }).exceptionally(function (throwable) {
                        that.$toast.error(that.translate("DRIVE.MISSING.FOLDER"));
                        if (!that.isSecretLink && path.startsWith("/" + that.context.username)) {
                            if (path.endsWith("/"))
                                path = path.substring(0, path.length-1)
                            let index = path.lastIndexOf("/");
                            that.changePath(path.substring(0, index));
                            that.updateCurrentDirectory(selectedFilename, callback);
                        }
                    });
                } else {
                    that.$toast.error(that.translate("DRIVE.MISSING.FOLDER"));
                    if (!that.isSecretLink && path.startsWith("/" + that.context.username)) {
                        if (path.endsWith("/"))
                            path = path.substring(0, path.length-1)
                        let index = path.lastIndexOf("/");
                        that.changePath(path.substring(0, index));
                        that.updateCurrentDirectory(selectedFilename, callback);
                    }
                }
		    }).exceptionally(function (throwable) {
			    console.log(throwable.getMessage());
		    });
		},

		updateFiles(selectedFilename, callback) {
			var current = this.currentDir;
			if (current == null)
				return Promise.resolve([]);
			let that = this;
			// let context = this.getContext();
			let path = that.path.length == 0 ? ["/"] : that.path;
			let directoryPath = peergos.client.PathUtils.directoryToPath(path);
			this.context.getDirectorySharingState(directoryPath).thenApply(function (updatedSharedWithState) {
				current.getChildren(that.context.crypto.hasher, that.context.network).thenApply(function (children) {
					that.sharedWithState = updatedSharedWithState;
					var arr = children.toArray();
					that.showSpinner = false;
					let notHiddenFiles = arr.filter(function (f) {
                        return !f.getFileProperties().isHidden;
                    });
                    let allowedFiles = notHiddenFiles.filter(function (f) {
                        return that.disallowedFilenames.get(f.getName()) == null
                            && !f.getName().includes("/");
                    });
                    if (notHiddenFiles.length != allowedFiles.length) {
                        console.log('Folder contains files with disallowed filenames!');
                    }
					that.files = allowedFiles;
                    if (selectedFilename != null) {
                        that.selectedFiles = that.files.filter(f => f.getName() == selectedFilename);
                        that.openFile();
                    } else {
                        that.selectedFiles = [];
                    }
                    if (callback != null) {
                        callback();
                    }
				}).exceptionally(function (throwable) {
					console.log(throwable.getMessage());
				});
			}).exceptionally(function (throwable) {
				console.log(throwable.getMessage());
			});
		},

		getThumbnailURL(file) {
			// cache thumbnail to avoid recalculating it
			if (file.thumbnail != null)
				return file.thumbnail;
			var thumb = file.getBase64Thumbnail();
			file.thumbnail = thumb;
			return thumb;
		},

		goBackToLevel(level) {
			// By default let's jump to the root.

			// this.changePath('/');
			var newLevel = level || 0,
				path = this.path.slice(0, newLevel).join('/');

			if (newLevel < this.path.length) {
				this.changePath(path);
			} else if (newLevel == this.path.length) {
				this.currentDirChanged();
			}
		},

		askMkdir() {
		    let that = this;
			this.prompt_placeholder = this.translate("NEW.FOLDER.NAME.LABEL");
			this.prompt_message = this.translate("NEW.FOLDER.NAME.MESSAGE");
			this.prompt_value = '';
			this.prompt_action = this.translate("PROMPT.OK");
			this.prompt_consumer_func = function (prompt_result) {
				if (prompt_result === null)
					return;
				let folderName = prompt_result.trim();
				if (folderName === '')
					return;
				if (folderName === '.' || folderName === '..')
					return;
				if (folderName.includes("/"))
					return;
                if (that.disallowedFilenames.get(folderName) != null) {
                    that.showToastError(that.translate("DRIVE.FOLDERNAME.INVALID"));
                    return;
                }
				this.mkdir(folderName);
			}.bind(this);
			this.showPrompt = true;
		},

		confirmDelete(file, deleteFn) {
		    const extra = file.isDirectory() ? this.translate("DRIVE.DELETE.FILE2") : "";
		    this.prompt_placeholder = null;
                    this.prompt_message = this.translate("DRIVE.DELETE.FILE") + ` ${file.getName()} ${extra}?`;
		    this.prompt_value = '';
		    this.prompt_consumer_func = deleteFn;
		    this.prompt_action = this.translate("PROMPT.OK");
		    this.showPrompt = true;
		},

		closeWarning() {
			this.showWarning = false;
		},
		confirmDownload(file, downloadFn) {
			var size = this.getFileSize(file.getFileProperties());
			if (this.isStreamingAvailable || size < 50 * 1024 * 1024)
				return downloadFn();
			var sizeMb = (size / 1000 / 1000) | 0;
		    this.warning_message = this.translate("DRIVE.DOWNLOAD.WARN").replace("$NAME", file.getName()).replace("$SIZE", sizeMb);
			if (this.detectFirefoxWritableSteams()) {
				this.warning_body = "Firefox has added support for streaming behind a feature flag. To enable streaming; open about:config, enable 'javascript.options.writable_streams' and then open a new tab";
			} else {
				this.warning_body = "We recommend Chrome for downloads of large files. Your browser doesn't support it and may crash or be very slow";
			}
			this.warning_consumer_func = downloadFn;
			this.showWarning = true;
		},

		switchView() {
			this.isGrid = !this.isGrid;
		},

		currentDirChanged() {
			// force reload of computed properties
			this.forceUpdate++;
		},


		openLinkInNewTab(url) {
			let link = document.createElement('a')
			let click = new MouseEvent('click')

			link.rel = "noopener noreferrer";
			link.target = "_blank"
			link.href = url
			link.dispatchEvent(click)
		},

		getMirrorBatId(file) {
			return file.getOwnerName() == this.context.username ? this.mirrorBatId : java.util.Optional.empty()
		},

		mkdir(name) {
			this.showSpinner = true;
			var that = this;
			this.currentDir.mkdir(name, this.context.network, false, this.getMirrorBatId(this.currentDir), this.context.crypto)
				.thenApply(function (updatedDir) {
					that.currentDir = updatedDir;
					that.updateFiles();
					that.updateUsage();
					that.showSpinner = false;
				}.bind(this)).exceptionally(function (throwable) {
					that.showSpinner = false;
					that.$toast.error(throwable.getMessage(), {timeout:false, id: 'mkdir'})
					that.updateUsage();
				});
		},
        viewFolderProperties() {
            if (this.selectedFiles.length != 1)
                return;
            this.closeMenu();
            let file = this.selectedFiles[0];
            this.showSpinner = true;
            let that = this;
            this.calculateTotalSize(file, this.getPath).thenApply(statistics => {
                that.showSpinner = false;
                that.showFolderProperties = true;
                that.folder_properties = statistics;
            });
        },
	showToastError: function(message) {
            this.$toast.error(message, {timeout:false});
        },
    zipAndDownloadMultiSelect() {
        if (this.currentDir == null)
            return false;
        if (this.isStreamingAvailable) {
            this.zipAndDownloadFolders();
        } else {
            this.showToastError(this.translate("DRIVE.ZIP.ERROR"));
        }
    },
    reduceTotalSize(index, path, files, accumTotalSize, stats, future) {
        let that = this;
        if (files.length == index) {
            var folderCount = 0;
            for(var i = 0; i < files.length; i++) {
                if (files[i].isDirectory()) {
                    folderCount = folderCount + 1;
                }
            }
            this.confirmZipAndDownloadOfFolders(folderCount, stats,
                () => {
                    that.showConfirm = false;
                    future.complete(true);
                },
                () => {
                    that.showConfirm = false;
                    future.complete(false);
                }
            );
        } else {
            let file = files[index];
            this.calculateTotalSize(file, path).thenApply(statistics => {
                let updatedAccumTotalSize = statistics.actualSize + accumTotalSize;
                stats.push(statistics);
                if (file.isDirectory() && statistics.fileCount == 0) {
                    that.$toast(this.translate("DRIVE.EMPTY.FOLDER").replace("$NAME", file.getName()));
                    future.complete(false);
                } else {
                    that.reduceTotalSize(index + 1, path, files, updatedAccumTotalSize, stats, future);
                }
            });
        }
    },
    reduceCollectFilesToZip(index, path, files, accumulatorList, futureCollectFiles) {
        let that = this;
        if (files.length == index) {
            futureCollectFiles.complete(true);
        } else {
            let file = files[index];
            let accumulator = {directoryMap: new Map(), files: []};
            if (file.isDirectory()) {
                let future = peergos.shared.util.Futures.incomplete();
                that.collectFilesToZip(path, file, path + file.getFileProperties().name, accumulator, future);
                future.thenApply(allFiles => {
                    for(var i = 0; i < allFiles.files.length; i++) {
                        accumulatorList.push(allFiles.files[i]);
                    }
                    that.reduceCollectFilesToZip(index +1, path, files, accumulatorList, futureCollectFiles);
                }).exceptionally(function (throwable) {
                    that.$toast.error(throwable.getMessage())
                    futureCollectFiles.complete(false);
                })
            } else {
                accumulatorList.push({path: '', file: file});
                that.reduceCollectFilesToZip(index +1, path, files, accumulatorList, futureCollectFiles);
            }
        }
    },
    confirmZipAndDownloadOfFolders(numberOfFoldersSelected, statisticsList, continueFunction, cancelFunction) {
        var folderCount = numberOfFoldersSelected;
        var fileCount = 0;
        var actualSize = 0;
        for(var i = 0; i < statisticsList.length; i++) {
            folderCount = folderCount + statisticsList[i].folderCount;
            fileCount = fileCount + statisticsList[i].fileCount;
            actualSize = actualSize + statisticsList[i].actualSize;
        }
        this.confirm_message=this.translate("DRIVE.CONFIRM.DOWNLOAD.TITLE");
        this.confirm_body=this.translate("DRIVE.CONFIRM.DOWNLOAD.BODY")
            .replace("$FOLDERS", folderCount)
            .replace("$FILES", fileCount)
            .replace("$SIZE", helpers.convertBytesToHumanReadable(actualSize));
        this.confirm_consumer_cancel_func = cancelFunction;
        this.confirm_consumer_func = continueFunction;
        this.showConfirm = true;
    },
    zipAndDownloadFolders() {
        this.showSpinner = true;
        let that = this;
        let futureTotalSize = peergos.shared.util.Futures.incomplete();
        let files = this.selectedFiles.slice();
        let path = this.getPath;
        let statisticsList = [];
        that.reduceTotalSize(0, path, files, 0, statisticsList, futureTotalSize);
        futureTotalSize.thenApply(res => {
            that.showSpinner = false;
            if (res) {
                if (that.isLocalhostAndroid()) {
                    console.log("reflecting zip files");
                    that.reflectZipFiles(files);
                    return;
                }
                that.showSpinner = true;
                var actualSize = 0;
                for(var i = 0; i < statisticsList.length; i++) {
                    actualSize = actualSize + statisticsList[i].actualSize;
                }
                let progress = {
                    show: true,
                    title: that.translate("DRIVE.DOWNLOAD.FOLDERS"),
                    done: 0,
                    max: actualSize
                }
                let zipFilename = 'archive-' + that.zipAndDownloadFoldersCount + '.zip';
                that.zipAndDownloadFoldersCount = that.zipAndDownloadFoldersCount + 1;
                let accumulator = {directoryMap: new Map(), files: []};
                let future = peergos.shared.util.Futures.incomplete();
                let allFilesList = [];
                that.$toast({component: ProgressBar,props: progress}, { icon: false , timeout:false, id: zipFilename});
                that.reduceCollectFilesToZip(0, path, files, allFilesList, future);
                future.thenApply(res => {
                    that.showSpinner = false;
                    if (res) {
                        that.zipFiles(zipFilename, allFilesList, progress).thenApply(res2 => {
                            console.log('zip complete');
                            that.selectedFiles = [];
                        }).exceptionally(function (throwable) {
                            that.$toast.error(throwable.getMessage())
                        });
                    }
                });
            }
        });
    },
	zipAndDownload() {
        if (this.isStreamingAvailable) {
            this.zipAndDownloadFolder();
        } else {
            this.showToastError(this.translate("DRIVE.ZIP.ERROR"));
        }
    },
	zipAndDownloadFolder() {
            if (this.selectedFiles.length != 1)
                return;
            this.closeMenu();
            let file = this.selectedFiles[0];
			this.showSpinner = true;
			let that = this;
            this.calculateTotalSize(file, this.getPath).thenApply(statistics => {
                that.showSpinner = false;
                if (statistics.fileCount == 0) {
                    that.$toast(that.translate("DRIVE.EMPTY.FOLDER").replace("$NAME", file.getName()));
                } else {
                    let filename = file.getName();
                    that.confirmZipAndDownloadOfFolder(filename, statistics,
                        () => {
                            that.showConfirm = false;
                            if (that.isLocalhostAndroid()) {
                                console.log("reflecting zip files");
                                that.reflectZipFiles([file]);
                                return;
                            }
                            var progress = {
                                show: true,
                                title: that.translate("DRIVE.DOWNLOAD.FOLDER").replace("$NAME", filename),
                                done: 0,
                                max: statistics.actualSize
                            }
                            let zipFilename = filename + '.zip';
                            let accumulator = {directoryMap: new Map(), files: []};
                            let future = peergos.shared.util.Futures.incomplete();

                            that.collectFilesToZip(that.getPath, file,
                                that.getPath + file.getFileProperties().name, accumulator, future);
                            future.thenApply(allFiles => {
                                that.$toast({component: ProgressBar,props: progress}
                                    , { icon: false , timeout:false, id: zipFilename});
                                that.zipFiles(zipFilename, allFiles.files, progress).thenApply(res => {
                                    console.log('folder download complete');
                                }).exceptionally(function (throwable) {
                                    that.$toast.error(throwable.getMessage())
                                });
                            }).exceptionally(function (throwable) {
                                that.$toast.error(throwable.getMessage())
                            })
                        },
                        () => {
                            that.showConfirm = false;
                        }
                    );
                }
            }).exceptionally(function (throwable) {
                that.$toast.error(throwable.getMessage())
            });
		},
        confirmZipAndDownloadOfFolder(folderName, statistics, continueFunction, cancelFunction) {
            this.confirm_message=this.translate("DRIVE.CONFIRM.DOWNLOAD.FOLDER.TITLE").replace("$NAME", folderName);
            this.confirm_body=this.translate("DRIVE.CONFIRM.DOWNLOAD.BODY")
                .replace("$FOLDERS", statistics.folderCount)
                .replace("$FILES", statistics.fileCount)
                .replace("$SIZE", helpers.convertBytesToHumanReadable(statistics.actualSize));
            this.confirm_consumer_cancel_func = cancelFunction;
            this.confirm_consumer_func = continueFunction;
            this.showConfirm = true;
        },
		collectFilesToZip(prefix, file, path, accumulator, future) {
			let that = this;
			file.getChildren(this.context.crypto.hasher, this.context.network).thenApply(function (children) {
				let arr = children.toArray();
				for (var i = 0; i < arr.length; i++) {
					let child = arr[i];
					let childProps = child.getFileProperties();
					if (childProps.isDirectory) {
						let newPath = path + "/" + childProps.name;
						accumulator.directoryMap.set(newPath, '');
						that.collectFilesToZip(prefix, child, newPath, accumulator, future);
					} else {
					    let relativePath = path.substring(prefix.length);
						accumulator.files.push({path: relativePath, file: child});
					}
				}
				accumulator.directoryMap.delete(path)
				if (accumulator.directoryMap.size == 0) {
					future.complete(accumulator);
				}
			});
		},
		dndDrop(evt) {
			evt.preventDefault();
			let entries = evt.dataTransfer.items;
			let allItems = [];
			for (i = 0; i < entries.length; i++) {
				let entry = entries[i].webkitGetAsEntry();
				if (entry != null) {
					allItems.push(entry);
				}
			}
			let allFiles = [];
			if (allItems.length > 0) {
				this.getEntries(allItems, 0, this, allFiles);
			}
		},
		getEntries(items, itemIndex, that, allFiles) {
			if (itemIndex < items.length) {
				let item = items[itemIndex];
				if (item.isDirectory) {
					let reader = item.createReader();
					let doBatch = function () {
						reader.readEntries(function (entries) {
							if (entries.length > 0) {
								for (i = 0; i < entries.length; i++) {
									items.push(entries[i]);
								}
								doBatch();
							} else {
								that.getEntries(items, ++itemIndex, that, allFiles);
							}
						});
					};
					doBatch();
				} else {
                    item.file(function (fileEntry) {
                        if (fileEntry.name != '.DS_Store') {
                            fileEntry.directory = that.extractDirectory(item);
                            allFiles.push(fileEntry);
                        }
                        that.getEntries(items, ++itemIndex, that, allFiles);
                    });
				}
			} else {
				this.processFileUpload(allFiles);
			}
		},
        extractDirectory(file) {
            var path = null;
            if (file.fullPath != null) {
                path = file.fullPath.substring(0, file.fullPath.lastIndexOf('/'));
            }else if (file.webkitRelativePath == null) {
                path = '';
            } else {
                path = file.webkitRelativePath.substring(0, file.webkitRelativePath.lastIndexOf('/'));
            }
            if (path.length == 0) {
                return path;
            }
            return path.startsWith('/') ? path : '/' + path;
        },
        uploadFiles(evt) {
            var files = evt.target.files || evt.dataTransfer.files;
            let that = this;
            let accumulatedFiles = [];
            for(var i = 0; i < files.length; i++) {
                let fileEntry = files[i];
                if (fileEntry.name != '.DS_Store') {
                    fileEntry.directory = that.extractDirectory(fileEntry);
                    accumulatedFiles.push(fileEntry);
                }
            }
            this.processFileUpload(accumulatedFiles);
        },
        sortFilesByDirectory(files, directoryPath) {
            let that = this;
            let uploadPaths = [];
            let uploadFileLists = [];
            for(var j = 0; j < files.length; j++) {
                var foundDirectoryIndex = -1;
                let file = files[j];
                let uploadDirectoryPath = file.directory.length == 0 ? directoryPath
                    : directoryPath.substring(0, directoryPath.length -1) + file.directory;
                for(var i = 0 ; i < uploadPaths.length; i++) {
                    if (uploadDirectoryPath == uploadPaths[i]) {
                        foundDirectoryIndex = i;
                        break;
                    }
                }
                if (foundDirectoryIndex == -1) {
                    uploadPaths.push(uploadDirectoryPath);
                    uploadFileLists.push([]);
                    foundDirectoryIndex = uploadPaths.length -1;
                }
                let fileUploadList = uploadFileLists[foundDirectoryIndex];
                fileUploadList.push(file);
            }
            let combinedSortedFileList = [];
            for(var i = 0 ; i < uploadPaths.length; i++) {
                uploadFileLists[i].sort(function(a, b){return a.size-b.size});
                combinedSortedFileList = combinedSortedFileList.concat(uploadFileLists[i]);
            }
            return combinedSortedFileList;
        },
        uuid() {
          return '-' + ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
            (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
          );
        },
	processFileUpload(files, retrying) {
            let that = this;
            if (this.isSecretLink && !this.currentDir.isWritable()) {
                return;
            }
            if (this.quotaBytes.toString() == '0' && !this.isSecretLink) {
                if (retrying == null) {
                    this.updateQuota(quotaBytes => {
                        if (quotaBytes != null) {
                            that.updateUsage(usageBytes => {
                                that.processFileUpload(files, true);
                            });
                        } else {
                            that.processFileUpload(files, true);
                        }
                    });
                } else {
                    this.$toast.error(this.translate("DRIVE.OFFLINE"), {timeout:false, id: 'upload'})
                }
            } else {
                let isWritableSecretLink = this.isSecretLink && this.currentDir.isWritable();
                let totalSize = 0;
                for(var i=0; i < files.length; i++) {
                    totalSize += (files[i].size + (4096 - (files[i].size % 4096)));
                }
                if (!isWritableSecretLink && Number(that.quotaBytes.toString()) < totalSize) {
                    let errMsg = "File upload operation exceeds total space\n" + "Please upgrade to get more space";
                    that.$toast.error(errMsg, {timeout:false, id: 'upload'})
                } else {
                    let spaceAfterOperation = that.checkAvailableSpace(totalSize);
                    if (!isWritableSecretLink && spaceAfterOperation < 0) {
                        let errMsg = this.translate("DRIVE.UPLOAD.SPACE.ERROR").replace("$SPACE",  helpers.convertBytesToHumanReadable('' + -spaceAfterOperation));
                        that.$toast.error(errMsg, {timeout:false, id: 'upload'})
                    } else {
                        //resetting .value tricks browser into allowing subsequent upload of same file(s)
                        document.getElementById('uploadFileInput').value = "";
                        document.getElementById('uploadDirectoriesInput').value = "";
                        let name = 'bulkUpload-' + this.uuid();
                        let title = this.translate("DRIVE.UPLOAD.TITLE");
                        let sortedFiles = this.sortFilesByDirectory(files, this.getPath);
                        let progress = {
                            title: title,
                            done:0,
                            max:totalSize * 2,
                            name:name,
                            current: 0,
                            total: files.length,
                        };
                        that.$toast(
                            {component: ProgressBar,props:  progress} ,
                            { icon: false , timeout:false, id: name})
                        let uploadDirectoryPath = that.getPath;
                        const uploadParams = {
                            applyReplaceToAll: false,
                            replaceFile: false,
                            directoryPath: uploadDirectoryPath,
                            uploadPaths: [],
                            fileUploadProperties: [],
                            triggerRefresh: false,
                            progress: progress,
                            name: name,
                            title: title
                        }
                        let prepareFuture = peergos.shared.util.Futures.incomplete();
                        let previousDirectoryHolder = {
                            fileWrapper: null,
                            path: ''
                        };
                        that.reduceAllUploads(0, sortedFiles, prepareFuture, uploadParams, previousDirectoryHolder);
                        prepareFuture.thenApply(preparationDone => {
                            that.bulkUpload(uploadParams).thenApply(res => {
                                console.log("upload complete");
                            });
                        });
                    }
                }
            }
        },
        bulkUpload: function(uploadParams) {
            let that = this;
            let uploadFuture = peergos.shared.util.Futures.incomplete();
            if (uploadParams.uploadPaths.length == 0) {
                uploadFuture.complete(true);
            } else {
                let folderUPList = [];
                for(var i = 0 ; i <  uploadParams.uploadPaths.length; i++) {
                    let relativePath = uploadParams.uploadPaths[i].substring(uploadParams.directoryPath.length);
                    let pathList = peergos.client.JsUtil.asList(relativePath.split('/').filter(n => n.length > 0));
                    let filePropsList = peergos.client.JsUtil.asList(uploadParams.fileUploadProperties[i]);
                    let folderUP = new peergos.shared.user.fs.FileWrapper.FolderUploadProperties(pathList, filePropsList);
                    folderUPList.push(folderUP);
                }
                let commitContext = {
                    completed: false
                }
                var commitWatcher = {
                    get_0: function() {
                        if (uploadParams.triggerRefresh) {
                            uploadParams.triggerRefresh = false;
                            if (!that.isSecretLink) {
                                that.context.getSpaceUsage(false).thenApply(u => {
                                    that.$store.commit('SET_USAGE', u);
                                });
                            }
                            that.updateCurrentDirectory();
                        }
                        if (!commitContext.completed && uploadParams.progress.current >= uploadParams.progress.total) {
                            commitContext.completed = true;
                            let title = that.translate("DRIVE.UPLOAD.COMPLETE");
                            that.addUploadProgressMessage(uploadParams, title, '', '', true);
                        }
                        return true;
                    }
                };

                let folderStream = peergos.client.JsUtil.asList(folderUPList).stream();
                let resumeFileUpload = function(f) {
                    let future = peergos.shared.util.Futures.incomplete();
                    let path = f.getPath();
                    let lastSlashIdx = path.lastIndexOf('/');
                    let filename = path.substring(lastSlashIdx + 1);
                    let folderPath = path.substring(0, lastSlashIdx);
                    that.confirmResumeFileUpload(filename, folderPath,
                        () => {
                            that.showConfirm = false;
                            future.complete(true);
                        },
                        () => {
                            that.showConfirm = false;
                            future.complete(false);
                        }
                    );
                    return future;
                }
                this.context.getByPath(uploadParams.directoryPath).thenApply(uploadDir => {
                    uploadDir.ref.uploadSubtree(folderStream, that.getMirrorBatId(uploadDir.ref), that.context.network,
                        that.context.crypto, that.context.getTransactionService(),
                        f => resumeFileUpload(f),
                        commitWatcher).thenApply(res => {
                            uploadFuture.complete(true);
                    }).exceptionally(function (throwable) {
                        that.errorTitle = that.translate("DRIVE.UPLOAD.ERROR");
                        that.errorBody = throwable.getMessage();
                        that.showError = true;
                        that.$toast.clear();
                    });
                });
            }
            return uploadFuture;
        },
        confirmMove() {
            var future = peergos.shared.util.Futures.incomplete();;
            this.confirm_message=this.translate("DRIVE.MOVE.ACCESS.TITLE");
            this.confirm_body=this.translate("DRIVE.MOVE.ACCESS.BODY");
            this.confirm_consumer_cancel_func = () => {
               future.complete(false);
            };
            this.confirm_consumer_func = () => {
                future.complete(true);
            };
            this.showConfirm = true;
            return future;
        },
        confirmResumeFileUpload(filename, folderPath, confirmFunction, cancelFunction) {
            this.confirm_message=this.translate("DRIVE.UPLOAD.RESUME.TITLE");
            this.confirm_body=this.translate("DRIVE.UPLOAD.RESUME.BODY")
                .replace("$NAME", filename)
                .replace("$PATH", folderPath);
            this.confirm_consumer_cancel_func = cancelFunction;
            this.confirm_consumer_func = confirmFunction;
            this.showConfirm = true;
        },
        reduceAllUploads: function(index, files, future, uploadParams, previousDirectoryHolder) {
            let that = this;
            if (index == files.length) {
                if (uploadParams.progress.total == 0) {
                    that.addUploadProgressMessage(uploadParams, that.translate("DRIVE.UPLOAD.EMPTY"), '', '', true);
                }
                future.complete(true);
            } else {
                this.uploadFile(files[index], uploadParams, previousDirectoryHolder).thenApply(result => {
                    that.reduceAllUploads(index+1, files, future, uploadParams, previousDirectoryHolder);
                });
            }
        },
        getUploadDirectory(previousDirectoryHolder, directoryPath, file) {
            let future = peergos.shared.util.Futures.incomplete();
            let uploadDirectoryPath = file.directory.length == 0 ? directoryPath
                : directoryPath + file.directory.substring(1);
            if (previousDirectoryHolder.path == uploadDirectoryPath) {
                    future.complete(previousDirectoryHolder.fileWrapper);
            } else {
                this.context.getByPath(uploadDirectoryPath).thenApply(function (optDir) {
                    previousDirectoryHolder.path = uploadDirectoryPath;
                    previousDirectoryHolder.fileWrapper = optDir.ref;
                    future.complete(optDir.ref);
                });
            }
            return future;
        },
        uploadFile: function(file, uploadParams, previousDirectoryHolder) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            this.getUploadDirectory(previousDirectoryHolder, uploadParams.directoryPath, file).thenApply(function (updatedDir) {
                if (updatedDir == null) {
                    that.uploadFileJS(file, false, future, uploadParams);
                } else {
                    updatedDir.hasChild(file.name, that.context.crypto.hasher, that.context.network).thenApply(function (alreadyExists) {
                        if (alreadyExists) {
                            if (uploadParams.applyReplaceToAll) {
                                if (uploadParams.replaceFile) {
                                    that.uploadFileJS(file, true, future, uploadParams)
                                } else {
                                    uploadParams.progress.total = uploadParams.progress.total - 1;
                                    uploadParams.progress.max = uploadParams.progress.max - (file.size * 2);
                                    future.complete(true);
                                }
                            } else {
                                that.confirmReplaceFile(file,
                                    (applyToAll) => {
                                        uploadParams.applyReplaceToAll = applyToAll;
                                        uploadParams.replaceFile = false;
                                        uploadParams.progress.total = uploadParams.progress.total - 1;
                                        uploadParams.progress.max = uploadParams.progress.max - (file.size * 2);
                                        future.complete(true);
                                    },
                                    (applyToAll) => {
                                        uploadParams.applyReplaceToAll = applyToAll;
                                        uploadParams.replaceFile = true;
                                        that.uploadFileJS(file, true, future, uploadParams)
                                    }
                                );
                            }
                        } else {
                            that.uploadFileJS(file, false, future, uploadParams);
                        }
                    });
                }
            });
            return future;
        },
		confirmReplaceFile(file, cancelFn, replaceFn) {
			this.showSpinner = false;
		    this.replace_message = this.translate("DRIVE.UPLOAD.EXISTS")
                        .replace("$NAME", file.name);
			this.replace_body = this.translate("DRIVE.UPLOAD.REPLACE");
			this.replace_consumer_cancel_func = cancelFn;
			this.replace_consumer_func = replaceFn;
			this.replace_showApplyAll = true;
			this.showReplace = true;
		},
		formatTitle(text) {
            let width = 32;
            return text.length > width ? text.substring(0, width-3) + '... ' : text;
		},
		uploadFileJS(file, overwriteExisting, future, uploadParams) {
            let that = this;
            let updater = {
                done:0,
                max:file.size * 2,
                finished:false,
                lastUpdate: false
            };
            let thumbnailOffset = 20 * 1024;
            let updateProgressBar = function(len){
                let firstUpdate = updater.done == 0;
                updater.done += (len.value_0 * 2);
                uploadParams.progress.done += (len.value_0 * 2);
                if (!updater.finished && updater.done >= (updater.max + thumbnailOffset)) {
                    updater.finished = true;
                    uploadParams.progress.current  = uploadParams.progress.current + 1;
                    uploadParams.triggerRefresh = true;
                }
                let encryptingMsg = that.translate("DRIVE.UPLOAD.TITLE.ENCRYPTING");
                let uploadingMsg = that.translate("DRIVE.UPLOAD.TITLE.UPLOADING");
                var process = updater.done > (updater.max /2) ? uploadingMsg : encryptingMsg;
                let title = '[' + uploadParams.progress.current + '/' + uploadParams.progress.total + '] ' + process;
                if (!firstUpdate && !updater.lastUpdate) {
                    if (updater.finished) {
                        updater.lastUpdate = true;
                    }
                    that.addUploadProgressMessage(uploadParams, title, that.formatTitle(file.name), file.directory, false);
                }
            };
            var foundDirectoryIndex = -1;
            let uploadDirectoryPath = file.directory.length == 0 ? uploadParams.directoryPath
                : uploadParams.directoryPath.substring(0, uploadParams.directoryPath.length -1) + file.directory;
            for(var i = 0 ; i < uploadParams.uploadPaths.length; i++) {
                if (uploadDirectoryPath == uploadParams.uploadPaths[i]) {
                    foundDirectoryIndex = i;
                    break;
                }
            }
            if (foundDirectoryIndex == -1) {
                uploadParams.uploadPaths.push(uploadDirectoryPath);
                uploadParams.fileUploadProperties.push([]);
                foundDirectoryIndex = uploadParams.uploadPaths.length -1;
            }
            let reader = new browserio.JSFileReader(file);
            let java_reader = new peergos.shared.user.fs.BrowserFileReader(reader);
            let jsModifiedDate = new Date(file.lastModified);
            let utcJsModifiedDate = Date.UTC(jsModifiedDate.getUTCFullYear(), jsModifiedDate.getUTCMonth(),
                            jsModifiedDate.getUTCDate(), jsModifiedDate.getUTCHours(),
                            jsModifiedDate.getUTCMinutes(), jsModifiedDate.getUTCSeconds(), jsModifiedDate.getMilliseconds());
            let fileModifiedDateTime = peergos.client.JsUtil.fromUtcMillis(utcJsModifiedDate);
            peergos.shared.user.fs.HashTree.build(java_reader, (file.size - (file.size % Math.pow(2, 32))) / Math.pow(2, 32),
            file.size, this.context.crypto.hasher).thenCompose(function(hashtree) {
                return java_reader.reset().thenApply(function(resetReader) {
                    let fup = new peergos.shared.user.fs.FileWrapper.FileUploadProperties(file.name, {get_0: () => resetReader},
                        (file.size - (file.size % Math.pow(2, 32))) / Math.pow(2, 32), file.size, java.util.Optional.of(fileModifiedDateTime), java.util.Optional.of(hashtree), false,
                        overwriteExisting ? true : false, updateProgressBar);

                    let fileUploadList = uploadParams.fileUploadProperties[foundDirectoryIndex];
                    fileUploadList.push(fup);
                    future.complete(true);
                });
            }).exceptionally(function(t){future.completeExceptionally(t)})
		},
        addUploadProgressMessage: function(uploadParams, title, subtitle, directory, finalCall) {
            let that = this;
            function update(message, conversationId) {
                let future = peergos.shared.util.Futures.incomplete();
                setTimeout( () => {
                    that.$toast.update(uploadParams.name,
                    {content:
                        {
                            component: ProgressBar,
                            props:  {
                            title: title,
                            subtitle: subtitle,
                            done: uploadParams.progress.done,
                            max: uploadParams.progress.max
                            },
                        }
                    });
                    future.complete(true);
                }, that.progressBarUpdateFrequency);
                return future;
            }
            let command = {
                func: () => update(),
                path: title + '-' + directory + '-' + subtitle,
            };
            this.drainProgressBarQueue(uploadParams, command, finalCall, false);
        },
        reduceProgressBarUpdates: function(uploadParams, future, finalCall) {
            let that = this;
            let queueCopy = this.uploadProgressQueue.entries.slice();
            let command = queueCopy.shift();
            if (command == null) {
                if (finalCall) {
                    setTimeout(() => that.$toast.dismiss(uploadParams.progress.name), 1000);
                }
                future.complete(true);
            } else {
                try {
                    let newQueue = [];
                    for(var i=0;i < queueCopy.length; i++) {
                        let entry = queueCopy[i];
                        if (command.path == entry.path) {
                            command = entry;
                        } else {
                            newQueue.push(entry);
                        }
                    }
                    this.uploadProgressQueue.entries = newQueue;
                    command.func().thenApply(function(res){
                        that.reduceProgressBarUpdates(uploadParams, future, finalCall);
                    });
                } catch(ex) {
                    future.complete(true);
                }
            }
            return future;
        },
        drainProgressBarQueue: function(uploadParams, newCommand, finalCall, repeated) {
            if (!repeated) {
                this.uploadProgressQueue.entries.push(newCommand);
            }
            let that = this;
            if (!that.executingUploadProgressCommands) {
                that.executingUploadProgressCommands = true;
                let future = peergos.shared.util.Futures.incomplete();
                that.reduceProgressBarUpdates(uploadParams, future, finalCall);
                future.thenApply(res => {
                    that.executingUploadProgressCommands = false;
                });
            } else {
                if (finalCall) {
                    setTimeout(() => that.drainProgressBarQueue(uploadParams, newCommand, finalCall, true), 1000);
                }
            }
        },
		toggleFeedbackForm() {
			this.showFeedbackForm = !this.showFeedbackForm;
			// this.clearTabNavigation();
		},

		popConversation(msgId) {
			if (msgId != null) {
				for (var i = 0; i < this.conversationMonitors.length; i++) {
					let currentMessage = this.conversationMonitors[i];
					if (currentMessage.id == msgId) {
						this.conversationMonitors.splice(i, 1);
						break;
					}
				}
			}
		},

		getMessage(msgId) {
			if (msgId != null) {
				//linear scan
				for (var i = 0; i < this.messageMonitors.length; i++) {
					let currentMessage = this.messageMonitors[i];
					if (currentMessage.id == msgId) {
						return this.messageMonitors[i];
					}
				}
			}
			return null;
		},

		copyMultiSelect() {
			if (this.selectedFiles.length < 1)
				return;
			let files = this.selectedFiles.slice();
			this.clipboardMultiSelect = {
				fileTreeNodes: files,
				op: "copy",
				path: this.getPath
			};
		},

		cutMultiSelect() {
			if (this.selectedFiles.length < 1)
				return;
			let files = this.selectedFiles.slice();
			this.clipboardMultiSelect = {
				parent: this.currentDir,
				fileTreeNodes: files,
				op: "cut",
				path: this.getPath
			};
		},

        copy() {
            if (this.selectedFiles.length != 1)
                return;
            var file = this.selectedFiles[0];
            this.clipboard = {
                fileTreeNode: file,
                op: "copy",
                path: this.getPath
            };
            this.closeMenu();
        },

        cut() {
            if (this.selectedFiles.length != 1)
                return;
            var file = this.selectedFiles[0];

            this.clipboard = {
                parent: this.currentDir,
                fileTreeNode: file,
                op: "cut",
                path: this.getPath
            };
            this.closeMenu();
        },

        reduceMove(index, path, parent, target, fileTreeNodes, multiSelectParams, future) {
            let that = this;
            if (index == fileTreeNodes.length) {
                let title = that.translate("DRIVE.MOVING.COMPLETE");
                that.addUploadProgressMessage(multiSelectParams, title, '', '', true);
                future.complete(true);
            } else {
                let fileTreeNode = fileTreeNodes[index];
                let name = fileTreeNode.getFileProperties().name;
                let filePath = peergos.client.PathUtils.toPath(path, name);
                target.getLatest(this.context.network).thenApply(updatedTarget => {
                    parent.getLatest(that.context.network).thenApply(updatedParent => {
                        fileTreeNode.getLatest(that.context.network)
                        .thenCompose(updatedFile => updatedFile.moveTo(updatedTarget, updatedParent, filePath, that.context, {get_0:() => that.confirmMove()})).thenApply(() => {
                            multiSelectParams.progress.done += 1;
                            let title = '[' + multiSelectParams.progress.done + '/' + multiSelectParams.progress.max + '] '
                                + multiSelectParams.title;
                            that.addUploadProgressMessage(multiSelectParams, title, '', '', false);
                            that.updateCurrentDirectory(null , () => {
                                that.showSpinner = true;
                                that.reduceMove(index + 1, path, updatedParent, updatedTarget, fileTreeNodes, multiSelectParams, future);
                            });
                        }).exceptionally(function (throwable) {
                            that.updateCurrentDirectory(null , () => {
                                that.errorTitle = that.translate("DRIVE.MOVE.ERROR").replace("$NAME", name);
                                that.errorBody = throwable.getMessage();
                                that.showError = true;
                                future.complete(false);
                            });
                        });
                    });
                });
            }
        },
        reduceCopy(index, fileTreeNodes, target, multiSelectParams, future) {
            let that = this;
            if (index == fileTreeNodes.length) {
                let title = that.translate("DRIVE.COPYING.COMPLETE");
                that.addUploadProgressMessage(multiSelectParams, title, '', '', true);
                future.complete(true);
            } else {
                let fileTreeNode = fileTreeNodes[index];
                target.getLatest(this.context.network).thenApply(updatedTarget => {
                    fileTreeNode.copyTo(updatedTarget, that.context).thenApply(function () {
                        multiSelectParams.progress.done += 1;
                        let title = '[' + multiSelectParams.progress.done + '/' + multiSelectParams.progress.max + '] '
                            + multiSelectParams.title;
                        that.addUploadProgressMessage(multiSelectParams, title, '', '', false);
                        that.updateUsage(usageBytes => {
                            that.updateCurrentDirectory(null , () => {
                                that.showSpinner = true;
                                that.reduceCopy(index + 1, fileTreeNodes, updatedTarget, multiSelectParams, future)
                            });
                        });
                    }).exceptionally(function (throwable) {
                        that.updateCurrentDirectory(null , () => {
                            that.errorTitle = that.translate("DRIVE.COPY.ERROR").replace("$NAME", fileTreeNode.getFileProperties().name);
                            that.errorBody = throwable.getMessage();
                            that.showError = true;
                            future.complete(false);
                        });
                    });
                });
            }
        },
        reduceSizeCalculation(index, path, fileTreeNodes, accumApparentSize, sizeFuture) {
            let that = this;
            if (index == fileTreeNodes.length) {
                sizeFuture.complete(true);
            } else {
                let fileTreeNode = fileTreeNodes[index];
                this.calculateTotalSize(fileTreeNode, path).thenApply(statistics => {
                    let updatedAccumApparentSize = accumApparentSize + statistics.apparentSize;
                    if (Number(that.quotaBytes.toString()) < updatedAccumApparentSize) {
                        let errMsg = that.translate("DRIVE.COPY.TOTAL.SPACE.ERROR");
                        that.$toast.error(errMsg, {timeout:false});
                        sizeFuture.complete(false);
                    } else {
                        let spaceAfterOperation = that.checkAvailableSpace(updatedAccumApparentSize);
                        if (spaceAfterOperation < 0) {
                            let errMsg = that.translate("DRIVE.COPY.SPACE.ERROR")
                                .replace("$SPACE", helpers.convertBytesToHumanReadable('' + -spaceAfterOperation));
                            that.$toast.error(errMsg, {timeout:false})
                            that.showSpinner = false;
                            sizeFuture.complete(false);
                        } else {
                            that.reduceSizeCalculation(index + 1, path, fileTreeNodes, updatedAccumApparentSize, sizeFuture);
                        }
                    }
                });
            }
        },
        isPasteToFolderAvailable() {
            if (this.currentDir == null)
                return false;

            if (typeof (this.clipboard) == undefined || this.clipboard == null || this.clipboard.op == null || typeof (this.clipboard.op) == "undefined")
                return false;

            if (this.selectedFiles.length > 1)
                return false;
            var target = this.selectedFiles.length == 1 ? this.selectedFiles[0] : this.currentDir;

            if (target == null) {
                return false;
            }

            if (this.clipboard.fileTreeNode != null && this.clipboard.fileTreeNode.samePointer(target)) {
                return false;
            }

            return target.isWritable() && target.isDirectory();
        },
        pasteToFolder(e) {
            var target = this.multiSelectTargetFolder;
            if (target == null) {
                this.paste(e);
            } else {
                this.pasteMultiSelect(e);
            }
        },
		pasteMultiSelect(e, retrying) {
			var target = this.multiSelectTargetFolder;
            if (target == null) {
                return;
            }
			var that = this;
			if (!target.isDirectory()) {
			    return;
            }
            let clipboard = this.clipboardMultiSelect;
            if (typeof (clipboard) == undefined || typeof (clipboard.op) == "undefined")
                return;
            for(var i=0; i < clipboard.fileTreeNodes.length; i++) {
                let fileTreeNode = clipboard.fileTreeNodes[i];
                if (fileTreeNode.samePointer(target)) {
                    that.$toast.error(that.translate("DRIVE.PASTE.LOCATION.SAME"), {timeout:false})
                    return;
                }
            }
            this.closePasteMenu();
            that.showSpinner = true;
            let name = 'multiselect-' + this.uuid();
            let title = clipboard.op == "cut" ?
                this.translate("DRIVE.MOVING.TITLE") : this.translate("DRIVE.COPYING.TITLE");
            let progress = {
                title: title,
                done:0,
                max:clipboard.fileTreeNodes.length,
                name:name,
            };
            that.$toast(
                {component: ProgressBar,props:  progress} ,
                { icon: false , timeout:false, id: name})
            const multiSelectParams = {
                progress: progress,
                name: name,
                title: title
            }
            if (clipboard.op == "cut") {
                let future = peergos.shared.util.Futures.incomplete();
                this.reduceMove(0, that.path, clipboard.parent, target, clipboard.fileTreeNodes, multiSelectParams, future);
                future.thenApply(res => {
                    if (res) {
                        that.showSpinner = false;
                        clipboard.op = null;
                        that.selectedFiles = [];
                    }
                });
            } else if (clipboard.op == "copy") {
                if (this.quotaBytes.toString() == '0') {
                    if (retrying == null) {
                        this.updateQuota(quotaBytes => {
                            if (quotaBytes != null) {
                                that.updateUsage(usageBytes => {
                                    that.pasteMultiSelect(e, true);
                                });
                            } else {
                                that.pasteMultiSelect(e, true);
                            }
                        });
                    } else {
                        this.$toast.error(this.translate("DRIVE.OFFLINE"), {timeout:false});
                        this.showSpinner = false;
                    }
                } else {
                    let sizeFuture = peergos.shared.util.Futures.incomplete();
                    this.reduceSizeCalculation(0, clipboard.path, clipboard.fileTreeNodes, 0, sizeFuture);
                    sizeFuture.thenApply(res => {
                        if (res) {
                            let copyFuture = peergos.shared.util.Futures.incomplete();
                            that.reduceCopy(0, clipboard.fileTreeNodes, target, multiSelectParams, copyFuture);
                            copyFuture.thenApply(res2 => {
                                if (res2) {
                                    that.showSpinner = false;
                                    clipboard.op = null;
                                    that.selectedFiles = [];
                                }
                            });
                        }
                    });
                }
            }
		},
		paste(e, retrying) {
			if (this.selectedFiles.length > 1)
				return;
			var target = this.selectedFiles.length == 1 ? this.selectedFiles[0] : this.currentDir;
			var that = this;
			this.closeMenu();
			if (target.isDirectory()) {
				let clipboard = this.clipboard;
				if (typeof (clipboard) == undefined || typeof (clipboard.op) == "undefined")
					return;

				if (clipboard.fileTreeNode.samePointer(target)) {
					return;
				}
				that.showSpinner = true;


				if (clipboard.op == "cut") {
					let name = clipboard.fileTreeNode.getFileProperties().name;
					console.log("paste-cut " + name + " -> " + target.getFileProperties().name);
					let filePath = peergos.client.PathUtils.toPath(clipboard.path.split("/").filter(x => x.length > 0), name);
                                        target.getLatest(this.context.network).thenApply(updatedTarget => {
                                            clipboard.parent.getLatest(that.context.network).thenApply(updatedParent => {
                                            clipboard.fileTreeNode.getLatest(that.context.network)
                                            .thenCompose(updatedFile => updatedFile.moveTo(updatedTarget, updatedParent, filePath, that.context, {get_0:() => that.confirmMove()})
						.thenApply(function () {
							that.currentDirChanged();
							that.onUpdateCompletion.push(function () {
								that.showSpinner = false;
							});
						}).exceptionally(function (throwable) {
							that.errorTitle = that.translate("DRIVE.MOVE.ERROR").replace("$NAME", name);
							that.errorBody = throwable.getMessage();
							that.showError = true;
							that.showSpinner = false;
						}));
                                            });
                                        });
                        this.clipboard.op = null;
				} else if (clipboard.op == "copy") {
					console.log("paste-copy");
                    if (this.quotaBytes.toString() == '0') {
                        if (retrying == null) {
                            this.updateQuota(quotaBytes => {
                                if (quotaBytes != null) {
                                    that.updateUsage(usageBytes => {
                                        that.paste(e, true);
                                    });
                                } else {
                                    that.paste(e, true);
                                }
                            });
                        } else {
                            this.$toast.error(this.translate("DRIVE.OFFLINE"), {timeout:false});
                            this.showSpinner = false;
                        }
                    } else {
                        this.calculateTotalSize(clipboard.fileTreeNode, clipboard.path).thenApply(statistics => {
                            if (Number(that.quotaBytes.toString()) < statistics.apparentSize) {
                                let errMsg = that.translate("DRIVE.COPY.TOTAL.SPACE.ERROR");
                                that.$toast.error(errMsg, {timeout:false, id: 'upload'})
                            } else {
                                let spaceAfterOperation = that.checkAvailableSpace(statistics.apparentSize);
                                if (spaceAfterOperation < 0) {
                                    let errMsg = that.translate("DRIVE.COPY.SPACE.ERROR")
                                        .replace("$SPACE", helpers.convertBytesToHumanReadable('' + -spaceAfterOperation));
                                    that.$toast.error(errMsg, {timeout:false, id: 'upload'})
                                    that.showSpinner = false;
                                    return;
                                }
                                clipboard.fileTreeNode.copyTo(target, that.context)
                                    .thenApply(function () {
                                        that.currentDirChanged();
                                        that.onUpdateCompletion.push(function () {
                                            that.updateUsage();
                                            that.showSpinner = false;
                                        });
                                    }).exceptionally(function (throwable) {
                                        that.errorTitle = that.translate("DRIVE.COPY.ERROR").replace("$NAME", clipboard.fileTreeNode.getName());
                                        that.errorBody = throwable.getMessage();
                                        that.showError = true;
                                        that.showSpinner = false;
                                    });
                            }
                        });
                        this.clipboard.op = null;
                    }
				}
			}
		},
		calculateDirectorySize(file, path, accumulator, future) {
			let that = this;
			file.getChildren(this.context.crypto.hasher, this.context.network).thenApply(function (children) {
				let arr = children.toArray();
				for (var i = 0; i < arr.length; i++) {
					let child = arr[i];
					let childProps = child.getFileProperties();
					if (childProps.isDirectory) {
						accumulator.size += 4096;
						let newPath = path + "/" + childProps.name;
						accumulator.directoryMap.set(newPath, '');
						that.calculateDirectorySize(child, newPath, accumulator, future);
					} else {
						let size = that.getFileSize(childProps);
						accumulator.size += (size + (4096 - (size % 4096)));
					}
				}
				accumulator.directoryMap.remove(path);
				if (accumulator.directoryMap.size == 0) {
					future.complete(accumulator.size);
				}
			});
		},
		checkAvailableSpace(fileSize) {
		    if (this.currentDir.getOwnerName() != this.context.username) {
		        return 0;
		    }
			return Number(this.quotaBytes.toString()) - (Number(this.usageBytes.toString()) + fileSize);
		},
		addToLauncher() {
            if (this.selectedFiles.length != 1)
                return false;
            let file = this.selectedFiles[0];
            this.closeMenu();

            let postFix = file.isDirectory() ? '/' : '';
            let link = this.path.join('/') + '/' + file.getName() + postFix;
            this.refreshAndAddShortcutLink(link, new Date(file.getFileProperties().created.toString() + "+00:00"));
		},
		refreshAndAddShortcutLink(link, created) {
		    let that = this;
            this.showSpinner = true;
            this.loadShortcutsFile(this.launcherApp).thenApply(shortcutsMap => {
                if (shortcutsMap.get(link) == null) {
                    let entry = {added: new Date(), created: created};
                    shortcutsMap.set(link, entry)
                    that.updateShortcutsFile(that.launcherApp, shortcutsMap).thenApply(res => {
                        that.showSpinner = false;
                        that.$store.commit("SET_SHORTCUTS", shortcutsMap);
                    });
                } else {
                    that.showSpinner = false;
                }
            })
		},
		showShareWith() {
			if (this.selectedFiles.length == 0)
				return;
			if (this.selectedFiles.length != 1)
				return;
			this.closeMenu();
			var file = this.selectedFiles[0];
			var filename = file.getFileProperties().name;
			let latestFile = this.files.filter(f => f.getName() == filename)[0];
			this.filesToShare = [latestFile];
			this.pathToFile = this.path;
			let fileSharedWithState = this.sharedWithState.get(filename);
			let read_usernames = fileSharedWithState.readAccess.toArray([]);
			let edit_usernames = fileSharedWithState.writeAccess.toArray([]);
			this.sharedWithData = { read_shared_with_users: read_usernames, edit_shared_with_users: edit_usernames };
			this.fromApp = false;
			this.displayName = latestFile.getFileProperties().name;
			this.allowReadWriteSharing = true;
			this.allowCreateSecretLink = true;
			this.showShare = true;
		},
		closeShare() {
			this.showShare = false;
		},

		updateContext(newContext) {
			// this.context = newContext;
			this.$store.commit('SET_CONTEXT', newContext);

		},

		changePath(path) {
			if (path == "/" && this.path.length == 0) {
				return; //already root
			}
			console.log('Changing to path:' + path);
			if (path.startsWith("/"))
				path = path.substring(1);

			// this.path = path ? path.split('/') : [];
		        let pathArr = path.length > 0 ? path.split('/') : []
                        this.$store.commit('SET_PATH', pathArr)

			this.showSpinner = true;
			this.updateHistory("Drive", path, {filename:""});
		},
        reduceDownload(index, files, future) {
            let that = this;
            if (index == files.length) {
                future.complete(true);
            } else {
                let file = files[index];
                that.downloadFile(file).thenApply(res => {
                    setTimeout(() => that.reduceDownload(index + 1, files, future), 10);//browser download may fail on tiny files if timeout not used
                });
            }
        },
        createThumbnailMultiSelect() {
            if (this.currentDir == null)
                return false;
            if (this.selectedFiles.length == 0)
                return;
            let mediaFiles = [];
            for (var i = 0; i < this.selectedFiles.length; i++) {
                let file = this.selectedFiles[i];
                if (!file.isDirectory()) {
                    if (file.props.thumbnail.ref == null) {
                            var mimeType = file.props.mimeType;
                            if (mimeType.startsWith("video") && this.isStreamingAvailable) {
                                mediaFiles.push(file);
                            } else if(mimeType.startsWith("image") || mimeType.startsWith("audio/mpeg")) {
                                mediaFiles.push(file);
                            }
                    }
                }
            }
            this.reduceCreateThumbnail(mediaFiles, 0);
        },
        reduceCreateThumbnail(files, index) {
            let that = this;
            if (index == files.length) {
                this.currentDirChanged();
            } else {
                let file = files[index];
                file.calculateAndUpdateThumbnail(this.context.network, this.context.crypto).thenApply(res => {
                    that.reduceCreateThumbnail(files, index + 1);
                }).exceptionally(function(throwable) {
                    that.reduceCreateThumbnail(files, index + 1);
                });
            }
        },
        downloadAllMultiSelect() {
            if (this.currentDir == null)
                return false;
            if (this.selectedFiles.length == 0)
                return;
            if (!this.isStreamingAvailable) {
                this.showToastError(this.translate("DRIVE.DOWNLOAD.MULTIPLE.STREAM.ERROR"));
                return;
            }
            let foundFolder = false;
            for (var i = 0; i < this.selectedFiles.length; i++) {
                let file = this.selectedFiles[i];
                if (file.isDirectory()) {
                    foundFolder = true;
                }
            }
            let that = this;
            if (foundFolder) {
                that.zipAndDownloadMultiSelect();
            } else {
                let files = this.selectedFiles.slice();
                let future = peergos.shared.util.Futures.incomplete();
                this.reduceDownload(0,files, future);
                future.thenApply(res => {
                    that.selectedFiles = [];
                });
            }
        },
		downloadAll() {
			if (this.selectedFiles.length == 0)
				return;
			this.closeMenu();
			for (var i = 0; i < this.selectedFiles.length; i++) {
				var file = this.selectedFiles[i];
				this.navigateOrDownload(file);
			}
		},

                viewFile() {
                    this.openFile(false)
                },

		editFile() {
                    this.openFile(true)
                },

		openFile(writable) {
		    // TODO: once we support selecting files re-enable this
		    //if (this.selectedFiles.length == 0)
		    //    return;
		    this.closeMenu();
		    if (this.selectedFiles.length == 0)
			    return;
            let that = this;
		    var file = this.selectedFiles[0];
		    var filename = file.getName();

            var app = this.getApp(file, this.getPath, writable);
            if (app != "hex" && app != "editor") {
                var args = {filename:filename}
                this.appArgs = args;
                this.openFileOrDir(app, this.getPath, args, writable);
            } else { //get from recommended apps if possible
                let recommendedApp = this.getRecommendedViewer(file);
                if (this.context.username == null && recommendedApp != null) {
                    this.readAppProperties(recommendedApp, "/peergos/recommended-apps/").thenApply(props => {
                        if (props == null) {
                            var args = {filename:filename}
                            that.appArgs = args;
                            that.openFileOrDir(app, that.getPath, args, writable);
                        } else {
                            that.sandboxAppName = recommendedApp;
                            that.currentFile= file;
                            that.currentPath= that.getPath;
                            that.appSandboxProps = props;
                            that.showAppSandbox = true;
                        }
                    });
                } else {
                    let userApps = this.availableAppsForFile(file);
                    var args = {filename:filename}
                    this.appArgs = args;
                    if (userApps.length == 1 && app != "editor") {
                        this.openFileOrDir(userApps[0].name, this.getPath, args, writable);
                    } else {
                        if (recommendedApp != null) {
                            this.navigateToRecommendedApps(recommendedApp);
                        } else {
                            this.openFileOrDir(app, this.getPath, args, writable);
                        }
                    }
                }
            }
		},
        navigateToRecommendedApps: function(appName) {
            let that = this;
            let path = "/peergos/recommended-apps/";
            this.context.getByPath(path + "index.html").thenApply(function(fileOpt){
                if (fileOpt.ref != null && fileOpt.get().getFileProperties().sizeLow() > 20) {
                    that.$toast(that.translate("DRIVE.INSTALL_DEDICATED_APP"), {timeout:false});
                    that.showAppSandbox = true;
                    that.sandboxAppName = '$$app-gallery$$';
                    that.currentFile = fileOpt.get();
                    that.currentPath = path;
                    that.htmlAnchor = appName;
                } else {
                    let file = that.selectedFiles[0];
                    let filename = file.getName();
                    let writable = file.isWritable();
                    let args = {filename:filename}
                    that.appArgs = args;
                    let app = that.getApp(file, that.getPath, writable);
                    that.openFileOrDir(app, that.getPath, args, writable);
                }
            });
        },
		navigateOrDownload(file) {
			if (this.showSpinner) // disable user input whilst refreshing
				return;
			if (file.isDirectory()) {
				this.navigateToSubdir(file.getFileProperties().name);
			} else {
				var that = this;
				this.confirmDownload(file, () => { that.downloadFile(file); });
			}
		},

		navigateDrive(file) {
			this.closeMenu();
            // console.log(file, 'navigateDrive' )
			if (file.isDirectory()) {
				this.navigateToSubdir(file.getFileProperties().name);
			} else {
			    let newClickedFilename = file.getFileProperties().name;
			    let existingClickedFilename = this.clickedFilename;
			    this.clickedFilename = newClickedFilename;
                this.clicks++;
                if (this.clicks === 1) {
                    this.clickTimer = setTimeout( () => { this.clicks = 0}, this.dblClickDelay);
                } else {
                    clearTimeout(this.clickTimer);
                    if (newClickedFilename == existingClickedFilename) {
                        this.selectedFiles = [file];
                        this.openFile();
                    }
                    this.clicks = 0;
                }
			}
		},
		navigateToSubdir(name) {
			this.changePath(this.getPath + name);
		},
		getFileClass(file) {
			if (file.isDirectory())
				return "dir";
			return "file"
		},
        dragStart: function(ev, treeNode) {
            console.log("dragstart");

            ev.dataTransfer.effectAllowed='move';
            var id = ev.target.id;
            ev.dataTransfer.setData("text/plain", id);
            var owner = treeNode.getOwnerName();
            var me = this.context.username;
            if (owner === me) {
                console.log("cut");
                this.clipboard = {
                    parent: this.currentDir,
                    fileTreeNode: treeNode,
                    op: "cut"
                };
            } else {
                console.log("copy");
                ev.dataTransfer.effectAllowed='copy';
                this.clipboard = {
                    fileTreeNode: treeNode,
                    op: "copy"
                };
            }
        },
        // DragEvent, FileTreeNode => boolean
        drop: function(ev, target) {
            console.log("drop");
            ev.preventDefault();
            var moveId = ev.dataTransfer.getData("text");
            var id = ev.currentTarget.id;
            var that = this;
            if(id != moveId && target.isDirectory()) {
                const clipboard = this.clipboard;
                if (typeof(clipboard) ==  undefined || typeof(clipboard.op) == "undefined")
                    return;
                that.showSpinner = true;
                if (clipboard.op == "cut") {
        		    var name = clipboard.fileTreeNode.getFileProperties().name;
                    console.log("drop-cut " + name + " -> "+target.getFileProperties().name);
                    let filePath = peergos.client.PathUtils.toPath(that.path, name);
                    clipboard.fileTreeNode.moveTo(target, clipboard.parent, filePath, this.context, {get_0:() => that.confirmMove()})
                    .thenApply(function() {
                        that.currentDirChanged();
			            that.onUpdateCompletion.push(function() {
                            that.showSpinner = false;
                            that.clipboard = null;
			            });
                    }).exceptionally(function(throwable) {
                        that.errorTitle = that.translate("DRIVE.MOVE.ERROR")
                            .replace("$NAME", clipboard.fileTreeNode.getName());
                        that.errorBody = throwable.getMessage();
                        that.showError = true;
                        that.showSpinner = false;
                    });
                } else if (clipboard.op == "copy") {
                    console.log("drop-copy");
                    var file = clipboard.fileTreeNode;
                    var props = file.getFileProperties();
                    file.copyTo(target, this.context)
                    .thenApply(function() {
                        that.currentDirChanged();
                        that.onUpdateCompletion.push(function() {
                            that.showSpinner = false;
                            that.clipboard = null;
                        });
                    }).exceptionally(function(throwable) {
                        that.errorTitle = that.translate("DRIVE.COPY.ERROR")
                            .replace("$NAME", clipboard.fileTreeNode.getName());
                        that.errorBody = throwable.getMessage();
                        that.showError = true;
                        that.showSpinner = false;
                    });
                }
            }
        },
		isProfileViewable: function() {
           try {
               if (this.currentDir.props.name != "/")
                   return false;
               if (this.selectedFiles.length != 1)
                   return false;
               return this.selectedFiles[0].isDirectory()
           } catch (err) {
               return false;
           }
        },

        isPasteToFolderMultiSelectAvailable(target) {
            if (this.currentDir == null)
                return false;

            if (typeof (this.clipboardMultiSelect) == undefined || this.clipboardMultiSelect == null ||
                this.clipboardMultiSelect.op == null || typeof (this.clipboardMultiSelect.op) == "undefined")
                return false;
            if (target == null)
                return false;
            return target.isWritable() && target.isDirectory();
        },

		openMenu(file) {
			// console.log(file)
			if (this.isPasteToFolderMultiSelectAvailable(file)) {
                this.multiSelectTargetFolder = file;
                this.viewPasteMenu = true
                Vue.nextTick(() => {
                    this.$refs.drivePasteMenu.$el.focus()
                });
			} else {
			    this.multiSelectTargetFolder = null;
                if (file) {
                    this.selectedFiles = [file];
                } else {
                    this.selectedFiles = [this.currentDir];
                }

                this.viewMenu = true
                Vue.nextTick(() => {
                    this.$refs.driveMenu.$el.focus()
                });
            }
		},

		createNewApp() {
            this.prompt_new_app_func = function (appName, permissions) {
                this.buildNewAppSkeleton(appName, permissions);
            }.bind(this);
            this.showNewAppPrompt = true;
		},

        buildNewAppSkeleton(appDisplayName, permissions) {
			var that = this;
            let appNameLowercase = appDisplayName.toLowerCase();
            let dupApp = this.sandboxedApps.appsInstalled.slice().filter(app => app.displayName.toLowerCase() == appNameLowercase);
            if (dupApp.length != 0) {
                this.$toast.error(this.translate("DRIVE.APP.EXISTS").replace("$NAME", appDisplayName));
                return;
            }
            let launchable = permissions.filter(p => p == 'EDIT_CHOSEN_FILE' || p == 'READ_CHOSEN_FOLDER').length == 0 ? true : false;
            let folderAction = permissions.filter(p => p == 'READ_CHOSEN_FOLDER').length == 0 ? false : true;
			this.showSpinner = true;
			let appName = appDisplayName.replaceAll(' ', '').toLowerCase().trim();
            let encoder = new TextEncoder();
            let props = {"schemaVersion": "1", "displayName": appDisplayName, "name": appName,
                "version": "0.0.1", "author": this.context.username, "folderAction": folderAction,
                "description": "", "launchable": launchable,
                "fileExtensions": [], "mimeTypes": [], "fileTypes": [], "permissions": permissions
            };
            let manifestUint8Array = encoder.encode(JSON.stringify(props, null, 2));
            let appManifest = convertToByteArray(manifestUint8Array);
            let manifestReader = new peergos.shared.user.fs.AsyncReader.ArrayBacked(appManifest);
            let manifestProps =
                    new peergos.shared.user.fs.FileWrapper.FileUploadProperties("peergos-app.json", {get_0: () => manifestReader}, 0,
                        manifestUint8Array.byteLength, java.util.Optional.empty(), java.util.Optional.empty(), false, true, x => {});
            let html = '<!DOCTYPE html>\n' +
            '<html lang="en">\n' +
            '    <head>\n' +
            '        <meta charset="UTF-8">\n' +
            '        <meta name="viewport" content="width=device-width, initial-scale=1">\n' +
            '        <title>App: ' + appDisplayName + '</title>\n' +
            '    </head>\n' +
            '    <body>\n' +
            '	<h1>' + appDisplayName + '</h1>\n' +
            '    </body>\n' +
            '</html>';
            let indexUint8Array = encoder.encode(html);
            let appIndexPage = convertToByteArray(indexUint8Array);
            let indexReader = new peergos.shared.user.fs.AsyncReader.ArrayBacked(appIndexPage);
            let indexPageProps =
                    new peergos.shared.user.fs.FileWrapper.FileUploadProperties("index.html", {get_0: () => indexReader}, 0,
                        indexUint8Array.byteLength, java.util.Optional.empty(), java.util.Optional.empty(), false, true, x => {});
            let folderUPList = [];
            let appFolderProps = new peergos.shared.user.fs.FileWrapper.FolderUploadProperties(
                peergos.client.JsUtil.asList([appName]), peergos.client.JsUtil.asList([manifestProps]));
            folderUPList.push(appFolderProps);
            let assetFolderProps = new peergos.shared.user.fs.FileWrapper.FolderUploadProperties(
                peergos.client.JsUtil.asList([appName, 'assets']), peergos.client.JsUtil.asList([indexPageProps]));
            folderUPList.push(assetFolderProps);

            let folderStream = peergos.client.JsUtil.asList(folderUPList).stream();
            let alwaysResumeFileUpload = function(f) {
                let future = peergos.shared.util.Futures.incomplete();
                future.complete(true);
                return future;
            }
            var commitWatcher = {
                get_0: function() {
                    return true;
                }
            };
            this.currentDir.uploadSubtree(folderStream, this.getMirrorBatId(this.currentDir), this.context.network,
                this.context.crypto, this.context.getTransactionService(),
                f => alwaysResumeFileUpload(f), commitWatcher).thenApply(res => {
                    that.showSpinner = false;
                    that.updateCurrentDir();
                    that.updateFiles();
                    that.updateUsage();
            }).exceptionally(function (throwable) {
                that.errorTitle = that.translate("DRIVE.APP.ERROR");
                that.errorBody = throwable.getMessage();
                that.showError = true;
                that.showSpinner = false;
            });
        },

		createBlankFile() {
		    let that = this;
			this.prompt_placeholder = this.translate("DRIVE.FILENAME.PLACEHOLDER");
			this.prompt_message = this.translate("DRIVE.FILENAME");
			this.prompt_value = '';
			this.prompt_action = this.translate("PROMPT.OK");
			this.prompt_consumer_func = function (prompt_result) {
				if (prompt_result === null)
					return;
				let fileName = prompt_result.trim();
				if (fileName === '')
					return;
                if (fileName.includes("/"))
                    return
				if (that.disallowedFilenames.get(fileName) != null) {
				    that.showToastError(that.translate("DRIVE.FILENAME.INVALID"));
				    return;
                }
    			let fileData = peergos.shared.user.JavaScriptPoster.emptyArray();
				this.uploadEmptyFile(fileName, fileData);
			}.bind(this);
			this.showPrompt = true;
		},

		createBlankImageFile() {
			this.prompt_consumer_func = function (prompt_result) {
				if (prompt_result === null)
					return;
				let fileName = prompt_result.trim();
				if (fileName === '')
					return;
    			let fileData = this.createBlankImage(fileName);
				this.uploadEmptyFile(fileName, fileData);
			}.bind(this);
			this.showNewImageFilePrompt = true;
		},

		uploadEmptyFile(filename, fileData) {
			this.showSpinner = true;
			let that = this;
			// let context = this.getContext();
			let reader = new peergos.shared.user.fs.AsyncReader.ArrayBacked(fileData);
			this.currentDir.uploadFileJS(filename, reader, 0, fileData.length,
				false, that.getMirrorBatId(that.currentDir), this.context.network, this.context.crypto, function (len) { },
				this.context.getTransactionService(),
				f => peergos.shared.util.Futures.of(false)
			).thenApply(function (res) {
				that.currentDir = res;
				that.updateFiles();
				that.onUpdateCompletion.push(function () {
					that.showSpinner = false;
				});
			}).exceptionally(function (throwable) {
				that.showSpinner = false;
				that.errorTitle = that.translate("DRIVE.CREATE.ERROR");
				that.errorBody = throwable.getMessage();
				that.showError = true;
			})
		},
 		createBlankImage(filename) {
        	var imageFormat = null;
        	let dotIndex = filename.indexOf('.');
            let fileExtension = filename.substring(filename.lastIndexOf('.') + 1);
            if (fileExtension == 'jpg') {
                imageFormat = "image/jpeg";
            } else if (fileExtension == 'png') {
                imageFormat = "image/png";
            }
            var canvas = document.createElement('canvas');
            canvas.width = 800;
            canvas.height = 600;
            let dataUrl = canvas.toDataURL(imageFormat);
            let prefix = "data:" + imageFormat + ";base64,";
            let binaryThumbnail = window.atob(dataUrl.substring(prefix.length));
            var data = new Int8Array(binaryThumbnail.length);
            for (var i = 0; i < binaryThumbnail.length; i++) {
                data[i] = binaryThumbnail.charCodeAt(i);
            }
            return convertToByteArray(data);
		},
		rename() {
			if (this.selectedFiles.length == 0)
				return;
			if (this.selectedFiles.length > 1)
				throw "Can't rename more than one file at once!";
			let file = this.selectedFiles[0];
			let fileProps = file.getFileProperties();
			let old_name = fileProps.name
			this.closeMenu();
			let fileType = fileProps.isDirectory ? "directory" : "file";

			this.prompt_placeholder = this.translate("DRIVE.RENAME.PLACEHOLDER");
			this.prompt_value = old_name;
			this.prompt_message = this.translate("DRIVE.RENAME.TITLE");
			var that = this;
			this.prompt_consumer_func = function (prompt_result) {
				if (prompt_result === null)
					return;
				if (prompt_result === old_name)
					return;
				let newName = prompt_result.trim();
				if (newName === '')
					return;
				if (newName === '.' || newName === '..')
					return;
				that.showSpinner = true;
				console.log("Renaming " + old_name + "to " + newName);
				Vue.nextTick(function () {
					let filePath = peergos.client.PathUtils.toPath(that.path, old_name);
					file.rename(newName, that.currentDir, filePath, that.context)
						.thenApply(function (parent) {
							that.currentDir = parent;
							that.updateFiles();
							that.showSpinner = false;
						}).exceptionally(function (throwable) {
							that.updateFiles();
						    that.errorTitle = that.translate("DRIVE.RENAME.ERROR")
                                                        .replace("$TYPE", fileType)
                                                        .replace("$NAME", old_name);
							that.errorBody = throwable.getMessage();
							that.showError = true;
							that.showSpinner = false;
						});
				});
			};
			this.prompt_action = this.translate("PROMPT.OK");
			this.showPrompt = true;
		},

		deleteFilesMultiSelect() {
			var selectedCount = this.selectedFiles.length;
			if (selectedCount == 0)
				return;
            var that = this;
            this.confirmDeleteMultiSelect(selectedCount, (prompt_result) => {
                that.showPrompt = false;
                if (prompt_result != null) {
                    that.showSpinner = true;
                    let parent = that.currentDir;
                    let filesToDelete = peergos.client.JsUtil.asList(that.selectedFiles.slice());
                    let path = that.getPath;
                    let parentPath = peergos.client.PathUtils.directoryToPath(path.split('/').filter(n => n.length > 0));
                    peergos.shared.user.fs.FileWrapper.deleteChildren(parent, filesToDelete, parentPath, that.context).thenApply(updatedParent => {
                        that.updateUsage(usageBytes => {
                            that.updateCurrentDirectory(null , () => {
                                that.showSpinner = false;
                                that.selectedFiles = [];
                            });
                        });
                    }).exceptionally(function (throwable) {
                        that.errorTitle = that.translate("DRIVE.DELETE.ERROR");
                        that.errorBody = throwable.getMessage();
                        that.showError = true;
                        future.complete(false);
                    });
                }
            });
		},

		confirmDeleteMultiSelect(fileCount, deleteFn) {
			this.prompt_placeholder = null;
		    this.prompt_message = this.translate("DRIVE.DELETE.CONFIRM")
                        .replace("$COUNT", fileCount);
			this.prompt_value = '';
			this.prompt_consumer_func = deleteFn;
			this.prompt_action = this.translate("PROMPT.OK");
			this.showPrompt = true;
		},

		deleteFile() {
			var selectedCount = this.selectedFiles.length;
			if (selectedCount == 0)
				return;

			this.closeMenu();
            var file = this.selectedFiles[0];
            var that = this;
            var parent = this.currentDir;

            this.confirmDelete(file, (prompt_result) => {
                if (prompt_result != null) {
                    that.deleteOne(file, parent, this.context);
                }
            });
		},

		deleteOne(file, parent, context) {
			let name = file.getFileProperties().name;
			console.log("deleting: " + name);
			this.showSpinner = true;
			var that = this;
			let filePath = peergos.client.PathUtils.toPath(that.path, name);
			file.remove(parent, filePath, context)
				.thenApply(function (b) {
					that.currentDirChanged();
					that.showSpinner = false;
					that.updateUsage();
				}).exceptionally(function (throwable) {
					that.$toast.error(that.translate("DRIVE.DELETE.FILE.ERROR").replace("$NAME", file.getFileProperties().name).replace("$MESSAGE", throwable.getMessage()), {timeout:false, id: 'deleteFile'})
					that.updateUsage();
				});
		},


		isShared(file) {
			if (this.currentDir == null)
				return false;
			if (this.sharedWithState == null)
				return false;
			return this.sharedWithState.isShared(file.getFileProperties().name);
		},



		closePrompt() {
			this.showPrompt = false;
		},
		closeNewImageFilePrompt() {
			this.showNewImageFilePrompt = false;
		},
        closeNewAppPrompt() {
            this.showNewAppPrompt = false;
        },
		closeMenu() {
		    this.viewMenu = false
		},
		closePasteMenu() {
			this.viewPasteMenu = false
		},
        isSelected(file) {
            return this.selectedFiles.findIndex(selected => selected == file) > -1
        },
        toggleSelection(file, shiftModifier) {
            let index = this.selectedFiles.findIndex(selected=> selected == file)
            if (index > -1) {
                this.selectedFiles.splice(index, 1)
            } else {
                if (shiftModifier) {
                    let newIndex = this.sortedFiles.indexOf(file);
                    var largestIndex = -1;
                    for(var i=0; i < this.selectedFiles.length; i++) {
                        let index = this.sortedFiles.indexOf(this.selectedFiles[i]);
                        if (index < newIndex && index > largestIndex) {
                            largestIndex = index;
                        }
                    }
                    this.selectedFiles = this.selectedFiles.concat(this.sortedFiles.slice(largestIndex +1, newIndex +1));
                } else {
                    this.selectedFiles.push(file);
                }
            }
        }

	},

};
</script>

<style>
.drive-view {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.dnd {
  flex-grow: 1;
}

@media (max-width: 1024px) {
  #dnd {
    /* enable table scroll */
    overflow-x: auto;
  }
}
</style>
