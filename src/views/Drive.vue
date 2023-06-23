<template>
	<article class="drive-view">
		<input type="file" id="uploadFileInput" @change="uploadFiles" style="display:none;" multiple />
		<input type="file" id="uploadDirectoriesInput" @change="uploadFiles" style="display:none;" multiple directory mozDirectory webkitDirectory/>

		<Spinner v-if="showSpinner" :message="spinnerMessage"></Spinner>

		<a id="downloadAnchor" style="display:none"></a>

		<DriveHeader
			:gridView="isGrid"
			:isWritable="isWritable"
			:canPaste="isPasteAvailable"
			:path="path"
			@switchView="switchView()"
			@goBackToLevel="goBackToLevel($event)"
			@askMkdir="askMkdir()"
			@createFile="createBlankFile()"
			@createImageFile="createBlankImageFile()"
			@newApp="createNewApp()"
		        @search="openSearch(false)"
                        @paste="paste()"
		/>

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
            :folder_properties="folder_properties">
        </FolderProperties>

		<div id="dnd"
			@drop="dndDrop($event)"
			@dragover.prevent
			:class="{ not_owner: isNotMe, dnd: 'dnd' }"
		>

			<transition name="fade" mode="out-in" appear>

				<DriveGrid v-if="isGrid" appear>
					<DriveGridCard v-for="(file, index) in sortedFiles"
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
					/>
					<DriveGridDrop v-if="getPath.length > 1 && sortedFiles.length==0 && currentDir != null && currentDir.isWritable()">
					</DriveGridDrop>
				</DriveGrid>

				<DriveTable v-else
					:files="sortedFiles"
					@sortBy="setSortBy"
					@openMenu="openMenu"
					@navigateDrive="navigateDrive"
				/>
			</transition>
		</div>

		<transition name="drop">
			<DriveMenu
				ref="driveMenu"
				v-if="viewMenu"
				@closeMenu="closeMenu()"
			>
				<li id='gallery' v-if="canOpen && !isMarkdown && !isHTML && !hexViewerAlternativeAvailable" @keyup.enter="viewFile()" @click="viewFile()">View</li>
				<li id='view-markdown' v-if="isMarkdown" @keyup.enter="viewFile()" @click="viewFile()">View</li>
				<li id='edit-markdown' v-if="isMarkdown" @keyup.enter="editFile()" @click="editFile()">Edit</li>
				<li id='view-html' v-if="isHTML && isHTMLViewable" @keyup.enter="viewFile()" @click="viewFile()">View</li>
				<li id='edit-html' v-if="isHTML" @keyup.enter="editFile()" @click="editFile()">Edit</li>
				<li id='open-in-app' v-for="app in availableApps" v-on:keyup.enter="appOpen(app.name)" v-on:click="appOpen(app.name)">{{app.contextMenuText}}</li>
				<li id='download-folder' v-if="canOpen" @keyup.enter="downloadAll"  @click="downloadAll">Download</li>
				<li id='rename-file' v-if="isWritable" @keyup.enter="rename"  @click="rename">Rename</li>
				<li id='delete-file' v-if="isWritable" @keyup.enter="deleteFiles"  @click="deleteFiles">Delete</li>
				<li id='copy-file' v-if="allowCopy" @keyup.enter="copy"  @click="copy">Copy</li>
				<li id='cut-file' v-if="isWritable" @keyup.enter="cut"  @click="cut">Cut</li>
				<li id='paste-file' v-if="isPasteAvailable" @keyup.enter="paste"  @click="paste">Paste</li>
				<li id='share-file' v-if="allowShare" @keyup.enter="showShareWith"  @click="showShareWith">Share</li>
				<li id='zip-folder' v-if="allowDownloadFolder" @keyup.enter="zipAndDownload"  @click="zipAndDownload">Download as Zip</li>
				<li id='create-thumbnail' v-if="isWritable && canCreateThumbnail" @keyup.enter="createThumbnail"  @click="createThumbnail">Create Thumbnail</li>
				<li id='folder-props' v-if="allowViewFolderProperties" @keyup.enter="viewFolderProperties"  @click="viewFolderProperties">Properties</li>
				<li id='add-to-launcher' v-if="allowAddingToLauncher" @keyup.enter="addToLauncher"  @click="addToLauncher">Add to Launcher</li>
                <li id='app-run' v-if="isInstallable" @keyup.enter="runApp()" @click="runApp()">Run App</li>
                <li id='app-install' v-if="isInstallable" @keyup.enter="installApp()" @click="installApp()">Install App</li>

			</DriveMenu>
		</transition>

		<Gallery
			v-if="showGallery"
			@hide-gallery="back()"
			:files="sortedFiles"
			:initial-file-name="appArgs.filename">
		</Gallery>

		<Hex
			v-if="showHexViewer"
			v-on:hide-hex-viewer="back()"
			:file="selectedFiles[0]"
			:context="context">
		</Hex>
		<Pdf
			v-if="showPdfViewer"
			v-on:hide-pdf-viewer="back()"
			:file="selectedFiles[0]"
			:context="context">
		</Pdf>
		<CodeEditor
			v-if="showCodeEditor"
			v-on:hide-code-editor="back()"
			v-on:update-refresh="forceUpdate++"
			:file="selectedFiles[0]"
			:context="context">
		</CodeEditor>
        <Markdown
            v-if="showMarkdownViewer"
            v-on:hide-markdown-viewer="showDrive()"
            :propAppArgs = "appArgs">
        </Markdown>
                <Identity
                    v-if="showIdentityProof"
                    v-on:hide-identity-proof="back()"
                    :file="selectedFiles[0]"
                    :context="context">
                </Identity>

		<Share
			v-if="showShare"
			v-on:hide-share-with="closeShare"
			v-on:update-shared-refresh="forceSharedRefreshWithUpdate++"
			:data="sharedWithData"
			:fromApp="fromApp"
			:displayName="displayName"
			:allowReadWriteSharing="allowReadWriteSharing"
			:allowCreateSecretLink="allowCreateSecretLink"
			:files="filesToShare"
			:path="pathToFile"
			:currentDir="currentDir"
			:messages="messages">
		</Share>
		<Search
			v-if="showSearch"
			v-on:hide-search="closeSearch"
			:path="searchPath"
			:navigateToAction="navigateToAction"
			:viewAction="viewAction"
			:context="context">
		</Search>
        <AppRunner
            v-if="showAppRunner"
            v-on:hide-app-run="closeAppRunner"
            :appPropsFile="selectedFiles[0]">
        </AppRunner>
        <AppInstall
            v-if="showAppInstallation"
            v-on:hide-app-installation="closeAppInstallation"
            :appInstallSuccessFunc="appInstallSuccess"
            :appPropsFile="selectedFiles[0]"
            :installFolder="getPath">
        </AppInstall>
        <AppSandbox
            v-if="showAppSandbox"
            v-on:hide-app-sandbox="closeAppSandbox(true)"
            v-on:close-app-sandbox="closeAppSandbox(false)"
            v-on:refresh="forceSharedRefreshWithUpdate++"
            :sandboxAppName="sandboxAppName"
            :currentFile="selectedFiles[0]"
            :currentPath="getPath">
        </AppSandbox>
        <Replace
            v-if="showReplace"
            v-on:hide-replace="showReplace = false"
            :replace_message='replace_message'
            :replace_body="replace_body"
            :consumer_cancel_func="replace_consumer_cancel_func"
            :consumer_func="replace_consumer_func"
            :showApplyAll=replace_showApplyAll>
        </Replace>
        <Warning
            v-if="showWarning"
            v-on:hide-warning="closeWarning"
            :warning_message='warning_message'
            :warning_body="warning_body"
            :consumer_func="warning_consumer_func">
        </Warning>
		<Error
			v-if="showError"
			@hide-error="showError = false"
			:title="errorTitle"
			:body="errorBody"
			:messageId="messageId">
		</Error>
        <Confirm
                v-if="showConfirm"
                v-on:hide-confirm="showConfirm = false"
                :confirm_message='confirm_message'
                :confirm_body="confirm_body"
                :consumer_cancel_func="confirm_consumer_cancel_func"
                :consumer_func="confirm_consumer_func">
        </Confirm>
	</article>
