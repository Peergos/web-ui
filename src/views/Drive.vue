<template>
	<article class="drive-view">
		<input type="file" id="uploadFileInput" @change="uploadFiles" style="display:none;" multiple />
		<input type="file" id="uploadDirectoriesInput" @change="uploadFiles" style="display:none;" multiple directory mozDirectory webkitDirectory/>

		<spinner v-if="showSpinner" :message="spinnerMessage"></spinner>

		<a id="downloadAnchor" style="display:none"></a>

		<DriveHeader
			:gridView="isGrid"
			:isWritable="isWritable"
			:canPaste="isPasteAvailable"
			:path="path"
			@switchView="switchView()"
			@goBackToLevel="goBackToLevel($event)"
			@askMkdir="askMkdir()"
			@createFile="createTextFile()"
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
					<DriveGridDrop v-if="sortedFiles.length==0 && currentDir != null && currentDir.isWritable()">
						Upload a file by dragging and dropping here or clicking the icon
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
				<li id='gallery' v-if="canOpen" @keyup.enter="openFile" @click="openFile">View</li>
				<li id='open-file' v-if="canOpen" @keyup.enter="downloadAll"  @click="downloadAll">Download</li>
				<li id='rename-file' v-if="isWritable" @keyup.enter="rename"  @click="rename">Rename</li>
				<li id='delete-file' v-if="isWritable" @keyup.enter="deleteFiles"  @click="deleteFiles">Delete</li>
				<li id='copy-file' v-if="isWritable" @keyup.enter="copy"  @click="copy">Copy</li>
				<li id='cut-file' v-if="isWritable" @keyup.enter="cut"  @click="cut">Cut</li>
				<li id='paste-file' v-if="isPasteAvailable" @keyup.enter="paste"  @click="paste">Paste</li>
				<li id='share-file' v-if="allowShare" @keyup.enter="showShareWith"  @click="showShareWith">Share</li>
				<!-- <li id='create-file'  @keyup.enter="createTextFile" @click="createTextFile">Create Text file</li> -->
				<!-- <li id='profile-view' v-if="isProfileViewable" @click="showProfile(false)">Show Profile</li> -->
				<!-- <li id='file-search' v-if="isSearchable" @keyup.enter="openSearch(false)" @click="openSearch(false)">Search...</li> -->
			</DriveMenu>
		</transition>

		<Gallery
			v-if="showGallery"
			@hide-gallery="closeApps(false)"
			:files="sortedFiles"
			:initial-file-name="selectedFiles[0] == null ? '' : selectedFiles[0].getFileProperties().name">
		</Gallery>

		<hex
			v-if="showHexViewer"
			v-on:hide-hex-viewer="closeApps(false)"
			:file="selectedFiles[0]"
			:context="context">
		</hex>
		<pdf
			v-if="showPdfViewer"
			v-on:hide-pdf-viewer="closeApps(false)"
			:file="selectedFiles[0]"
			:context="context">
		</pdf>
		<code-editor
			v-if="showCodeEditor"
			v-on:hide-code-editor="closeApps(true); updateCurrentDir();"
			v-on:update-refresh="forceUpdate++"
			:file="selectedFiles[0]"
			:context="context"
			:messages="messages">
		</code-editor>
                <identity
                    v-if="showIdentityProof"
                    v-on:hide-identity-proof="closeApps(false)"
                    :file="selectedFiles[0]"
                    :context="context">
                </identity>

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
        <replace
            v-if="showReplace"
            v-on:hide-replace="showReplace = false"
            :replace_message='replace_message'
            :replace_body="replace_body"
            :consumer_cancel_func="replace_consumer_cancel_func"
            :consumer_func="replace_consumer_func"
            :showApplyAll=replace_showApplyAll>
        </replace>
		<error
			v-if="showError"
			@hide-error="showError = false"
			:title="errorTitle"
			:body="errorBody"
			:messageId="messageId">
		</error>
	</article>
