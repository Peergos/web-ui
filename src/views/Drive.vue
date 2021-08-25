<template>
	<div>
		<input type="file" id="uploadFileInput" @change="uploadFiles" style="display:none;" multiple />
		<input type="file" id="uploadDirectoriesInput" @change="uploadFiles" style="display:none;" multiple directory mozDirectory webkitDirectory/>

		<spinner v-if="showSpinner" :message="spinnerMessage"></spinner>

		<a id="downloadAnchor" style="display:none"></a>

		<DriveHeader
			:gridView="isGrid"
			:isWritable="isWritable"
			:path="path"
			@switchView="switchView()"
			@goBackToLevel="goBackToLevel($event)"
			@askMkdir="askMkdir()"
		/>

		<AppPrompt
			v-if="showPrompt"
			@hide-prompt="closePrompt()"
			:message='prompt_message'
			:placeholder="prompt_placeholder"
			:max_input_size="prompt_max_input_size"
			:value="prompt_value"
			:consumer_func="prompt_consumer_func"
		/>


		<div v-if="viewMenu && (isNotHome || isPasteAvailable || isNotBackground)">
			<nav>
				<ul id="right-click-menu" tabindex="-1" v-if="viewMenu && (isNotHome || isPasteAvailable || isNotBackground)" @blur="closeMenu" v-bind:style="{top:top, left:left}">
					<li id='gallery' class="context-menu-item" @keyup.enter="gallery" v-if="canOpen" @click="gallery">View</li>
					<li id='create-file' class="context-menu-item" @keyup.enter="createTextFile" v-if="!isNotBackground" @click="createTextFile">Create Text file</li>
					<li id='open-file' class="context-menu-item" @keyup.enter="downloadAll" v-if="canOpen" @click="downloadAll">Download</li>
					<li id='rename-file' class="context-menu-item" @keyup.enter="rename" v-if="isNotBackground && isWritable" @click="rename">Rename</li>
					<li id='delete-file' class="context-menu-item" @keyup.enter="deleteFiles" v-if="isNotBackground && isWritable" @click="deleteFiles">Delete</li>
					<li id='copy-file' class="context-menu-item" @keyup.enter="copy" v-if="isNotBackground && isWritable" @click="copy">Copy</li>
					<li id='cut-file' class="context-menu-item" @keyup.enter="cut" v-if="isNotBackground && isWritable" @click="cut">Cut</li>
					<li id='paste-file' class="context-menu-item" @keyup.enter="paste" v-if="isPasteAvailable" @click="paste">Paste</li>
					<li id='share-file' class="context-menu-item" @keyup.enter="showShareWith" v-if="(isNotHome || isNotBackground) && isLoggedIn" @click="showShareWith">Share</li>
					<li id='file-search' class="context-menu-item" @keyup.enter="openSearch(false)" v-if="isSearchable" @click="openSearch(false)">Search...</li>
					<li id='close-context-menu-item' class="context-menu-item hidden-context-menu-item" @keyup.enter="closeMenu" @click="closeMenu">Close</li>
				</ul>
			</nav>
		</div>

		<gallery
			v-if="showGallery"
			@hide-gallery="closeApps()"
			:files="sortedFiles"
			:context="context"
			:initial-file-name="selectedFiles[0] == null ? '' : selectedFiles[0].getFileProperties().name">
		</gallery>

		<div v-if="viewMenu && isProfileViewable()">
			<ul id="right-click-menu-profile" tabindex="-1"  @blur="closeMenu" v-bind:style="{top:top, left:left}">
			<li id='profile-view' @click="showProfile(false)">Show Profile</li>
			</ul>
		</div>


		<div v-if="conversationMonitors.length>0" class="messageholder">
			<messagebar :replyToMessage="replyToMessage"
				:dismissMessage="dismissMessage"
				v-for="message in conversationMonitors"
				:key="message.id"
				:id="message.id"
				:date="message.sendTime"
				:contents="message.contents.length > 50 ? message.contents.substring(0,47) + '...' : message.contents"
			/>
		</div>


		<div id="dnd"
			@drop="dndDrop($event)"
			@dragover.prevent
			:class="{ not_owner: isNotMe }"
			@contextmenu="openMenu($event)"
		>
			<transition name="fade" mode="out-in" appear>

				<DriveGrid v-if="isGrid" appear>
					<DriveGridCard v-for="(file, index) in sortedFiles"
						:key="file.getFileProperties().name"
						:filename="file.getFileProperties().name"
						:src="getThumbnailURL(file)"
						:type="file.getFileProperties().getType()"
						@click.native="navigateOrMenuTab($event, file, true)"
					/>
				</DriveGrid>


				<!-- <div class="grid" v-if="isGrid">

					<span class="column grid-item" v-for="(file, index) in sortedFiles" @keyup.enter="navigateOrMenuTab($event, file, true)">
						<span class="grid_icon_wrapper fa" :id="index" draggable="true" @dragover.prevent @dragstart="dragStart($event, file)" @drop="drop($event, file)">
							<a class="picon" v-bind:id="file.getFileProperties().name" @contextmenu="openMenu($event, file)">
								<span v-if="!file.getFileProperties().thumbnail.isPresent()" @click="navigateOrMenu($event, file)" @contextmenu="openMenu($event, file)" v-bind:class="[getFileClass(file), getFileIcon(file), 'picon']"> </span>
								<img id="thumbnail" v-if="file.getFileProperties().thumbnail.isPresent()" @click="navigateOrMenu($event, file)" @contextmenu="openMenu($event, file)" v-bind:src="getThumbnailURL(file)"/>
							</a>
							<div class="content filename" >
								<div v-bind:class="{ noselect: true, shared: isShared(file) }">{{ file.getFileProperties().name }}</div>
							</div>
						</span>
					</span>

					<div v-if="sortedFiles.length==0 && currentDir != null && currentDir.isWritable()" class="instruction">
						Upload a file by dragging and dropping here or clicking the <span class="fa fa-upload"/> icon
					</div>

					<center v-if="isSecretLink" class="bottom-message">Join the revolution!<br/>
						<button class="btn btn-lg btn-success" @click="gotoSignup()">Sign up to Peergos</button>
					</center>
				</div> -->

				<div class="table-responsive" v-else>
					<table class="table">
						<thead>
							<tr style="cursor:pointer;">
								<th @click="setSortBy('name')">Name <span v-if="sortBy=='name'" :class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
								<th @click="setSortBy('size')">Size <span v-if="sortBy=='size'" :class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
								<th @click="setSortBy('type')">Type <span v-if="sortBy=='type'" :class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
								<th @click="setSortBy('modified')">Modified <span v-if="sortBy=='modified'" :class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
							</tr>
						</thead>
						<tbody>
							<tr v-for="file in sortedFiles" @keyup.enter="navigateOrMenuTab($event, file, true)" class="grid-item">
								<td :id="file.getFileProperties().name"  @click="navigateOrMenu($event, file)" @contextmenu="openMenu($event, file)" style="cursor:pointer" v-bind:class="{ shared: isShared(file) }">{{ file.getFileProperties().name }}</td>
								<td> {{ getFileSize(file.getFileProperties()) }} </td>
								<td>{{ file.getFileProperties().getType() }}</td>
								<td>{{ formatDateTime(file.getFileProperties().modified) }}</td>
							</tr>
						</tbody>
					</table>
				</div>
			</transition>
		</div>

		<error
			v-if="showError"
			@hide-error="showError = false"
			:title="errorTitle"
			:body="errorBody"
			:messageId="messageId">
		</error>

	</div>