</template>

<script>

import AppInstall from "../components/sandbox/AppInstall.vue";
import AppRunner from "../components/sandbox/AppRunner.vue";
import AppSandbox from "../components/sandbox/AppSandbox.vue";
import CodeEditor from "../components/code-editor/CodeEditor.vue";
import Confirm from "../components/confirm/Confirm.vue";
import DriveHeader from "../components/drive/DriveHeader.vue";
import DriveGrid from "../components/drive/DriveGrid.vue";
import DriveGridCard from "../components/drive/DriveGridCard.vue";
import DriveGridDrop from "../components/drive/DriveGridDrop.vue";
import DriveTable from "../components/drive/DriveTable.vue";
import Error from "../components/error/Error.vue";
import Gallery from "../components/drive/DriveGallery.vue";
import Identity from "../components/identity-proof-viewer.vue";
import Share from "../components/drive/DriveShare.vue";
import Search from "../components/Search.vue";
import Markdown from "../components/viewers/Markdown.vue";
import Hex from "../components/viewers/Hex.vue";
import ProgressBar from "../components/drive/ProgressBar.vue";
import DriveMenu from "../components/drive/DriveMenu.vue";

import AppPrompt from "../components/prompt/AppPrompt.vue";
import NewImageFilePrompt from "../components/NewImageFilePrompt.vue";
import NewAppPrompt from "../components/sandbox/new-app/NewAppPrompt.vue";
import FolderProperties from "../components/FolderProperties.vue";
import Pdf from "../components/pdf/PDF.vue";
import Replace from "../components/replace/Replace.vue";
import Spinner from "../components/spinner/Spinner.vue";
import Warning from '../components/Warning.vue';