</template>

<script>
const DriveHeader = require("../components/drive/DriveHeader.vue");
const DriveGrid = require("../components/drive/DriveGrid.vue");
const DriveGridCard = require("../components/drive/DriveGridCard.vue");
const DriveGridDrop = require("../components/drive/DriveGridDrop.vue");
const DriveTable = require("../components/drive/DriveTable.vue");
const Gallery = require("../components/drive/DriveGallery.vue");
const Identity = require("../components/identity-proof-viewer.vue");
const Share = require("../components/drive/DriveShare.vue");
const Search = require("../components/Search.vue");

const ProgressBar = require("../components/drive/ProgressBar.vue");
const DriveMenu = require("../components/drive/DriveMenu.vue");

const AppPrompt = require("../components/prompt/AppPrompt.vue");


const helpers = require("../mixins/storage/index.js");
const downloaderMixins = require("../mixins/downloader/index.js");

const router = require("../mixins/router/index.js");

module.exports = {
	components: {
		DriveHeader,
		DriveGrid,
		DriveGridCard,
		DriveGridDrop,
		DriveTable,
		DriveMenu,
		AppPrompt,
		ProgressBar,
		Gallery,
		Identity,
		Share,
		Search
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

			showAdmin: false,
			showGallery: false,
			showIdentityProof: false,
			showSocial: false,
			showSearch: false,
			showHexViewer: false,
			showCodeEditor: false,
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
			showProfileEditForm: false,
			showProfileViewForm: false,
			admindata: { pending: [] },
			profile: {
				firstName: "",
				lastName: "",
				biography: "",
				primaryPhone: "",
				primaryEmail: "",
				profileImage: "",
				status: "",
				webRoot: ""
			},
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
			prompt_action: 'ok',
			showPrompt: false,

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
			showSpinner: true,
			spinnerMessage: '',
			onUpdateCompletion: [], // methods to invoke when current dir is next refreshed
		};
	},

	mixins:[downloaderMixins, router],

        mounted: function() {
            this.updateCurrentDir();
        },
	computed: {
		...Vuex.mapState([
			'quotaBytes',
			'usageBytes',
			'context',
			'download',
			'open',
			'initPath',
			'isLoggedIn',
			'path'
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
					} else if (sortBy == "modified") {
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
		allowShare() {
			return this.isLoggedIn && this.path.length > 0;
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

			return this.currentDir.isWritable() && target.isDirectory();
		},
	},



	created() {
		this.init();
		this.onResize()
		// TODO: throttle onResize and make it global?
		window.addEventListener('resize', this.onResize, {passive: true} );
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
			console.log('drive oldPath: ', oldPath )
			console.log('drive newPath: ', newPath )
			if (newPath.length != oldPath.length) {
				this.updateCurrentDir();
			} else {
				for (var i = 0; i < newPath.length; i++) {
					if (newPath[i] != oldPath[i]) {
						this.updateCurrentDir();
						return;
					}
				}
			}

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
			'updateSocial'
		]),

		init() {
			const that = this;
			if (this.context != null && this.context.username == null) {
			    // open drive from a secret link
			    this.context.getEntryPath().thenApply(function (linkPath) {
				var path = that.initPath == null ? null : decodeURIComponent(that.initPath);
				if (path != null && (path.startsWith(linkPath) || linkPath.startsWith(path))) {
                                    that.$store.commit('SET_PATH', path.split('/').filter(n => n.length > 0))
				} else {
                                    that.$store.commit('SET_PATH', linkPath.split('/').filter(n => n.length > 0))
                                    if (that.download || that.open)
				        that.context.getByPath(that.getPath)
				 	.thenApply(function (file) {
				 	    file.get().getChildren(that.context.crypto.hasher, that.context.network).thenApply(function (children) {
				 		var arr = children.toArray();
				 		if (arr.length == 1) {
				 		    if (that.download) {
				 			that.downloadFile(arr[0]);
				 		    } else if (that.open) {
				 			var open = () => {
                                                            const filename = arr[0].getName();
                                                            that.selectedFiles = that.files.filter(f => f.getName() == filename);
						            that.openFile();
				 			};
				 			that.onUpdateCompletion.push(open);
				 		    }
				 		} else {
                                                    let app = that.getApp(file.get(), linkPath);
                                                    that.openFileOrDir(app, linkPath, "");
                                                }
				 	    })
				 	});
				}
			    });
			} else {
				const props = this.getPropsFromUrl();

				// const app = props == null ? null : props.app;
				// const path = props == null ? null : props.path;
				// const filename = props == null ? null : props.filename;

				const pathFromUrl = props == null ? null : props.path;
				const appFromUrl = props == null ? null : props.app;
				const filenameFromUrl = props == null ? null : props.filename;

				const apps = ['Calendar', 'NewsFeed', 'Social', 'Tasks']

				if (pathFromUrl !== null && !apps.includes(appFromUrl) ) {

					this.showSpinner = true;

					let open = () => { that.openInApp(filenameFromUrl, appFromUrl) };
					this.onUpdateCompletion.push(open);

					this.$store.commit('SET_PATH', pathFromUrl.split('/').filter(n => n.length > 0))

				} else {
					this.$store.commit('SET_PATH', [this.context.username])
					this.updateHistory('Drive', this.getPath,'')
				}

				this.updateSocial()
				this.updateUsage()
				this.updateQuota()

				this.context.getPaymentProperties(false).thenApply(function (paymentProps) {
					if (paymentProps.isPaid()) {
						that.paymentProperties = paymentProps;
					} else
						that.context.getPendingSpaceRequests().thenApply(reqs => {
							if (reqs.toArray([]).length > 0)
								that.$store.commit('USER_ADMIN', true);
						});
				});
			}
			this.showPendingServerMessages();
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
				throwable.printStackTrace();
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

		closeApps(refresh) {
		    this.showGallery = false;
                    this.showIdentityProof = false;
		    this.showPdfViewer = false;
		    this.showCodeEditor = false;
		    this.showTextViewer = false;
		    this.showHexViewer = false;
		    this.showSearch = false;
		    this.selectedFiles = [];
		    this.updateHistory("Drive", this.getPath, "");
                    if (refresh)
		        this.forceSharedRefreshWithUpdate++;
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

                        this.closeApps(false);
			this.updateHistory("Drive", path, "");
			this.updateCurrentDirectory(filename);
		},

		openInApp(filename, app) {
		    this.selectedFiles = this.files.filter(f => f.getName() == filename);
		    if (this.selectedFiles.length == 0)
			return;
                    
		    if (app == "Gallery")
			this.showGallery = true;
		    else if (app == "pdf")
			this.showPdfViewer = true;
		    else if (app == "editor")
			this.showCodeEditor = true;
		    else if (app == "identity-proof")
			this.showIdentityProof = true;
		    else if (app == "hex")
			this.showHexViewer = true;
		    else if (app == "search")
			this.showSearch = true;

                    this.updateHistory(app, this.getPath, "");
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
			this.updateHistory("search", this.getPath, "");

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
                    } else {
                        that.sharedWithDataUpdate();
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

		sharedWithDataUpdate() {

			if (this.selectedFiles.length != 1 || this.context == null) {
				this.sharedWithData = { read_shared_with_users: [], edit_shared_with_users: [] };
				return;
			}
			var file = this.selectedFiles[0];
			var filename = file.getFileProperties().name;

			let latestFile = this.files.filter(f => f.getName() == filename)[0];
			this.selectedFiles = [latestFile];
			let fileSharedWithState = this.sharedWithState.get(filename);
			let read_usernames = fileSharedWithState.readAccess.toArray([]);
			let edit_usernames = fileSharedWithState.writeAccess.toArray([]);
			this.sharedWithData = { read_shared_with_users: read_usernames, edit_shared_with_users: edit_usernames };
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
			if (this.supportsStreaming() || size < 50 * 1024 * 1024)
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

		mkdir(name) {
			this.showSpinner = true;
			var that = this;
			this.currentDir.mkdir(name, this.context.network, false, this.context.crypto)
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
					allFiles.push(item);
					that.getEntries(items, ++itemIndex, that, allFiles);
				}
			} else {
				this.processFileUpload(allFiles, true);
			}
		},
		uploadFiles(evt) {
			let uploadPath = this.getPath;
			var files = evt.target.files || evt.dataTransfer.files;
			this.processFileUpload(files, false);
		},
        extractDirectory(file) {
            if (file.fullPath != null) {
                let path = file.fullPath.substring(0, file.fullPath.lastIndexOf('/'));
                return path.split('/').filter(n => n.length > 0);
            }else if (file.webkitRelativePath == null) {
                return [];
            } else {
                let path = file.webkitRelativePath.substring(0, file.webkitRelativePath.lastIndexOf('/'));
                return path.split('/').filter(n => n.length > 0);
            }
        },
        collectFiles(fromDnd, index, filesToUpload, accumulatedFiles, collectFuture) {
            let that = this;
            if (index == filesToUpload.length) {
                collectFuture.complete(accumulatedFiles);
                return;
            }
            if (fromDnd) {
                filesToUpload[index].file(function (fileEntry) {
                    if (fileEntry.name != '.DS_Store') {
                        fileEntry.directory = that.extractDirectory(filesToUpload[index]);
                        accumulatedFiles.push(fileEntry);
                    }
                    that.collectFiles(fromDnd, index + 1, filesToUpload, accumulatedFiles, collectFuture);
                });
            } else {
                let fileEntry = filesToUpload[index];
                if (fileEntry.name != '.DS_Store') {
                    fileEntry.directory = this.extractDirectory(fileEntry);
                    accumulatedFiles.push(fileEntry);
                }
                this.collectFiles(fromDnd, index + 1, filesToUpload, accumulatedFiles, collectFuture);
            }
        },
		processFileUpload(filesToUpload, fromDnd) {
            let collectFuture = peergos.shared.util.Futures.incomplete();
            this.collectFiles(fromDnd, 0, filesToUpload, [], collectFuture);
            let that = this;
            collectFuture.thenApply(files => {
                let totalSize = 0;
                for(var i=0; i < files.length; i++) {
                    totalSize += (files[i].size + (4096 - (files[i].size % 4096)));
                }
                let spaceAfterOperation = this.checkAvailableSpace(totalSize);
                if (spaceAfterOperation < 0) {
                    let errMsg = "File copy operation exceeds available Space\n" + "Please free up " + helpers.convertBytesToHumanReadable('' + -spaceAfterOperation) + " and try again";
                    that.$toast.error(errMsg, {timeout:false, id: 'upload'})
                } else {
                    //resetting .value tricks browser into allowing subsequent upload of same file(s)
                    document.getElementById('uploadFileInput').value = "";
                    document.getElementById('uploadDirectoriesInput').value = "";
                    let future = peergos.shared.util.Futures.incomplete();
                    let progressBars = [];
                    for(var i=0; i < files.length; i++) {
                        let that = this;
                        var thumbnailAllocation = Math.min(100000, files[i].size / 10);
                        var resultingSize = files[i].size + thumbnailAllocation;
                        var progress = {
                            title:"Encrypting and uploading " + files[i].name,
                            done:0,
                            max:resultingSize,
                            name: files[i].name
                        };
                        that.$toast({component: ProgressBar,props:  progress} , { icon: false , timeout:false, id: files[i].name})
                        progressBars.push(progress);
                    }
                    const uploadParams = {
                        applyReplaceToAll: false,
                        replaceFile: false,
                        filesUploaded: 0
                    }
                    that.reduceAllUploads(0, files, future, uploadParams, progressBars);
                    future.thenApply(done => {
                        console.log("upload complete");
                    });
                }
            });
        },
        reduceAllUploads: function(index, files, future, uploadParams, progressBars) {
            let that = this;
            if (index == files.length) {
                future.complete(true);
            } else {
                this.uploadFile(files[index], uploadParams, progressBars[index]).thenApply(result => {
                    if (result != null) {
                        that.reduceAllUploads(index+1, files, future, uploadParams, progressBars);
                    } else {
                        future.complete(false);
                    }
                });
            }
        },
        getParentDirectory(file) {
            let future = peergos.shared.util.Futures.incomplete();
            if (file.directory.length == 0) {
                future.complete(this.currentDir);
            } else {
                let relativePath = peergos.client.PathUtils.directoryToPath(file.directory);
                this.currentDir.getOrMkdirs(relativePath,this.context.network, false, this.context.crypto).thenApply(function (updatedDir) {
                    future.complete(updatedDir);
                });
            }
            return future;
        },
        uploadFile: function(file, uploadParams, progress) {
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            this.getParentDirectory(file).thenApply(function (updatedDir) {
                updatedDir.hasChild(file.name, that.context.crypto.hasher, that.context.network).thenApply(function (alreadyExists) {
                    if (alreadyExists) {
                        if (uploadParams.applyReplaceToAll) {
                            if (uploadParams.replaceFile) {
                                that.uploadFileJS(updatedDir, file, true, future, uploadParams, progress)
                            } else {
                                that.$toast.dismiss(file.name);
                                future.complete(true);
                            }
                        } else {
                            that.confirmReplaceFile(file,
                                (applyToAll) => {
                                    uploadParams.applyReplaceToAll = applyToAll;
                                    uploadParams.replaceFile = false;
                                    that.$toast.dismiss(file.name);
                                    future.complete(true);
                                },
                                (applyToAll) => {
                                    uploadParams.applyReplaceToAll = applyToAll;
                                    uploadParams.replaceFile = true;
                                    that.uploadFileJS(updatedDir, file, true, future, uploadParams, progress)
                                }
                            );
                        }
                    } else {
                        that.uploadFileJS(updatedDir, file, false, future, uploadParams, progress);
                    }
                });
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
		uploadFileJS(updatedDir, file, overwriteExisting, future, uploadParams, progress) {
            let that = this;
            let updateProgressBar = function(len){
                progress.done += len.value_0;
                that.$toast.update(progress.name,
                                   {content:
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
			var reader = new browserio.JSFileReader(file);
			var java_reader = new peergos.shared.user.fs.BrowserFileReader(reader);
			let apparentSize = file.size + (4096 - (file.size % 4096));
            let spaceAfterOperation = that.checkAvailableSpace(apparentSize);
            if (spaceAfterOperation < 0) {
                that.$toast.error(`Unable to upload: ${file.name} File size exceeds available space. Please free up ${that.convertBytesToHumanReadable('' + -spaceAfterOperation)} and try again`, {timeout:false})
                future.complete(null);
                return;
            }
            updatedDir.uploadFileJS(file.name, java_reader, (file.size - (file.size % Math.pow(2, 32))) / Math.pow(2, 32), file.size,
                overwriteExisting, overwriteExisting ? true : false, that.context.network, that.context.crypto, updateProgressBar,
                that.context.getTransactionService()
            ).thenApply(function (res) {
                uploadParams.filesUploaded++;
                const thumbnailAllocation = Math.min(100000, file.size / 10);
                updateProgressBar({value_0:thumbnailAllocation});
                if (file.directory.length == 0) {
                    that.currentDir = res;
                }
                let refreshDir = uploadParams.filesUploaded == 1 || file.directory.length <= 1;
                that.context.getSpaceUsage().thenApply(u => {
                    that.$store.commit('SET_USAGE', u);
                    if (refreshDir) {
                        that.updateCurrentDirectory(null, () => {
                            future.complete(true);
                        });
                    } else {
                        future.complete(true);
                    }
                });
            }).exceptionally(function (throwable) {
                that.$toast.update(file.name, {
                    content:'Error uploading file ${file.name} : ${throwable.getMessage()}'
                });
                console.log("File upload error:" + throwable.toString());
                that.context.getSpaceUsage().thenApply(u => {
                    that.$store.commit('SET_USAGE', u);
                    future.complete(false);
                });
            })
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

		showTextEditor() {
			let that = this;
			this.select_placeholder = 'filename';
			this.select_message = 'Create or open Text file';
			// this.clearTabNavigation();
			this.showSpinner = true;
			this.context.getByPath(this.context.username).thenApply(homeDir => {
				homeDir.get().getChildren(that.context.crypto.hasher, that.context.network).thenApply(function (children) {
					let childrenArray = children.toArray();
					let textFiles = childrenArray.filter(f => f.getFileProperties().mimeType.startsWith("text/"));
					that.select_items = textFiles.map(f => f.getName()).sort(function (a, b) {
						return a.localeCompare(b);
					});
					that.select_consumer_func = function (select_result) {
						if (select_result === null)
							return;
						let foundIndex = textFiles.findIndex(v => v.getName() === select_result);
						if (foundIndex == -1) {
							that.showSpinner = true;
							// let context = that.getContext();
							let empty = peergos.shared.user.JavaScriptPoster.emptyArray();
							let reader = new peergos.shared.user.fs.AsyncReader.ArrayBacked(empty);
							homeDir.get().uploadFileJS(select_result, reader, 0, 0,
								false, false, that.context.network, that.context.crypto, function (len) { },
								that.context.getTransactionService()
							).thenApply(function (updatedDir) {
								updatedDir.getChild(select_result, that.context.crypto.hasher, that.context.network).thenApply(function (textFileOpt) {
									that.showSpinner = false;
									that.selectedFiles = [textFileOpt.get()];
									// that.clearTabNavigation();
									that.showCodeEditor = true;
									that.updateHistory("editor", that.getPath, "");
								});
							}).exceptionally(function (throwable) {
								that.showSpinner = false;
								that.errorTitle = 'Error creating file';
								that.errorBody = throwable.getMessage();
								that.showError = true;
							});
						} else {
							that.selectedFiles = [textFiles[foundIndex]];
							that.showCodeEditor = true;
							that.updateHistory("editor", that.getPath, "");
						}
					};
					that.showSpinner = false;
					that.showSelect = true;
				});
			});
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

		paste() {
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
				} else if (clipboard.op == "copy") {
					console.log("paste-copy");
					this.calculateTotalFileSize(clipboard.fileTreeNode, clipboard.path).thenApply(totalSize => {
						let spaceAfterOperation = that.checkAvailableSpace(totalSize);
						if (spaceAfterOperation < 0) {
                                                    let errMsg = "File copy operation exceeds available Space\n" + "Please free up " + helpers.convertBytesToHumanReadable('' + -spaceAfterOperation) + " and try again";
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
					});
				}
				this.clipboard.op = null;
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
						accumulator.walkCounter++;
						accumulator.size += 4096;
						let newPath = path + "/" + childProps.name;
						that.calculateDirectorySize(child, newPath, accumulator, future);
					} else {
						let size = that.getFileSize(childProps);
						accumulator.size += (size + (4096 - (size % 4096)));
					}
				}
				accumulator.walkCounter--;
				if (accumulator.walkCounter == 0) {
					future.complete(accumulator.size);
				}
			});
		},
		calculateTotalFileSize(file, path) {
			let future = peergos.shared.util.Futures.incomplete();
			if (file.isDirectory()) {
				this.calculateDirectorySize(file, path + file.getFileProperties().name,
					{ size: 4096, walkCounter: 1 }, future);
			} else {
				future.complete(this.getFileSize(file.getFileProperties()));
			}
			return future;
		},
		checkAvailableSpace(fileSize) {
			return Number(this.quotaBytes.toString()) - (Number(this.usageBytes.toString()) + fileSize);
		},
		showShareWithForProfile(field, fieldName) {
			let dirPath = this.context.username + "/.profile/";
			this.showShareWithForFile(dirPath, field, false, false, fieldName);
		},
		showShareWithFromApp(app, filename, allowReadWriteSharing, allowCreateSecretLink, nameToDisplay) {
			let dirPath = this.context.username + "/.apps/" + app;
			this.showShareWithForFile(dirPath, filename, allowReadWriteSharing, allowCreateSecretLink, nameToDisplay);
		},
		showShareWithForFile(dirPath, filename, allowReadWriteSharing, allowCreateSecretLink, nameToDisplay) {
			let that = this;

			this.context.getByPath(dirPath)
				.thenApply(function (dir) {
					dir.get().getChild(filename, that.context.crypto.hasher, that.context.network).thenApply(function (child) {
						let file = child.get();
						if (file == null) {
							return;
						}
						that.filesToShare = [file];
						that.pathToFile = dirPath.split('/');
						let directoryPath = peergos.client.PathUtils.directoryToPath(that.pathToFile);
						taht.context.getDirectorySharingState(directoryPath).thenApply(function (updatedSharedWithState) {
							let fileSharedWithState = updatedSharedWithState.get(file.getFileProperties().name);
							let read_usernames = fileSharedWithState.readAccess.toArray([]);
							let edit_usernames = fileSharedWithState.writeAccess.toArray([]);
							that.sharedWithData = { read_shared_with_users: read_usernames, edit_shared_with_users: edit_usernames };
							that.fromApp = true;
							that.displayName = nameToDisplay != null && nameToDisplay.length > 0 ?
								nameToDisplay : file.getFileProperties().name;
							that.allowReadWriteSharing = allowReadWriteSharing;
							that.allowCreateSecretLink = allowCreateSecretLink;
							that.showShare = true;
						});
					})
				});
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
			this.updateHistory("Drive", path, "");
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

		openFile() {
		    // TODO: once we support selecting files re-enable this
		    //if (this.selectedFiles.length == 0)
		    //    return;
		    this.closeMenu();
		    if (this.selectedFiles.length == 0)
			return;
                    
		    var file = this.selectedFiles[0];
		    var filename = file.getName();
                    
                    var app = this.getApp(file, this.getPath);
                    if (app === "Gallery")
                        this.showGallery = true;
                    else if (app === "pdf")
                        this.showPdfViewer = true;
                    else if (app === "editor")
                        this.showCodeEditor = true;
                    else if (app === "identity-proof")
                        this.showIdentityProof = true;
                    else if (app === "hex")
                        this.showHexViewer = true;

                    this.openFileOrDir(app, this.getPath, filename)
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

		createTextFile() {
			this.prompt_placeholder = 'File name';
			this.prompt_message = 'Enter a file name';
			this.prompt_value = '';
			this.prompt_consumer_func = function (prompt_result) {
				if (prompt_result === null)
					return;
				let fileName = prompt_result.trim();
				if (fileName === '')
					return;
				this.uploadEmptyFile(fileName);
			}.bind(this);
			this.showPrompt = true;
		},

		uploadEmptyFile(filename) {
			this.showSpinner = true;
			let that = this;
			// let context = this.getContext();
			let empty = peergos.shared.user.JavaScriptPoster.emptyArray();
			let reader = new peergos.shared.user.fs.AsyncReader.ArrayBacked(empty);
			this.currentDir.uploadFileJS(filename, reader, 0, 0,
				false, false, this.context.network, this.context.crypto, function (len) { },
				this.context.getTransactionService()
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

				this.confirmDelete(file, () => {
					that.deleteOne(file, parent, this.context);
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