</template>

<script>
const DriveHeader = require("../components/drive/DriveHeader.vue");
const DriveGrid = require("../components/drive/DriveGrid.vue");
const DriveGridCard = require("../components/drive/DriveGridCard.vue");
const ProgressBar = require("../components/drive/ProgressBar.vue");

const AppPrompt = require("../components/prompt/AppPrompt.vue");


const mixins = require("../mixins/downloader/index.js");

module.exports = {
	components: {
		DriveHeader,
		DriveGrid,
		DriveGridCard,
		AppPrompt,
		ProgressBar
	},
	data() {
		return {

			isGrid: true,
			view: "files",
			path: [],
			searchPath: null,
			currentDir: null,
			files: [],
			sortBy: "name",
			normalSortOrder: true,
			clipboard: {},
			selectedFiles: [],
			url: null,
			viewMenu: false,
			ignoreEvent: false,
			top: "0px",
			left: "0px",
			showTour: false,
			showShare: false,
			sharedWithState: null,
			sharedWithData: { "edit_shared_with_users": [], "read_shared_with_users": [] },
			forceSharedRefreshWithUpdate: 0,
			isNotBackground: true,

			showAdmin: false,
			showAppgrid: false,
			showGallery: false,
			showSocial: false,
			showTimeline: false,
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
			showSettingsMenu: false,
			showUploadMenu: false,
			showFeedbackForm: false,
			showTodoBoardViewer: false,
			currentTodoBoardName: null,
			showCalendarViewer: false,
			showProfileEditForm: false,
			showProfileViewForm: false,
			admindata: { pending: [] },
			social: {
				pending: [],
				friends: [],
				followers: [],
				following: [],
				groupsNameToUid: [],
				groupsUidToName: [],
			},
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
			showSelect: false,
			showPrompt: false,
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
			navigationViaTabKey: false
		};
	},
	props: ["initPath", "openFile", "initiateDownload"],

	mixins:[mixins],

	computed: {
		...Vuex.mapState([
			'quotaBytes',
			'usageBytes',
			'context'
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
				var me = this.username;
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

		isSecretLink() {
			return this.context != null && this.context.username == null;
		},

		isLoggedIn() {
			return !this.isSecretLink;
		},

		isNotHome() {
			return this.path.length > 1;
		},

		isNotMe() {
			if (this.currentDir == null)
				return true;

			var owner = this.currentDir.getOwnerName();
			var me = this.username;
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

			if (this.selectedFiles.length != 1)
				return false;
			var target = this.selectedFiles[0];

			if (this.clipboard.fileTreeNode.samePointer(target)) {
				return false;
			}

			return this.currentDir.isWritable() && target.isDirectory();
		},


		username() {

			if (this.context == null)
				return "";
			return this.context.username;
		}
	},



	created() {
		console.debug('Filesystem module created!');

		this.showAppgrid = !this.isSecretLink;
		if (this.isSecretLink)
			this.view = "files";
		this.showTour = this.newsignup;
		this.init();
		window.onhashchange = this.onUrlChange;
		this.buildTabNavigation();
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
		]),

		init() {
			const that = this;
			if (this.context != null && this.context.username == null) {
				// from a secret link
				// this.context.getEntryPath().thenApply(function (linkPath) {
				// 	var path = that.initPath == null ? null : decodeURIComponent(that.initPath);
				// 	if (path != null && (path.startsWith(linkPath) || linkPath.startsWith(path))) {
				// 		that.changePath(path);
				// 	} else {
				// 		that.changePath(linkPath);
				// 		that.context.getByPath(that.getPath())
				// 			.thenApply(function (file) {
				// 				file.get().getChildren(that.context.crypto.hasher, that.context.network).thenApply(function (children) {
				// 					var arr = children.toArray();
				// 					if (arr.length == 1) {
				// 						if (that.initiateDownload) {
				// 							that.downloadFile(arr[0]);
				// 						} else if (that.openFile) {
				// 							var open = () => {
				// 								that.updateFiles(arr[0].getFileProperties().name);
				// 							};
				// 							that.onUpdateCompletion.push(open);
				// 						}
				// 					}
				// 				})
				// 			});
				// 	}
				// });
			} else {
				const props = this.getPropsFromUrl();
				var pathFromUrl = props == null ? null : props.path;
				if (pathFromUrl != null) {
					this.showSpinner = true;
					const filename = props.filename;
					const app = props.app;
					var open = () => {
						that.openInApp(filename, app);
					};
					this.onUpdateCompletion.push(open);
					this.path = pathFromUrl.split('/').filter(n => n.length > 0);
				} else {
					this.path = [this.context.username];
					this.updateHistory("filesystem", this.getPath(), "");
				}
				this.updateSocial();
				this.updateUsage();
				this.updateQuota();
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

		clearTabNavigation() {
			let that = this;
			Vue.nextTick(function () {
				let gridItems = document.getElementsByClassName('grid-item');
				let appGridItems = document.getElementsByClassName('app-grid-item');
				let toolbarItems = document.getElementsByClassName('toolbar-item');
				let overlayItems = document.getElementsByClassName('overlay-item');
				for (var g = 0; g < overlayItems.length; g++) {
					overlayItems[g].removeAttribute("tabindex");
				}
				for (var i = 0; i < gridItems.length; i++) {
					gridItems[i].removeAttribute("tabindex");
				}
				for (var j = 0; j < appGridItems.length; j++) {
					appGridItems[j].removeAttribute("tabindex");
				}
				for (var k = 0; k < toolbarItems.length; k++) {
					toolbarItems[k].removeAttribute("tabindex");
				}
			});
		},
		buildTabNavigation() {
			let that = this;
			Vue.nextTick(function () {
				let gridItems = document.getElementsByClassName('grid-item');
				let appGridItems = document.getElementsByClassName('app-grid-item');
				let uploadItems = document.getElementsByClassName('upload-item');
				let toolbarItems = document.getElementsByClassName('toolbar-item');
				let settingsItems = document.getElementsByClassName('settings-item');
				let overlayItems = document.getElementsByClassName('overlay-item');
				for (var g = 0; g < overlayItems.length; g++) {
					overlayItems[g].setAttribute("tabindex", 0);
				}
				for (var l = 0; l < toolbarItems.length; l++) {
					toolbarItems[l].setAttribute("tabindex", 0);
				}
				if (that.showAppgrid) {
					if (that.showUploadMenu || that.showSettingsMenu || that.viewMenu) {
						for (var j = 0; j < appGridItems.length; j++) {
							appGridItems[j].removeAttribute("tabindex");
						}
					} else {
						for (var j = 0; j < appGridItems.length; j++) {
							appGridItems[j].setAttribute("tabindex", 0);
						}
					}
				} else {
					if (that.showUploadMenu || that.showSettingsMenu || that.viewMenu) {
						for (var i = 0; i < gridItems.length; i++) {
							gridItems[i].removeAttribute("tabindex");
						}
					} else {
						for (var i = 0; i < gridItems.length; i++) {
							gridItems[i].setAttribute("tabindex", 0);
						}
					}
				}
				if (that.showUploadMenu) {
					that.showSettingsMenu = false;
					for (var k = 0; k < uploadItems.length; k++) {
						uploadItems[k].setAttribute("tabindex", 0);
					}
					for (var l = 0; l < toolbarItems.length; l++) {
						toolbarItems[l].removeAttribute("tabindex");
					}
					// document.getElementById("uploadButton").setAttribute("tabindex", 0);
				} else if (that.showSettingsMenu) {
					that.showUploadMenu = false;
					for (var m = 0; m < settingsItems.length; m++) {
						settingsItems[m].setAttribute("tabindex", 0);
					}
					for (var l = 0; l < toolbarItems.length; l++) {
						toolbarItems[l].removeAttribute("tabindex");
					}
					document.getElementById("settings-menu").setAttribute("tabindex", 0);
				} else if (that.viewMenu) { //context menu
					that.showSettingsMenu = false;
					that.showUploadMenu = false;
					for (var l = 0; l < toolbarItems.length; l++) {
						toolbarItems[l].removeAttribute("tabindex");
					}
				}
				if (!that.showUploadMenu) {
					for (var k = 0; k < uploadItems.length; k++) {
						uploadItems[k].removeAttribute("tabindex");
					}
				}
				if (!that.showSettingsMenu) {
					for (var m = 0; m < settingsItems.length; m++) {
						settingsItems[m].removeAttribute("tabindex");
					}
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
				throwable.printStackTrace();
			});
		},
		showFiles(data) {
			this.showAppgrid = false;
			this.view = "files";
			this.path = data.path;
			this.buildTabNavigation();
		},
		processPending() {
			for (var i = 0; i < this.onUpdateCompletion.length; i++) {
				this.onUpdateCompletion[i].call();
			}
			this.onUpdateCompletion = [];
		},

		updateHistory(app, path, filename) {
			if (this.isSecretLink)
				return;
			const currentProps = this.getPropsFromUrl();
			const pathFromUrl = currentProps == null ? null : currentProps.path;
			const appFromUrl = currentProps == null ? null : currentProps.app;
			if (path == pathFromUrl && app == appFromUrl)
				return;
			var rawProps = propsToFragment({ app: app, path: path, filename: filename });
			var props = this.encryptProps(rawProps);
			window.location.hash = "#" + propsToFragment(props);
		},

		getPropsFromUrl() {
			try {
				return this.decryptProps(fragmentToProps(window.location.hash.substring(1)));
			} catch (e) {
				return null;
			}
		},

		encryptProps(props) {
			var both = this.context.encryptURL(props)
			const nonce = both.base64Nonce;
			const ciphertext = both.base64Ciphertext;
			return { nonce: nonce, ciphertext: ciphertext };
		},

		decryptProps(props) {
			if (this.isSecretLink)
				return path;

			return fragmentToProps(this.context.decryptURL(props.ciphertext, props.nonce));
		},

		onUrlChange() {
			const props = this.getPropsFromUrl();
			const path = props == null ? null : props.path;
			const filename = props == null ? null : props.filename;
			const app = props == null ? null : props.app;
			const that = this;
			const differentPath = path != null && path != this.getPath();
			if (differentPath)
				this.path = path.split("/").filter(x => x.length > 0);

			if (app == "filesystem") {
				this.showGallery = false;
				this.showPdfViewer = false;
				this.showCodeEditor = false;
				this.showTextViewer = false;
				this.showHexViewer = false;
				this.showTimeline = false;
				this.showSearch = false;
				this.showTodoBoardViewer = false;
				this.showCalendarViewer = false;
			} else {
				if (!differentPath)
					this.openInApp(filename, app);
				else
					this.onUpdateCompletion.push(() => {
						that.openInApp(filename, app);
					});
			}
		},

		closeApps() {
			this.showGallery = false;
			this.showPdfViewer = false;
			this.showCodeEditor = false;
			this.showTextViewer = false;
			this.showHexViewer = false;
			this.showTodoBoardViewer = false;
			this.showCalendarViewer = false;
			this.selectedFiles = [];
			this.updateHistory("filesystem", this.getPath(), "");
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
			this.path = path ? path.split('/') : [];
			this.updateHistory("filesystem", path, "");
			this.updateCurrentDirectory(filename);
		},
		openInApp(filename, app) {
			this.selectedFiles = this.files.filter(f => f.getName() == filename);
			if (this.selectedFiles.length == 0)
				return;
			if (app == "gallery")
				this.showGallery = true;
			else if (app == "pdf")
				this.showPdfViewer = true;
			else if (app == "editor")
				this.showCodeEditor = true;
			else if (app == "hex")
				this.showHexViewer = true;
			else if (app == "todo")
				this.showTodoBoardViewer = true;
			else if (app == "calendar")
				this.showCalendarViewer = true;
			else if (app == "timeline")
				this.showTimeline = true;
			else if (app == "search")
				this.showSearch = true;
		},
		openSearch(fromRoot) {
			var path = fromRoot ? "/" + this.getContext().username : this.getPath();
			if (!fromRoot) {
				if (this.isNotBackground) {
					path = path + this.selectedFiles[0].getFileProperties().name;
				} else {
					path = path.substring(0, path.length - 1);
				}
			}
			this.searchPath = path;
			this.showSearch = true;
			this.updateHistory("search", this.getPath(), "");
			this.closeMenu();
		},
		closeSearch() {
			this.showSearch = false;
			this.buildTabNavigation();
		},
		openAppFromFolder() {
			let path = this.getPath();
			let pathItems = path.split('/').filter(n => n.length > 0);
			if (pathItems.length == 5 && pathItems[1] == '.apps') {
				if (pathItems[2] == 'calendar' && pathItems[3] == 'data') {
					this.importSharedCalendar(path.substring(0, path.length - 1), this.currentDir, true, pathItems[0]);
					this.changePath("/");
				}
			}
		},
		updateCurrentDir() {
			this.updateCurrentDirectory(null);
		},
		updateCurrentDirectory(selectedFilename) {

			if (this.context == null)
				return Promise.resolve(null);
			var path = this.getPath();
			var that = this;
			this.context.getByPath(path).thenApply(function (file) {
				that.currentDir = file.get();
				that.updateFiles(selectedFilename);
			}).exceptionally(function (throwable) {
				console.log(throwable.getMessage());
			});
		},

		updateFiles(selectedFilename) {
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
					that.buildTabNavigation();
					if (selectedFilename != null) {
						that.selectedFiles = that.files.filter(f => f.getName() == selectedFilename);
						that.gallery();
					} else {
						that.sharedWithDataUpdate();
						that.openAppFromFolder();
					}
				}).exceptionally(function (throwable) {
					console.log(throwable.getMessage());
				});
			}).exceptionally(function (throwable) {
				console.log(throwable.getMessage());
			});
		},

		updateSocial(callbackFunc) {

            if (this.context == null || this.context.username == null)
                this.social = {
                    pending: [],
		    friends: [],
                    followers: [],
                    following: [],
		    pendingOutgoing: [],
		    annotations: {},
		    groupsNameToUid: {},
		    groupsUidToName: {}
                };
	    else {
		    var that = this;
            this.context.getSocialState().thenApply(function(socialState){
		    var annotations = {};
		    socialState.friendAnnotations.keySet().toArray([]).map(name => annotations[name]=socialState.friendAnnotations.get(name));
		    var followerNames = socialState.followerRoots.keySet().toArray([]);
		    var followeeNames = socialState.followingRoots.toArray([]).map(function(f){return f.getFileProperties().name});
		    var friendNames = followerNames.filter(x => followeeNames.includes(x));
		    followerNames = followerNames.filter(x => !friendNames.includes(x));
		    followeeNames = followeeNames.filter(x => !friendNames.includes(x));

		    var groupsUidToName = {};
		    socialState.uidToGroupName.keySet().toArray([]).map(uid => groupsUidToName[uid]=socialState.uidToGroupName.get(uid));
		    var groupsNameToUid = {};
		    socialState.groupNameToUid.keySet().toArray([]).map(name => groupsNameToUid[name]=socialState.groupNameToUid.get(name));

		    var pendingOutgoingUsernames = [];
		    socialState.pendingOutgoing.toArray([]).map(u => pendingOutgoingUsernames.push(u));

		    that.social = {
		                pendingOutgoing: pendingOutgoingUsernames,
                        pending: socialState.pendingIncoming.toArray([]),
			friends: friendNames,
                        followers: followerNames,
                        following: followeeNames,
			annotations: annotations,
			    groupsNameToUid: groupsNameToUid,
			    groupsUidToName: groupsUidToName
		    };
		    if (callbackFunc != null) {
		        callbackFunc(true);
		    }
                }).exceptionally(function(throwable) {
		    that.errorTitle = 'Error retrieving social state';
		    that.errorBody = throwable.getMessage();
		    that.showError = true;
		    that.showSpinner = false;
            if (callbackFunc != null) {
                callbackFunc(false);
            }
		});
	    }
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
		// getContext() {
		// 	return this.context;
		// },

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
			var extra = file.isDirectory() ? " and all its contents" : "";
			this.warning_message = 'Are you sure you want to delete ' + file.getName() + extra + '?';
			this.warning_body = '';
			this.warning_consumer_func = deleteFn;
			this.showWarning = true;
		},
		closeWarning() {
			this.showWarning = false;
			this.buildTabNavigation();
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

		confirmView(file, viewFn) {
			var size = this.getFileSize(file.getFileProperties());
			if (this.supportsStreaming() || size < 50 * 1024 * 1024)
				return viewFn();
			var sizeMb = (size / 1024 / 1024) | 0;
			this.warning_message = 'Are you sure you want to view ' + file.getName() + " of size " + sizeMb + 'MiB?';
			if (this.detectFirefoxWritableSteams()) {
				this.warning_body = "Firefox has added support for streaming behind a feature flag. To enable streaming; open about:config, enable 'javascript.options.writable_streams' and then open a new tab";
			} else {
				this.warning_body = "We recommend Chrome for downloads of large files. Your browser doesn't support it and may crash or be very slow";
			}
			this.warning_consumer_func = viewFn;
			this.showWarning = true;
		},

		switchView() {
			this.isGrid = !this.isGrid;
			this.buildTabNavigation();
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

			// this.showSpinner = true;
			var that = this;

			this.currentDir.mkdir(name, this.context.network, false, this.context.crypto)
				.thenApply(function (updatedDir) {
					that.currentDir = updatedDir;
					that.updateFiles();
					that.updateUsage();
					// that.onUpdateCompletion.push(function () {
					// 	that.showSpinner = false;
					// });

				}.bind(this)).exceptionally(function (throwable) {

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
			let uploadPath = this.getPath();
			var files = evt.target.files || evt.dataTransfer.files;
			this.processFileUpload(files, false);
		},

		processFileUpload(files, fromDnd) {
			let uploadPath = this.getPath()

			const uploadParams = {
				cancelUpload: false,
				accumulativeFileSize: 0,
				applyReplaceToAll: false,
				replaceFile: false,
				fileInfoStore: []
			}
			const future = peergos.shared.util.Futures.incomplete();

			if (files.length > 10) {
				this.$toast.info('preparing for upload', {timeout:false, id: 'progress'})
			}

			this.traverseDirectories(uploadPath, uploadPath, null, 0, files, 0, fromDnd, uploadParams, future);

			let that = this;

			future.thenApply(done => {

				that.$toast.dismiss('progress');

				that.updateFiles();
				//resetting .value tricks browser into allowing subsequent upload of same file(s)
				document.getElementById('uploadFileInput').value = "";
				document.getElementById('uploadDirectoriesInput').value = "";

				let progressStore = [];

				uploadParams.fileInfoStore.forEach(fileInfo => {
					let thumbnailAllocation = Math.min(100000, fileInfo.file.size / 10);
					let resultingSize = fileInfo.file.size + thumbnailAllocation;
					var progress = {
						show: true,
						title: "Encrypting and uploading " + fileInfo.file.name,
						done: 0,
						max: resultingSize
					};
					that.$toast({
						component: ProgressBar,
						props:  {
							title: progress.title,
							done: progress.done,
							max: progress.max
						},
					} , { icon: false , timeout:false, id: fileInfo.file.name})


					progressStore.push(progress);
				});


				let futureUploads = peergos.shared.util.Futures.incomplete();

				that.reduceAllUploads(uploadParams.fileInfoStore.reverse(), progressStore.slice().reverse(), uploadParams, futureUploads);

				futureUploads.thenApply(done => {
					// progressStore.forEach(progress => {
					// 	let idx = that.progressMonitors.indexOf(progress);
					// 	if (idx >= 0) {
					// 		that.progressMonitors.splice(idx, 1);
					// 	}
					// });
				});
			});
		},
		reduceAllUploads(fileInfoStore, progressStore, uploadParams, future) {
			let that = this;
			let fileInfo = fileInfoStore.pop();
			if (fileInfo == null || uploadParams.cancelUpload) {
				future.complete(true);
			} else {
				that.uploadFileFromFileInfo(fileInfo, progressStore.pop(), uploadParams).thenApply(res => {
					that.reduceAllUploads(fileInfoStore, progressStore, uploadParams, future);
				});
			}
		},
		splitDirectory(dir, fromDnd) {
			if (fromDnd) {
				return dir.fullPath.substring(1).split('/');
			} else {
				if (dir.webkitRelativePath == null) {
					return [""];
				} else {
					return dir.webkitRelativePath.split('/');
				}
			}
		},
		traverseDirectories(origDir, currentDir, dirs, dirIndex, items, itemIndex, fromDnd, uploadParams, future) {
			if (uploadParams.cancelUpload) {
				future.complete(true);
				return;
			}
			if (dirs == null) {
				if (itemIndex < items.length) {
					dirs = this.splitDirectory(items[itemIndex], fromDnd);
				} else {
					future.complete(true);
					return;
				}
			}
			var that = this;
			this.context.getByPath(currentDir).thenApply(function (updatedDirOpt) {
				let updatedDir = updatedDirOpt.get();
				if (dirIndex < dirs.length - 1) {
					let dirName = dirs[dirIndex];
					let path = currentDir + dirName + "/";

					updatedDir.hasChild(dirName, that.context.crypto.hasher, that.context.network)
						.thenApply(function (alreadyExists) {
							if (alreadyExists) {
								if (itemIndex == 0) {
									that.confirmReplaceDirectory(dirName,
										(applyToAll) => {
											uploadParams.applyReplaceToAll = applyToAll;
											uploadParams.replaceFile = false;
											future.complete(true);
										},
										(applyToAll) => {
											uploadParams.applyReplaceToAll = applyToAll;
											uploadParams.replaceFile = true;
											that.traverseDirectories(origDir, path, dirs, ++dirIndex, items, itemIndex, fromDnd, uploadParams, future);
										}
									);
								} else {
									that.traverseDirectories(origDir, path, dirs, ++dirIndex, items, itemIndex, fromDnd, uploadParams, future);
								}
							} else {
								updatedDir.mkdir(dirName, that.context.network, false, that.context.crypto)
									.thenApply(function (updated) {
										if (dirIndex == 0) {
											that.currentDir = updated;
										}
										that.traverseDirectories(origDir, path, dirs, ++dirIndex, items, itemIndex, fromDnd, uploadParams, future);
									});
							}
						});
				} else {
					let file = items[itemIndex];
					let refreshDir = that.getPath() == currentDir ? true : false;
					that.uploadFilesFromDirectory(that, refreshDir, origDir, currentDir, dirs, dirIndex, items, itemIndex, fromDnd, uploadParams, future);
				}
			});
		},
		confirmReplaceDirectory(dirName, cancelFn, replaceFn) {
			this.showSpinner = false;
			this.replace_message = 'Directory: "' + dirName + '" already exists in this location. Do you wish to continue?';
			this.replace_body = '';
			this.replace_consumer_cancel_func = cancelFn;
			this.replace_consumer_func = replaceFn;
			this.replace_showApplyAll = false;
			this.showReplace = true;
		},
		uploadFilesFromDirectory(that, refreshDir, origDir, currentDir, dirs, dirIndex, items, itemIndex, fromDnd, uploadParams, future) {
			//optimisation - Next entry will likely be in the same directory
			if (itemIndex < items.length) {
				let nextFile = items[itemIndex];
				let nextDirs = that.splitDirectory(nextFile, fromDnd);
				let sameDirectory = dirs.length == nextDirs.length;
				if (sameDirectory) {
					for (var i = 0; i < dirs.length - 1; i++) {
						if (dirs[i] != nextDirs[i]) {
							sameDirectory = false;
							break;
						}
					}
				}
				if (sameDirectory) {
					if (nextFile.name != '.DS_Store') { //FU OSX
						var uploadFileFuture = peergos.shared.util.Futures.incomplete();
						// this.showSpinner = true;
						if (items.length > 10) {
							this.$toast.info(`preparing for upload (${itemIndex} of ${items.length})`, {timeout:false, id: 'progress'})
						}

						that.uploadFileFromDirectory(nextFile, currentDir, refreshDir, fromDnd, uploadParams, uploadFileFuture);
						uploadFileFuture.thenApply(res =>
							that.uploadFilesFromDirectory(that, refreshDir, origDir, currentDir, dirs, dirIndex,
								items, ++itemIndex, fromDnd, uploadParams, future));
					} else {
						that.uploadFilesFromDirectory(that, refreshDir, origDir, currentDir, dirs, dirIndex,
							items, ++itemIndex, fromDnd, uploadParams, future);
					}
				} else {
					that.traverseDirectories(origDir, origDir, null, 0, items, itemIndex, fromDnd, uploadParams, future);
				}
			} else {
				that.traverseDirectories(origDir, origDir, null, 0, items, itemIndex, fromDnd, uploadParams, future);
			}
		},
		uploadFileFromDirectory(file, directory, refreshDirectory, fromDnd, uploadParams, uploadFileFuture) {
			if (fromDnd) {
				let that = this;
				file.file(function (fileEntry) {
					that.confirmAndUploadFile(fileEntry, directory, refreshDirectory, uploadParams, uploadFileFuture);
				});
			} else {
				this.confirmAndUploadFile(file, directory, refreshDirectory, uploadParams, uploadFileFuture);
			}
		},
		confirmAndUploadFile(file, directory, refreshDirectory, uploadParams, uploadFileFuture) {
			if (uploadParams.cancelUpload) {
				uploadFileFuture.complete(true);
				return;
			}
			let that = this;
			this.context.getByPath(directory).thenApply(function (updatedDirOpt) {
				let updatedDir = updatedDirOpt.get();
				updatedDir.hasChild(file.name, that.context.crypto.hasher, that.context.network)
					.thenApply(function (alreadyExists) {
						if (alreadyExists) {
							if (uploadParams.applyReplaceToAll) {
								if (uploadParams.replaceFile) {
									that.uploadOrReplaceFile(file, directory, refreshDirectory, true, uploadParams, uploadFileFuture)
								} else {
									uploadFileFuture.complete(true);
								}
							} else {
								that.confirmReplaceFile(file,
									(applyToAll) => {
										uploadParams.applyReplaceToAll = applyToAll;
										uploadParams.replaceFile = false;
										uploadFileFuture.complete(true);
									},
									(applyToAll) => {
										uploadParams.applyReplaceToAll = applyToAll;
										uploadParams.replaceFile = true;
										that.uploadOrReplaceFile(file, directory, refreshDirectory, true, uploadParams, uploadFileFuture)
									}
								);
							}
						} else {
							uploadParams.accumulativeFileSize += (file.size + (4096 - (file.size % 4096)));
							let spaceAfterOperation = that.checkAvailableSpace(uploadParams.accumulativeFileSize);
							if (spaceAfterOperation < 0) {
								that.errorTitle = "Unable to proceed. " + file.name + " file size exceeds available space";
								that.errorBody = "Please free up " + that.convertBytesToHumanReadable('' + -spaceAfterOperation) + " and try again";
								that.showError = true;
								uploadParams.cancelUpload = true;
								uploadFileFuture.complete(true);
							} else {
								that.uploadOrReplaceFile(file, directory, refreshDirectory, false, uploadParams, uploadFileFuture);
							}
						}
					});
			});
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
		uploadOrReplaceFile(file, directory, refreshDirectory, overwriteExisting, uploadParams, uploadFileFuture) {
			var fileStore = {
				file: file,
				directory: directory,
				refreshDirectory: refreshDirectory,
				overwriteExisting: overwriteExisting
			};
			uploadParams.fileInfoStore.push(fileStore);
			uploadFileFuture.complete(true);
		},
		uploadFileFromFileInfo(fileInfo, progress, uploadParams) {
			var future = peergos.shared.util.Futures.incomplete();
			let directory = fileInfo.directory;
			let file = fileInfo.file;
			let refreshDirectory = fileInfo.refreshDirectory;
			this.uploadFileJS(file, directory, refreshDirectory, fileInfo.overwriteExisting, progress, future, uploadParams);
			return future;
		},
		uploadFileJS(file, directory, refreshDirectory, overwriteExisting, progress, future, uploadParams) {
			let that = this;

			function updateProgressBar(len) {
				progress.done += Number(len);

				that.$toast.update(file.name, {content:
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
					that.$toast.dismiss(file.name);
				}
			};

			var reader = new browserio.JSFileReader(file);
			var java_reader = new peergos.shared.user.fs.BrowserFileReader(reader);
			// let context = this.getContext();

			that.context.getByPath(directory).thenApply(function (updatedDirOpt) {
				let spaceAfterOperation = that.checkAvailableSpace(file.size);
				if (spaceAfterOperation < 0) {

					that.$toast.error(`Unable to upload: ${file.name} File size exceeds available space. Please free up ${that.convertBytesToHumanReadable('' + -spaceAfterOperation)} and try again`, {timeout:false})

					uploadParams.cancelUpload = true;
					future.complete(false);
					return;
				}
				updatedDirOpt.get().uploadFileJS(file.name, java_reader, (file.size - (file.size % Math.pow(2, 32))) / Math.pow(2, 32), file.size,
					overwriteExisting, overwriteExisting ? true : false, that.context.network, that.context.crypto, updateProgressBar,
					that.context.getTransactionService()
				).thenApply(function (res) {
					const thumbnailAllocation = Math.min(100000, file.size / 10);
					updateProgressBar(thumbnailAllocation);
					if (refreshDirectory) {
						// that.showSpinner = true;
						that.currentDir = res;
						that.updateFiles();
					}
					context.getSpaceUsage().thenApply(u => {
						that.$store.commit('SET_USAGE', u);
						future.complete(true);
					});
				}).exceptionally(function (throwable) {

					that.$toast.update(file.name, {
						content:`Error uploading file ${file.name} : ${throwable.getMessage()}`
					});
					that.updateUsage();
					future.complete(false);
				})
			});
		},
		toggleUserMenu() {
			this.showSettingsMenu = !this.showSettingsMenu;
			this.buildTabNavigation();
		},

		toggleFeedbackForm() {
			this.showFeedbackForm = !this.showFeedbackForm;
			this.clearTabNavigation();
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

		toggleUploadMenu() {
			// this.showUploadMenu = !this.showUploadMenu;
			this.buildTabNavigation();
		},

		showTextEditor() {
			let that = this;
			this.select_placeholder = 'filename';
			this.select_message = 'Create or open Text file';
			this.clearTabNavigation();
			that.showSpinner = true;
			that.context.getByPath(this.getContext().username).thenApply(homeDir => {
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
									that.clearTabNavigation();
									that.showCodeEditor = true;
									that.updateHistory("editor", that.getPath(), "");
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
							that.updateHistory("editor", that.getPath(), "");
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
				path: this.getPath()
			};
			this.closeMenu(true);
		},

		cut() {
			if (this.selectedFiles.length != 1)
				return;
			var file = this.selectedFiles[0];

			this.clipboard = {
				parent: this.currentDir,
				fileTreeNode: file,
				op: "cut",
				path: this.getPath()
			};
			this.closeMenu(true);
		},

		paste() {
			if (this.selectedFiles.length != 1)
				return;
			var target = this.selectedFiles[0];
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
							that.errorTitle = "File copy operation exceeds available Space";
							that.errorBody = "Please free up " + this.convertBytesToHumanReadable('' + -spaceAfterOperation) + " and try again";
							that.showError = true;
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
			let dirPath = this.getContext().username + "/.profile/";
			this.showShareWithForFile(dirPath, field, false, false, fieldName);
		},
		showShareWithFromApp(app, filename, allowReadWriteSharing, allowCreateSecretLink, nameToDisplay) {
			let dirPath = this.getContext().username + "/.apps/" + app;
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
			this.buildTabNavigation();
		},
		setSortBy(prop) {
			if (this.sortBy == prop)
				this.normalSortOrder = !this.normalSortOrder;
			this.sortBy = prop;
		},
		updateContext(newContext) {
			// this.context = newContext;
			this.$store.commit("SET_USER_CONTEXT", newContext);

		},

		changePath(path) {
			if (path == "/" && this.path.length == 0) {
				return; //already root
			}
			console.debug('Changing to path:' + path);
			if (path.startsWith("/"))
				path = path.substring(1);
			this.path = path ? path.split('/') : [];
			this.showSpinner = true;
			this.updateHistory("filesystem", path, "");
		},
		downloadAll() {
			if (this.selectedFiles.length == 0)
				return;
			this.closeMenu(true);
			for (var i = 0; i < this.selectedFiles.length; i++) {
				var file = this.selectedFiles[i];
				this.navigateOrDownload(file);
			}
		},

		gallery() {
			// TODO: once we support selecting files re-enable this
			//if (this.selectedFiles.length == 0)
			//    return;
			this.closeMenu();
			if (this.selectedFiles.length == 0)
				return;
			var file = this.selectedFiles[0];
			var filename = file.getName();
			var mimeType = file.getFileProperties().mimeType;
			console.log("Opening " + mimeType);
			if (mimeType.startsWith("audio") ||
				mimeType.startsWith("video") ||
				mimeType.startsWith("image")) {
				var that = this;
				this.confirmView(file, () => {
					if (this.isSecretLink) {
						that.showGallery = true;
					}
					that.updateHistory("gallery", that.getPath(), filename);
				});
			} else if (mimeType === "application/vnd.peergos-todo") {
				if (this.isSecretLink) {
					this.showTodoBoardViewer = true;
				}
				this.updateHistory("todo", this.getPath(), filename);
			} else if (mimeType === "application/pdf") {
				if (this.isSecretLink) {
					this.showPdfViewer = true;
				}
				this.updateHistory("pdf", this.getPath(), filename);
			} else if (mimeType === "text/calendar") {
				this.importICALFile(true);
				this.updateHistory("calender", this.getPath(), filename);
			} else if (mimeType.startsWith("text/")) {
				if (this.isSecretLink) {
					this.showCodeEditor = true;
				}
				this.updateHistory("editor", this.getPath(), filename);
			} else {
				if (this.isSecretLink) {
					this.showHexViewer = true;
				}
				this.updateHistory("hex", this.getPath(), filename);
			}
		},

		navigateOrDownload(file) {
			if (this.showSpinner) // disable user input whilst refreshing
				return;
			this.buildTabNavigation();
			if (file.isDirectory()) {
				this.navigateToSubdir(file.getFileProperties().name);
			} else {
				var that = this;
				this.confirmDownload(file, () => { that.downloadFile(file); });
			}
		},

		navigateOrMenu(event, file) {
			this.navigateOrMenuTab(event, file, false)
		},
		navigateOrMenuTab(event, file, fromTabKey) {
			console.log('navigateOrMenuTab')
			if (this.showSpinner) // disable user input whilst refreshing
				return;

			this.closeMenu();

			console.log(file, 'navigateOrMenuTab' )
			if (file.isDirectory()) {
				this.navigateToSubdir(file.getFileProperties().name);
			} else {
				this.openMenu(event, file, fromTabKey);
			}
		},

		navigateToSubdir(name) {
			this.changePath(this.getPath() + name);
		},
		getFileClass(file) {
			if (file.isDirectory())
				return "dir";
			return "file"
		},
		getFileIcon(file) {
			var type = file.getFileProperties().getType();
			return this.getFileIconFromFileAndType(file, type);
		},
		getFileIconFromFileAndType(file, type) {
			if (type == 'pdf')
				return 'fa-file-pdf';
			if (type == 'audio')
				return 'fa-file-audio';
			if (type == 'video')
				return 'fa-file-video';
			if (type == 'image')
				return 'fa-file-image';
			if (type == 'text')
				return 'fa-file-alt';
			if (type == 'zip')
				return 'fa-file-archive';
			if (type == 'powerpoint presentation' || type == 'presentation')
				return 'fa-file-powerpoint';
			if (type == 'word document' || type == 'text document')
				return 'fa-file-word';
			if (type == 'excel spreadsheet' || type == 'spreadsheet')
				return 'fa-file-excel';
			if (type == 'todo')
				return 'fas fa-tasks';
			if (type == 'calendar')
				return 'fa fa-calendar-alt';
			if (type == 'contact file')
				return 'fa fa-address-card';
			if (file.isDirectory()) {
				if (file.isUserRoot() && file.getName() == this.username)
					return 'fa-home';
				return 'fa-folder-open';
			}
			return 'fa-file';
		},
		getPath() {
			return '/' + this.path.join('/') + (this.path.length > 0 ? "/" : "");
		},

		dragStart(ev, treeNode) {
			console.log("dragstart");

			ev.dataTransfer.effectAllowed = 'move';
			var id = ev.target.id;
			ev.dataTransfer.setData("text/plain", id);
			var owner = treeNode.getOwnerName();
			var me = this.username;
			if (owner === me) {
				console.log("cut");
				this.clipboard = {
					parent: this.currentDir,
					fileTreeNode: treeNode,
					op: "cut"
				};
			} else {
				console.log("copy");
				ev.dataTransfer.effectAllowed = 'copy';
				this.clipboard = {
					fileTreeNode: treeNode,
					op: "copy"
				};
			}
		},

		// DragEvent, FileTreeNode => boolean
		drop(ev, target) {
			console.log("drop");
			ev.preventDefault();
			var moveId = ev.dataTransfer.getData("text");
			var id = ev.currentTarget.id;
			var that = this;
			if (id != moveId && target.isDirectory()) {
				const clipboard = this.clipboard;
				if (typeof (clipboard) == undefined || typeof (clipboard.op) == "undefined")
					return;
				that.showSpinner = true;

				if (clipboard.op == "cut") {
					var name = clipboard.fileTreeNode.getFileProperties().name;
					console.log("drop-cut " + name + " -> " + target.getFileProperties().name);
					let filePath = peergos.client.PathUtils.toPath(that.path, name);
					clipboard.fileTreeNode.moveTo(target, clipboard.parent, filePath, that.context)
						.thenApply(function () {
							that.currentDirChanged();
							that.onUpdateCompletion.push(function () {
								that.showSpinner = false;
								that.clipboard = null;
							});
						}).exceptionally(function (throwable) {
							that.errorTitle = 'Error moving file';
							that.errorBody = throwable.getMessage();
							that.showError = true;
							that.showSpinner = false;
						});
				} else if (clipboard.op == "copy") {
					console.log("drop-copy");
					var file = clipboard.fileTreeNode;
					var props = file.getFileProperties();
					file.copyTo(target, that.context)
						.thenApply(function () {
							that.currentDirChanged();
							that.onUpdateCompletion.push(function () {
								that.showSpinner = false;
								that.clipboard = null;
							});
						}).exceptionally(function (throwable) {
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

		openMenu(e, file, fromTabKey) {
			if (this.ignoreEvent) {
				e.preventDefault();
				return;
			}

			if (this.showSpinner) {// disable user input whilst refreshing
				e.preventDefault();
				return;
			}
			if (this.getPath() == "/") {
				this.isNotBackground = false;
				if (file != null) {
					this.selectedFiles = [file];
				}
				this.setContextMenu(true);
				Vue.nextTick(function () {
					var menu = document.getElementById("right-click-menu-profile");
					if (menu != null)
						menu.focus();
					this.setMenu(e.y, e.x, "right-click-menu-profile")
				}.bind(this));
				e.preventDefault();
			} else {
				if (file) {
					this.isNotBackground = true;
					this.selectedFiles = [file];
				} else {
					this.isNotBackground = false;
					this.selectedFiles = [this.currentDir];
				}
				this.setContextMenu(true);
				Vue.nextTick(function () {
					var menu = document.getElementById("right-click-menu");
					if (menu != null) {
						if (fromTabKey === true) {
							this.navigationViaTabKey = true;
							menu.removeAttribute("tabindex");
							let contextMenuItems = document.getElementsByClassName('context-menu-item');
							for (var g = 0; g < contextMenuItems.length; g++) {
								contextMenuItems[g].setAttribute("tabindex", 0);
							}
							let closeItem = document.getElementById('close-context-menu-item');
							if (closeItem) {
								closeItem.classList.remove("hidden-context-menu-item");
							}
						} else {
							this.navigationViaTabKey = false;
							menu.setAttribute("tabindex", -1);
							menu.focus();
						}
					}
					this.setMenu(e.y, e.x, "right-click-menu")
				}.bind(this));
				e.preventDefault();
			}
		},
		setContextMenu(val) {
			this.viewMenu = val;
			if (val) {
				this.buildTabNavigation();
			}
		},
		createTextFile() {
			this.closeMenu(true);
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
					file.rename(newName, that.currentDir, filePath, that.getContext())
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
		closePrompt() {
			this.showPrompt = false;
			this.buildTabNavigation();
		},
		deleteFiles() {
			var selectedCount = this.selectedFiles.length;
			if (selectedCount == 0)
				return;
			this.closeMenu();

			for (var i = 0; i < selectedCount; i++) {
				var file = this.selectedFiles[i];
				var that = this;
				var parent = this.currentDir;

				this.confirmDelete(file, () => {
					that.deleteOne(file, parent, that.context);
					that.buildTabNavigation();
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
					that.errorTitle = 'Error deleting file: ' + file.getFileProperties().name;
					that.errorBody = throwable.getMessage();
					that.showError = true;
					that.showSpinner = false;
					that.updateUsage();
				});
		},

		setStyle(id, style) {
			var el = document.getElementById(id);
			if (el) {
				el.style.display = style;
			}
		},

		setMenu(top, left, menuId) {
			if (this.isNotBackground) {
				this.ignoreEvent = true;
			}

			var menu = document.getElementById(menuId);
			if (menu != null) {
				var largestHeight = window.innerHeight - menu.offsetHeight - 25;
				var largestWidth = window.innerWidth - menu.offsetWidth - 25;

				if (top > largestHeight) top = largestHeight;

				if (left > largestWidth) left = largestWidth;

				this.top = top + 'px';
				this.left = left + 'px';
			}
		},

		isShared(file) {
			if (this.currentDir == null)
				return false;
			if (this.sharedWithState == null)
				return false;
			return this.sharedWithState.isShared(file.getFileProperties().name);
		},
		closeMenu(ignoreClearTabNavigation) {
			this.setContextMenu(false);
			this.ignoreEvent = false;
			if (ignoreClearTabNavigation) {
				this.buildTabNavigation();
			} else {
				this.clearTabNavigation();
			}
			let menu = document.getElementById('right-click-menu');
			if (menu) {
				menu.setAttribute("tabindex", -1);
				let contextMenuItems = document.getElementsByClassName('context-menu-item');
				for (var g = 0; g < contextMenuItems.length; g++) {
					contextMenuItems[g].removeAttribute("tabindex");
				}
				let closeItem = document.getElementById('close-context-menu-item');
				if (closeItem) {
					closeItem.classList.add("hidden-context-menu-item");
				}
			}
			this.navigationViaTabKey = false;
		},

		formatDateTime(dateTime) {
			let date = new Date(dateTime.toString() + "+00:00");//adding UTC TZ in ISO_OFFSET_DATE_TIME ie 2021-12-03T10:25:30+00:00
			let formatted = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate()
				+ ' ' + (date.getHours() < 10 ? '0' : '') + date.getHours()
				+ ':' + (date.getMinutes() < 10 ? '0' : '') + date.getMinutes()
				+ ':' + (date.getSeconds() < 10 ? '0' : '') + date.getSeconds();
			return formatted;
		}
	},

};
</script>

<style>

</style>