import helpers from "../mixins/storage/index.js";
import downloaderMixins from "../mixins/downloader/index.js";
import zipMixin from "../mixins/zip/index.js";

import router from "../mixins/router/index.js";
import launcherMixin from "../mixins/launcher/index.js";

import { inject } from 'vue'
const store = inject('store')

export default {
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
		Markdown,
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
			showMarkdownViewer: false,
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
            progressBarUpdateFrequency: 50
		};
	},
	mixins:[downloaderMixins, router, zipMixin, launcherMixin],
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
        isMarkdown() {
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
                    (mimeType.startsWith("text/") && file.getName().endsWith('.md'));
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
		isPasteAvailable() {
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
	},



	created() {
	    let that = this;
		this.onResize()
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
			this.updateSocial(function (res) { that.updateCurrentDir(); });
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
        		    that.setup();
                },
                function (seekHi, seekLo, seekLength, uuid) {
                },
                undefined,
                0
            );
        },
		setup() {
			const that = this;
			if (this.context != null && this.context.username == null) {
			    // open drive from a secret link
			    this.context.getEntryPath().thenApply(function (linkPath) {
				var path = that.initPath == null ? null : decodeURIComponent(that.initPath);
				if (path != null && (path.startsWith(linkPath) || linkPath.startsWith(path))) {
                                    store.commit('SET_PATH', path.split('/').filter(n => n.length > 0))
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
                                    }
				} else {
                                    store.commit('SET_PATH', linkPath.split('/').filter(n => n.length > 0))
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
                                            } else if (oneFile) { // if there is exactly 1 file, open it
                                                const filename = that.files[0].getName();
                                                that.selectedFiles = that.files;
					        var app = that.getApp(that.files[0], that.getPath, false);
                                                that.openInApp({filename:filename}, app);
                                                that.openFileOrDir(app, that.getPath, {filename:filename}, false);
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

				const apps = ['Calendar', 'NewsFeed', 'Social', 'Tasks', 'Launcher']

				if (pathFromUrl !== null && !apps.includes(appFromUrl) ) {

					this.showSpinner = true;

					let open = () => {
					    that.openInApp(argsFromUrl, appFromUrl)
					};
					this.onUpdateCompletion.push(open);

					store.commit('SET_PATH', pathFromUrl.split('/').filter(n => n.length > 0))

				} else {
					store.commit('SET_PATH', [this.context.username])
					this.updateHistory('Drive', this.getPath, {filename:""})
				}

				this.updateSocial()
				this.updateUsage()
                this.updateQuota()
                this.updateMirrorBatId()
                            
				this.context.getPaymentProperties(false).thenApply(function (paymentProps) {
					if (paymentProps.isPaid()) {
						that.paymentProperties = paymentProps;
					} else
						that.context.getPendingSpaceRequests().thenApply(reqs => {
							if (reqs.toArray([]).length > 0)
								store.commit('USER_ADMIN', true);
						});
				});
			}
			this.showPendingServerMessages();
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
			store.commit('SET_WINDOW_WIDTH', window.innerWidth)
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
			store.commit('SET_PATH', data.path)

		},
		processPending() {
			for (var i = 0; i < this.onUpdateCompletion.length; i++) {
				this.onUpdateCompletion[i].call();
			}
			this.onUpdateCompletion = [];
		},

                back() {
                    history.back();
                },

                showDrive() {
                    this.updateHistory("Drive", this.getPath, {filename:""});
                },

		closeApps() {
		    this.showGallery = false;
            this.showIdentityProof = false;
		    this.showPdfViewer = false;
		    this.showCodeEditor = false;
		    this.showMarkdownViewer = false;
		    this.showAppSandbox = false;
		    this.showTextViewer = false;
		    this.showHexViewer = false;
		    this.showSearch = false;
		},

		navigateToAction(directory) {
			let newPath = directory.startsWith("/") ? directory.substring(1).split('/') : directory.split('/');
			let currentPath = this.path;
			if (newPath.length != currentPath.length) {
				this.changePath(directory);
			} else {
				for (var i = 0; i < newPath.length; i++) {
					if (newPath[i] != currentPath[i]) {
						this.changePath(directory);
						return;
					}
				}
			}
		},
		viewAction(path, filename) {
			this.showSpinner = true;
			if (path.startsWith("/"))
				path = path.substring(1);

			// this.path = path ? path.split('/') : [];
			path == this.path ? path.split('/') : []

                        this.closeApps();
			this.updateHistory("Drive", path, {filename:""});
			this.updateCurrentDirectory(filename);
		},
        appOpen(appName) {
            this.closeMenu();
            this.showAppSandbox = true;
            this.sandboxAppName = appName;
        },
        closeAppSandbox(reloadDrive) {
            this.showAppSandbox = false;
            if (reloadDrive) {
                this.showDrive();
            }
        },
	    openInApp(args, app) {
                if (app == null || app == "" || app == "Drive") {
                    this.closeApps();
                    return
                }
                this.appArgs = args;
		this.selectedFiles = this.files.filter(f => f.getName() == args.filename);
		this.openApp(app);
	    },
		openApp(app) {
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
                    else if (app == "markdown")
                        that.showMarkdownViewer = true;
                    else if (app == "htmlviewer") {
                        that.sandboxAppName = "htmlviewer";
                        that.showAppSandbox = true;
                    } else if (app == "search") {
                        that.showSearch = true;
                    } else {
                        that.appOpen(app);
                    }
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
		    this.context.getByPath(path).thenApply(function (file) {
                        if (! file.get().isDirectory()) {
                            // go to parent if we tried to navigate to file
                            if (path.endsWith("/"))
                                path = path.substring(0, path.length-1)
                            let index = path.lastIndexOf("/");
                            filename = path.substring(index+1);
                            that.changePath(path.substring(0, index));
                            that.updateCurrentDirectory(selectedFilename, callback)
                            return;
                        }
			that.currentDir = file.get();
			that.updateFiles(selectedFilename, callback);
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
					that.files = arr.filter(function (f) {
						return !f.getFileProperties().isHidden;
					});
                    if (selectedFilename != null) {
                        that.selectedFiles = that.files.filter(f => f.getName() == selectedFilename);
                        that.openFile();
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
			this.prompt_placeholder = 'Folder name';
			this.prompt_message = 'Create folder';
			this.prompt_value = '';
			this.prompt_consumer_func = function (prompt_result) {
				if (prompt_result === null)
					return;
				let folderName = prompt_result.trim();
				if (folderName === '')
					return;
				if (folderName === '.' || folderName === '..')
					return;
				this.mkdir(folderName);
			}.bind(this);
			this.showPrompt = true;
		},

		confirmDelete(file, deleteFn) {
			const extra = file.isDirectory() ? " and all its contents" : "";
			this.prompt_placeholder = null;
			this.prompt_message = `Are you sure you want to delete ${file.getName()} ${extra}?`;
			this.prompt_value = '';
			this.prompt_consumer_func = deleteFn;
			// this.prompt_action = 'Delete'
			this.showPrompt = true;
		},

		closeWarning() {
			this.showWarning = false;
		},
		confirmDownload(file, downloadFn) {
			var size = this.getFileSize(file.getFileProperties());
			if (this.isStreamingAvailable || size < 50 * 1024 * 1024)
				return downloadFn();
			var sizeMb = (size / 1024 / 1024) | 0;
			this.warning_message = 'Are you sure you want to download ' + file.getName() + " of size " + sizeMb + 'MiB?';
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
	zipAndDownload() {
            if (this.isStreamingAvailable) {
                this.zipAndDownloadFolder();
            } else {
                this.showToastError("Download as Zip only available where Streaming supported (like Chrome)");
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
                    that.$toast('Folder:' + file.getName() + ' contains no files. Nothing to download');
                }else if (statistics.actualSize > 1024 * 1024 * 1024 * 4) { //4GiB
                    that.$toast('Download of a Folder greater than 4GiB in size is not supported');
                } else {
                    let filename = file.getName();
                    this.confirmZipAndDownloadOfFolder(filename, statistics,
                        () => {
                            that.showConfirm = false;
                            var progress = {
                                show: true,
                                title: 'Downloading folder: ' + filename,
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
            this.confirm_message='Are you sure you want to download folder: ' + folderName + " ?";
            this.confirm_body='Folder(s): ' + statistics.folderCount
                    + ', File(s): ' + statistics.fileCount
                    + ', Total size: ' + helpers.convertBytesToHumanReadable(statistics.actualSize);
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
            if (this.quotaBytes.toString() == '0') {
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
                    this.$toast.error("Client Offline!", {timeout:false, id: 'upload'})
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
                        let errMsg = "File upload operation exceeds available space\n" + "Please free up " + helpers.convertBytesToHumanReadable('' + -spaceAfterOperation) + " and try again";
                        that.$toast.error(errMsg, {timeout:false, id: 'upload'})
                    } else {
                        //resetting .value tricks browser into allowing subsequent upload of same file(s)
                        document.getElementById('uploadFileInput').value = "";
                        document.getElementById('uploadDirectoriesInput').value = "";
                        let name = 'bulkUpload-' + this.uuid();
                        let title = "Encrypting and uploading file(s)";
                        let sortedFiles = this.sortFilesByDirectory(files, this.getPath);
                        let progress = {
                            title: title,
                            done:0,
                            max:totalSize,
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
                                that.context.getSpaceUsage().thenApply(u => {
                                    store.commit('SET_USAGE', u);
                                });
                            }
                            that.updateCurrentDirectory();
                        }
                        if (!commitContext.completed && uploadParams.progress.current >= uploadParams.progress.total) {
                            commitContext.completed = true;
                            let title = 'Completing upload and refreshing folder...';
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
                        that.errorTitle = 'Error Uploading files';
                        that.errorBody = throwable.getMessage();
                        that.showError = true;
                        that.$toast.clear();
                    });
                });
            }
            return uploadFuture;
        },
        confirmResumeFileUpload(filename, folderPath, confirmFunction, cancelFunction) {
            this.confirm_message='Do you wish to resume failed file upload?';
            this.confirm_body='File: ' + filename + " Folder: " + folderPath;
            this.confirm_consumer_cancel_func = cancelFunction;
            this.confirm_consumer_func = confirmFunction;
            this.showConfirm = true;
        },
        reduceAllUploads: function(index, files, future, uploadParams, previousDirectoryHolder) {
            let that = this;
            if (index == files.length) {
                if (uploadParams.progress.total == 0) {
                    that.addUploadProgressMessage(uploadParams, 'Nothing to upload', '', '', true);
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
                                    uploadParams.progress.max = uploadParams.progress.max - file.size;
                                    future.complete(true);
                                }
                            } else {
                                that.confirmReplaceFile(file,
                                    (applyToAll) => {
                                        uploadParams.applyReplaceToAll = applyToAll;
                                        uploadParams.replaceFile = false;
                                        uploadParams.progress.total = uploadParams.progress.total - 1;
                                        uploadParams.progress.max = uploadParams.progress.max - file.size;
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
			this.replace_message = 'File: "' + file.name + '" already exists in this location. Do you wish to replace it?';
			this.replace_body = '';
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
                max:file.size,
                finished:false,
                lastUpdate: false
            };
            let thumbnailOffset = 20 * 1024;
            let updateProgressBar = function(len){
                let firstUpdate = updater.done == 0;
                updater.done += len.value_0;
                uploadParams.progress.done += len.value_0;
                if (!updater.finished && updater.done >= (updater.max + thumbnailOffset)) {
                    updater.finished = true;
                    //console.log('uploadParams.progress.done=' + uploadParams.progress.done + " uploadParams.progress.max=" + uploadParams.progress.max);
                    uploadParams.progress.current  = uploadParams.progress.current + 1;
                    uploadParams.triggerRefresh = true;
                }
                let title = '[' + uploadParams.progress.current + '/' + uploadParams.progress.total + '] ' + uploadParams.title;
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
            let fup = new peergos.shared.user.fs.FileWrapper.FileUploadProperties(file.name, java_reader,
                (file.size - (file.size % Math.pow(2, 32))) / Math.pow(2, 32), file.size, false,
                overwriteExisting ? true : false, updateProgressBar);

            let fileUploadList = uploadParams.fileUploadProperties[foundDirectoryIndex];
            fileUploadList.push(fup);
            future.complete(true);
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
					let filePath = peergos.client.PathUtils.toPath(that.path, name);
					clipboard.fileTreeNode.moveTo(target, clipboard.parent, filePath, that.context)
						.thenApply(function () {
							that.currentDirChanged();
							that.onUpdateCompletion.push(function () {
								that.showSpinner = false;
							});
						}).exceptionally(function (throwable) {
							that.errorTitle = 'Error moving file';
							that.errorBody = throwable.getMessage();
							that.showError = true;
							that.showSpinner = false;
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
                            this.$toast.error("Client Offline!", {timeout:false, id: 'upload'});
                            this.showSpinner = false;
                        }
                    } else {
                        this.calculateTotalSize(clipboard.fileTreeNode, clipboard.path).thenApply(statistics => {
                            if (Number(that.quotaBytes.toString()) < statistics.apparentSize) {
                                let errMsg = "File copy operation exceeds total space\n" + "Please upgrade to get more space";
                                that.$toast.error(errMsg, {timeout:false, id: 'upload'})
                            } else {
                                let spaceAfterOperation = that.checkAvailableSpace(statistics.apparentSize);
                                if (spaceAfterOperation < 0) {
                                    let errMsg = "File copy operation exceeds available space\n" + "Please free up " + helpers.convertBytesToHumanReadable('' + -spaceAfterOperation) + " and try again";
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
                                        that.errorTitle = 'Error copying file';
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
                        store.commit("SET_SHORTCUTS", shortcutsMap);
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
			store.commit('SET_CONTEXT', newContext);

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
                        store.commit('SET_PATH', pathArr)

			this.showSpinner = true;
			this.updateHistory("Drive", path, {filename:""});
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
                    
		    var file = this.selectedFiles[0];
		    var filename = file.getName();

                    var app = this.getApp(file, this.getPath, writable);
                    var args = {filename:filename}
                    this.appArgs = args;
                    this.openFileOrDir(app, this.getPath, args, writable)
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
                    clipboard.fileTreeNode.moveTo(target, clipboard.parent, filePath, this.context)
                    .thenApply(function() {
                        that.currentDirChanged();
			            that.onUpdateCompletion.push(function() {
                            that.showSpinner = false;
                            that.clipboard = null;
			            });
                    }).exceptionally(function(throwable) {
                        that.errorTitle = 'Error moving file';
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
                        that.errorTitle = 'Error copying file';
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

		openMenu(file) {
			// console.log(file)
			if (file) {
				this.selectedFiles = [file];
			} else {
				this.selectedFiles = [this.currentDir];
			}

			this.viewMenu = true

			Vue.nextTick(() => {
				this.$refs.driveMenu.$el.focus()
			});
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
                this.$toast.error(`App with name ${appDisplayName} already exists!`);
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
                    new peergos.shared.user.fs.FileWrapper.FileUploadProperties("peergos-app.json", manifestReader, 0,
                        manifestUint8Array.byteLength, false, true, x => {});
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
                    new peergos.shared.user.fs.FileWrapper.FileUploadProperties("index.html", indexReader, 0,
                        indexUint8Array.byteLength, false, true, x => {});
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
                that.errorTitle = 'Error creating App';
                that.errorBody = throwable.getMessage();
                that.showError = true;
                that.showSpinner = false;
            });
        },

		createBlankFile() {
			this.prompt_placeholder = 'File name';
			this.prompt_message = 'Enter a file name';
			this.prompt_value = '';
			this.prompt_consumer_func = function (prompt_result) {
				if (prompt_result === null)
					return;
				let fileName = prompt_result.trim();
				if (fileName === '')
					return;
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
				that.errorTitle = 'Error creating file';
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

			this.prompt_placeholder = 'New name';
			this.prompt_value = old_name;
			this.prompt_message = 'Enter a new name';
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
							that.errorTitle = "Error renaming " + fileType + ": " + old_name;
							that.errorBody = throwable.getMessage();
							that.showError = true;
							that.showSpinner = false;
						});
				});
			};
			this.showPrompt = true;
		},


		deleteFiles() {
			// console.log('deleteFiles:',this.selectedFiles.length )
			var selectedCount = this.selectedFiles.length;
			if (selectedCount == 0)
				return;

			this.closeMenu();

			for (var i = 0; i < selectedCount; i++) {
				var file = this.selectedFiles[i];
				var that = this;
				var parent = this.currentDir;

				// console.log('deleteFiles:',file, parent, this.context )
				this.confirmDelete(file, (prompt_result) => {
				    if (prompt_result != null) {
					    that.deleteOne(file, parent, this.context);
					}
				});
			}
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
					that.$toast.error(`Error deleting file: ${file.getFileProperties().name}: ${ throwable.getMessage() }`, {timeout:false, id: 'deleteFile'})
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
	#dnd{
		/* enable table scroll */
		overflow-x:auto;
	}
}
</style>
