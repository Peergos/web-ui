<template>
	<div class="fillspace" style="display:flex;flex-direction:column;justify-content:space-between;">
  <nav class="navbar navbar-inverse navbar-static-top" role="navigation">
    <input type="file" id="uploadFileInput" @change="uploadFiles" style="display:none;" multiple />
    <input type="file" id="uploadDirectoriesInput" @change="uploadFiles" style="display:none;" multiple directory mozDirectory webkitDirectory/>
    <div style="display:block;">
      <ul class="nav navbar-nav">
	<li id="appButton" v-if="!isSecretLink" v-on:keyup.enter="toggleNav()" @click="toggleNav()" class="navbar-brand nopad toolbar-item"><a><span data-toggle="tooltip" data-placement="bottom" title="Apps" class="pnavbar fas fa-home" style="cursor: pointer;"/></a></li>
	<li v-if="view==='files'" id="alternateViewButton" v-on:keyup.enter="switchView()" @click="switchView()" class="navbar-brand nopad toolbar-item"><a><span data-toggle="tooltip" data-placement="bottom" title="Switch view" id="altViewSpan" v-bind:class="['pnavbar', 'fa', 'tour-view', grid ? 'fa-list' : 'fa-th-large']" style="cursor: pointer;"/></a></li>
	<li id="uploadButton" v-on:keyup.enter="toggleUploadMenu()" @click="toggleUploadMenu()" v-if="isWritable && view==='files'" class="navbar-brand nopad toolbar-item"><a><span data-toggle="tooltip" data-placement="bottom" title="Upload" class="pnavbar fa fa-upload" style="cursor: pointer;"/></a></li>
	<li id="mkdirButton" v-on:keyup.enter="askMkdir()" @click="askMkdir()" v-if="isWritable && view==='files'" class="navbar-brand nopad toolbar-item"><a><span data-toggle="tooltip" data-placement="bottom" title="Create new directory" class="pnavbar fas fa-folder-plus" style="cursor: pointer;"/></a></li>
      </ul>
    </div>
    <span v-if="view==='files'" data-toggle="tooltip" data-placement="bottom" title="Current location" class="nav navbar-nav pnavbar" style="float:left;display:inline-block;font-size:2.5em;color:#9d9d9d;padding: 0.2em 0.2em 0em;">/</span>
    <span v-if="view==='files'" v-on:keyup.enter="goBackToLevel(index+1)" v-for="(dir, index) in path" class="nav navbar-nav navbar-brand toolbar-item" style="display:inline-block;padding: 0.2em 0.2em 1em;margin-bottom: 0.2em;">
        <button tabindex="-1" @click="goBackToLevel(index+1)" class="btn_pnavbar btn">{{dir}}</button>
        <span class="divider"> </span>
    </span>

    <ul id="settings-menu" v-if="isLoggedIn" class="nav navbar-right pnavbar_top_right toolbar-item" v-on:keyup.enter="toggleUserMenu()">
      <button id="logoutButton" tabindex="-1" @click="toggleUserMenu()" class="btn top_right_icon dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="true">
        <span class="fa fa-cog"></span>
        <span class="collapse navbar-collapse">{{username}}</span>
      </button>
      <ul id="settingsMenu" v-if="showSettingsMenu" class="dropdown-menu" aria-labelledby="logoutButton" style="cursor:pointer;display:block;left:auto;right:0;">
        <li v-if="isAdmin" v-on:keyup.enter="showAdminPanel" class="settings-item"><a @click="showAdminPanel">Admin Panel</a></li>
        <li class="settings-item" v-on:keyup.enter="showRequestStorage(true)"><a @click="showRequestStorage(true)">Account</a></li>
        <li class="settings-item" v-on:keyup.enter="showChangePassword"><a @click="showChangePassword">Change Password</a></li>
        <li class="settings-item" v-on:keyup.enter="showViewAccount"><a @click="showViewAccount">Delete Account</a></li>
        <li role="separator" class="divider"></li>
        <li class="settings-item" v-on:keyup.enter="logout"><a v-on:keyup.enter="logout" @click="logout">Log out</a></li>
      </ul>
    </ul>

    <ul v-if="isWritable" class="nav">
      <ul id="uploadMenu" v-if="showUploadMenu" class="dropdown-menu" style="cursor:pointer;display:block">
        <li v-on:keyup.enter="askForFiles" class="upload-item"><a @click="askForFiles">Upload files</a></li>
        <li v-on:keyup.enter="askForDirectories" class="upload-item"><a @click="askForDirectories">Upload directories</a></li>
      </ul>
    </ul>

  </nav>
  <a id="downloadAnchor" style="display:none"></a>
  <div v-if="viewMenu && (isNotHome || isPasteAvailable || isNotBackground)">
    <nav>
    <ul id="right-click-menu" tabindex="-1" v-if="viewMenu && (isNotHome || isPasteAvailable || isNotBackground)" v-on:blur="closeMenu" v-bind:style="{top:top, left:left}">
      <li id='gallery' class="context-menu-item" v-on:keyup.enter="gallery" v-if="canOpen" v-on:click="gallery">View</li>
      <li id='create-file' class="context-menu-item" v-on:keyup.enter="createTextFile" v-if="!isNotBackground" v-on:click="createTextFile">Create Text file</li>
      <li id='open-file' class="context-menu-item" v-on:keyup.enter="downloadAll" v-if="canOpen" v-on:click="downloadAll">Download</li>
      <li id='rename-file' class="context-menu-item" v-on:keyup.enter="rename" v-if="isNotBackground && isWritable" v-on:click="rename">Rename</li>
      <li id='delete-file' class="context-menu-item" v-on:keyup.enter="deleteFiles" v-if="isNotBackground && isWritable" v-on:click="deleteFiles">Delete</li>
      <li id='copy-file' class="context-menu-item" v-on:keyup.enter="copy" v-if="isNotBackground && isWritable" v-on:click="copy">Copy</li>
      <li id='cut-file' class="context-menu-item" v-on:keyup.enter="cut" v-if="isNotBackground && isWritable" v-on:click="cut">Cut</li>
      <li id='paste-file' class="context-menu-item" v-on:keyup.enter="paste" v-if="isPasteAvailable" v-on:click="paste">Paste</li>
      <li id='share-file' class="context-menu-item" v-on:keyup.enter="showShareWith" v-if="(isNotHome || isNotBackground) && isLoggedIn" v-on:click="showShareWith">Share</li>
      <li id='file-search' class="context-menu-item" v-on:keyup.enter="openSearch(false)" v-if="isSearchable" v-on:click="openSearch(false)">Search...</li>
      <li id='close-context-menu-item' class="context-menu-item hidden-context-menu-item" v-on:keyup.enter="closeMenu" v-on:click="closeMenu">Close</li>
    </ul>
    </nav>
  </div>
  <div v-if="viewMenu && isProfileViewable()">
    <ul id="right-click-menu-profile" tabindex="-1"  v-on:blur="closeMenu" v-bind:style="{top:top, left:left}">
      <li id='profile-view' v-on:click="showProfile(false)">Show Profile</li>
    </ul>
  </div>
  <tour
    v-if="showTour"
    v-on:hide-tour="closeTour">
  </tour>
  <appgrid
      v-if="showAppgrid"
      :context="context"
      :social="social"
      :canUpgrade="canUpgrade"
      v-on:files="showFiles"
      v-on:news-feed="showTimelineView()"
      v-on:upgrade="showRequestStorage()"
      v-on:calendar="showCalendar()"
      v-on:todo="showTodoBoard()"
      v-on:editor="showTextEditor()"
      v-on:social="showSocialView()"
      v-on:search="openSearch(true)"
      v-on:profile="showProfile(true)"
      v-on:chat="showChat()"
      v-on:tour="showTourViewer"
      >
  </appgrid>
  <share
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
    :context="context"
    :followernames="followernames"
    :friendnames="friendnames"
    :groups="groups"
    :messages="messages">
  </share>
  <social
    v-if="showSocial"
    v-on:hide-social="closeSocial"
    v-on:external-change="externalChange++"
    :displayProfile="displayProfile"
    :data="social"
    :context="context"
    :messages="messages">
  </social>
  <timeline
    v-if="showTimeline"
    v-on:hide-timeline="closeTimeline"
    :navigateToAction="navigateToAction"
    :viewAction="viewAction"
    :getFileIconFromFileAndType="getFileIconFromFileAndType"
    :messages="messages"
    :socialFeedInstance="socialFeed"
    :updateSocialFeedInstance="updateSocialFeedInstance"
    :importCalendarFile="importCalendarFile"
    :importSharedCalendar="importSharedCalendar"
    :displayProfile="displayProfile"
    :groups="groups"
    :followingnames="followingnames"
    :friendnames="friendnames"
    :followernames="followernames"
    :checkAvailableSpace="checkAvailableSpace"
    :convertBytesToHumanReadable="convertBytesToHumanReadable"
    :viewConversations="viewConversations"
    :context="context">
  </timeline>
  <search
          v-if="showSearch"
          v-on:hide-search="closeSearch"
          :path="searchPath"
          :navigateToAction="navigateToAction"
          :viewAction="viewAction"
          :context="context">
  </search>
  <admin
    v-if="showAdmin"
    v-on:hide-admin="closeAdmin"
    :data="admindata"
    :context="context">
  </admin>
  <password
    v-if="showPassword"
    v-on:hide-password="closeChangePassword"
    :context="context"
    :updateContext="updateContext"
    :messages="messages">
  </password>
  <account
          v-if="showAccount"
          v-on:hide-close-account="closeViewAccount"
          :deleteAccount="deleteAccount"
          :username="this.getContext().username">
  </account>
  <space
    v-if="showRequestSpace"
    v-on:hide-request-space="closeRequestSpace"
    :context="context"
    :quota="quota"
    :usage="usageBytes">
  </space>
  <payment
    v-if="showBuySpace"
    v-on:hide-payment="showBuySpace = false"
    :context="context"
    :quota="quota"
    :quotaBytes="quotaBytes"
    :usage="usageBytes"
    :paymentProperties="paymentProperties"
    :updateQuota="updateQuota">
  </payment>
  <chat
    v-if="showChatViewer"
    :closeChatViewer="closeChatViewer"
    :context="context"
    :getFileIconFromFileAndType="getFileIconFromFileAndType"
    :friendnames="friendnames"
    :displayProfile="displayProfile"
    :socialFeed="socialFeed"
    :socialState="socialState"
    :checkAvailableSpace="checkAvailableSpace"
    :convertBytesToHumanReadable="convertBytesToHumanReadable"
    :importCalendarFile="importCalendarFile"
    :viewAction="viewAction">
  </chat>
  <feedback
    v-if="showFeedbackForm"
    :closeFeedbackForm="closeFeedbackForm"
    :loadMessageThread="loadMessageThread"
    :sendFeedback="sendFeedback"
    :sendMessage="sendMessage"
    :messageId="messageId">
  </feedback>
  <profile-edit
          v-if="showProfileEditForm"
          v-on:hide-profile-edit="closeProfile"
          v-on:update-refresh="forceUpdate++"
          :context="context"
          :profile="profile"
          :shareWith="showShareWithForProfile"
          :messages="messages">
  </profile-edit>
  <profile-view
          v-if="showProfileViewForm"
          v-on:hide-profile-view="closeProfile"
          :profile="profile">
  </profile-view>
  <gallery
    v-if="showGallery"
    v-on:hide-gallery="closeApps()"
    :files="sortedFiles"
    :context="context"
    :initial-file-name="selectedFiles[0] == null ? '' : selectedFiles[0].getFileProperties().name">
  </gallery>
  <hex
    v-if="showHexViewer"
    v-on:hide-hex-viewer="closeApps()"
    :file="selectedFiles[0]"
    :context="context">
  </hex>
  <pdf
    v-if="showPdfViewer"
    v-on:hide-pdf-viewer="closeApps()"
    :file="selectedFiles[0]"
    :context="context">
  </pdf>
  <code-editor
    v-if="showCodeEditor"
    v-on:hide-code-editor="closeApps(); updateCurrentDir();"
    v-on:update-refresh="forceUpdate++"
    :file="selectedFiles[0]"
    :context="context"
    :messages="messages">
  </code-editor>
  <todo-board
          v-if="showTodoBoardViewer"
          v-on:hide-todo-board="closeApps();"
          :context="context"
          :file="selectedFiles[0]"
          :currentTodoBoardName="currentTodoBoardName"
          v-on:update-refresh="forceUpdate++"
          :messages="messages">
  </todo-board>
  <select-create
          v-if="showSelect"
          v-on:hide-select="closeSelect"
          :select_message= "select_message"
          :select_placeholder="select_placeholder"
          :select_items="select_items"
          :messages="messages"
          :select_consumer_func="select_consumer_func">
  </select-create>
  <calendar
          v-if="showCalendarViewer"
          v-on:hide-calendar="closeApps();"
          :importFile="importFile"
          :importCalendarPath="importCalendarPath"
          :owner="owner"
          :loadCalendarAsGuest="loadCalendarAsGuest"
          :shareWith="showShareWithFromApp"
          :context="context"
          :messages="messages">
  </calendar>
  <text-viewer
    v-if="showTextViewer"
    v-on:hide-text-viewer="closeApps()"
    :file="selectedFiles[0]"
    :context="context">
  </text-viewer>
  <message
    v-for="message in messages"
    v-on:remove-message="messages.splice(messages.indexOf(message), 1)"
    :title="message.title"
    :message="message.body">
  </message>
  <prompt
    v-if="showPrompt"
    v-on:hide-prompt="closePrompt"
    :prompt_message='prompt_message'
    :placeholder="prompt_placeholder"
    :max_input_size="prompt_max_input_size"
    :value="prompt_value"
    :consumer_func="prompt_consumer_func">
  </prompt>
  <warning
    v-if="showWarning"
    v-on:hide-warning="closeWarning"
    :warning_message='warning_message'
    :warning_body="warning_body"
    :consumer_func="warning_consumer_func">
  </warning>
  <replace
          v-if="showReplace"
          v-on:hide-replace="showReplace = false"
          :replace_message='replace_message'
          :replace_body="replace_body"
          :consumer_cancel_func="replace_consumer_cancel_func"
          :consumer_func="replace_consumer_func"
          :showApplyAll=replace_showApplyAll>
  </replace>
  <div v-if="progressMonitors.length>0" class="progressholder">
    <progressbar
        v-for="progress in progressMonitors" v-if="progress.show"
      v-on:hide-progress="progressMonitors.splice(progressMonitors.indexOf(progress), 1)"
      :title="progress.title"
      :done="progress.done"
      :max="progress.max" />
  </div>
  <div v-if="conversationMonitors.length>0" class="messageholder">
    <messagebar :replyToMessage="replyToMessage" :dismissMessage="dismissMessage"
            v-for="message in conversationMonitors"
            :id="message.id"
            :date="message.sendTime"
            :contents="message.contents.length > 50 ? message.contents.substring(0,47) + '...' : message.contents" />
  </div>
  <spinner v-if="showSpinner" :message="spinnerMessage"></spinner>
  <div v-if="view==='files'" id="dnd" @drop="dndDrop($event)" @dragover.prevent v-bind:class="{ fillspace: true, not_owner: isNotMe }" v-on:contextmenu="openMenu($event)">

    <div v-if="view==='files'">
    <div class="grid" v-if="grid">
        <span class="column grid-item" v-for="(file, index) in sortedFiles" v-on:keyup.enter="navigateOrMenuTab($event, file, true)">
          <span class="grid_icon_wrapper fa" :id="index" draggable="true" @dragover.prevent v-on:dragstart="dragStart($event, file)" @drop="drop($event, file)">
            <a class="picon" v-bind:id="file.getFileProperties().name" v-on:contextmenu="openMenu($event, file)">
              <span v-if="!file.getFileProperties().thumbnail.isPresent()" v-on:click="navigateOrMenu($event, file)" v-on:contextmenu="openMenu($event, file)"
		    v-bind:class="[getFileClass(file), getFileIcon(file), 'picon']"> </span>
              <img id="thumbnail" v-if="file.getFileProperties().thumbnail.isPresent()" v-on:click="navigateOrMenu($event, file)" v-on:contextmenu="openMenu($event, file)" v-bind:src="getThumbnailURL(file)"/>
                </a>
            <div class="content filename" >
              <div v-bind:class="{ noselect: true, shared: isShared(file) }">{{ file.getFileProperties().name }}</div>
            </div>
            </span>
        </span>
	<div v-if="sortedFiles.length==0 && currentDir != null && currentDir.isWritable()" class="instruction">
	  Upload a file by dragging and dropping here or clicking the <span class="fa fa-upload"/> icon
	</div>
	<center v-if="isSecretLink" class="bottom-message">
	  Join the revolution!<br/>
	  <button class="btn btn-lg btn-success" @click="gotoSignup()">Sign up to Peergos</button>
	</center>
    </div>
    <div class="table-responsive" v-if="!grid">
        <table class="table">
          <thead>
            <tr style="cursor:pointer;">
              <th @click="setSortBy('name')">Name <span v-if="sortBy=='name'" v-bind:class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
              <th @click="setSortBy('size')">Size <span v-if="sortBy=='size'" v-bind:class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
              <th @click="setSortBy('type')">Type <span v-if="sortBy=='type'" v-bind:class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
              <th @click="setSortBy('modified')">Modified <span v-if="sortBy=='modified'" v-bind:class="['fas', normalSortOrder ? 'fa-angle-down' : 'fa-angle-up']"/></th>
            </tr>
          </thead>
          <tbody>
                <tr v-for="file in sortedFiles" v-on:keyup.enter="navigateOrMenuTab($event, file, true)" class="grid-item">
                  <td v-bind:id="file.getFileProperties().name"  v-on:click="navigateOrMenu($event, file)" v-on:contextmenu="openMenu($event, file)" style="cursor:pointer" v-bind:class="{ shared: isShared(file) }">{{ file.getFileProperties().name }}</td>
                  <td>{{ getFileSize(file.getFileProperties()) }}</td>
                  <td>{{ file.getFileProperties().getType() }}</td>
                  <td>{{ formatDateTime(file.getFileProperties().modified) }}</td>
                </tr>
          </tbody>
        </table>
    </div>
    </div>
  </div>

  <div style="display:flex;justify-content:flex-end;">
      <div v-if="!isSecretLink" style="font-size:1.4em;display:flex;align-items:center;margin: 5px;">
          Usage: {{ usage }} / {{ quota }}&nbsp;&nbsp;
          <div v-on:keyup.enter="showRequestStorage(false)">
            <button tabindex="-1" class="btn btn-sm btn-success overlay-item" @click="showRequestStorage(false)">Upgrade</button>
          </div>
      </div>
  </div>
    <!-- <button tabindex="-1" id="popup" v-if="!isSecretLink" class="feedback-button overlay-item" @click="toggleFeedbackForm()">
      <div>
        Feedback
      </div>
    </button> -->
  <error
      v-if="showError"
      v-on:hide-error="showError = false"
      :title="errorTitle"
      :body="errorBody"
      :messageId="messageId">
  </error>
</div>

</template>

<script>
const mixins = require("../mixins/mixins.js");

module.exports = {
    data() {
        return {
            view: "appgrid",
            context: null,
            path: [],
            searchPath: null,
            currentDir: null,
	    	files: [],
            grid: true,
            sortBy: "name",
            normalSortOrder: true,
            clipboard:{},
            selectedFiles:[],
            url:null,
            viewMenu:false,
            ignoreEvent:false,
            top:"0px",
            left:"0px",
	   		showTour: false,
            showShare:false,
            sharedWithState: null,
            sharedWithData:{"edit_shared_with_users":[],"read_shared_with_users":[]},
            forceSharedRefreshWithUpdate:0,
            isNotBackground: true,
	    // quotaBytes: 0,
	    // usageBytes: 0,
	    	isAdmin: false,
            showAdmin:false,
            showAppgrid: false,
            showGallery: false,
            showSocial:false,
            showTimeline:false,
            showSearch:false,
            showHexViewer:false,
            showCodeEditor:false,
            showPdfViewer:false,
            showTextViewer:false,
            showPassword:false,
            showAccount:false,
            showRequestSpace:false,
            showBuySpace:false,
	    	paymentProperties:{
                isPaid() {return false;}
            },
            showSettingsMenu:false,
            showUploadMenu:false,
            showFeedbackForm: false,
            showChatViewer: false,
            showTodoBoardViewer: false,
            currentTodoBoardName: null,
            showCalendarViewer: false,
            showProfileEditForm: false,
            showProfileViewForm: false,
	    	admindata: {pending:[]},
            social:{
                pending: [],
                friends: [],
                followers: [],
                following: [],
                groupsNameToUid: [],
                groupsUidToName: [],
            },
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
            messages: [],
            messageId: null,
            progressMonitors: [],
            messageMonitors: [],
            conversationMonitors: [],
            clipboardAction:"",
            forceUpdate:0,
            externalChange:0,
            prompt_message: '',
            prompt_placeholder: '',
            prompt_max_input_size: null,
            prompt_value: '',
            prompt_consumer_func: () => {},
            showSelect: false,
            showPrompt: false,
            showWarning: false,
            showReplace: false,
	        warning_message: "",
	        warning_body: "",
            warning_consumer_func: () => {},
            replace_message: "",
            replace_body: "",
            replace_consumer_cancel_func: (applyToAll) => {},
            replace_consumer_func: (applyToAll) => {},
            replace_showApplyAll: false,
            errorTitle:'',
            errorBody:'',
            showError:false,
            showSpinner: true,
            spinnerMessage: '',
            onUpdateCompletion: [], // methods to invoke when current dir is next refreshed
            navigationViaTabKey: false
        };
    },

    props: ["initContext", "newsignup", "initPath", "openFile", "initiateDownload"],

	mixins:[mixins],

	created() {
        console.debug('Filesystem module created!');
        this.context = this.initContext;
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
                for (var i=0; i < newPath.length; i++) {
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
	    this.updateSocial(function(res) {that.updateCurrentDir();});
	},

	files(newFiles, oldFiles) {
	    if (newFiles == null)
		return;

	    if (oldFiles == null && newFiles != null)
		return this.processPending();

	    if (oldFiles.length != newFiles.length) {
		this.processPending();
	    } else {
		for (var i=0; i < oldFiles.length; i++)
		    if (! oldFiles[i].samePointer(newFiles[i]))
			return this.processPending();
	    }
	}
    },
	computed: {
		...Vuex.mapState([
			'quotaBytes',
			'usageBytes',
		]),

        canUpgrade() {
            if (this.paymentProperties === {})
                return false;
            return this.paymentProperties.isPaid() && this.quotaBytes/(1024*1024) <= this.paymentProperties.freeMb();
        },
	usage() {
	    if (this.usageBytes == 0)
		return "N/A";
	    return this.convertBytesToHumanReadable(this.usageBytes.toString());
	},
    quota() {
        if (this.quotaBytes == 0)
        return "N/A";
        return this.convertBytesToHumanReadable(this.quotaBytes.toString());
    },
	sortedFiles() {
            if (this.files == null) {
                return [];
            }
            var sortBy = this.sortBy;
            var reverseOrder = ! this.normalSortOrder;
	        var that = this;
            return this.files.slice(0).sort(function(a, b) {
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
                    return  a.isDirectory() ? -1 : 1;
                } else {
                    if (sortBy == "name") {
                        return aVal.localeCompare(bVal, undefined, {numeric:true});
                    }else if (sortBy == "modified") {
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
	    return ! this.isSecretLink;
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

            if (typeof(this.clipboard) ==  undefined || this.clipboard == null || this.clipboard.op == null || typeof(this.clipboard.op) == "undefined")
                return false;

            if (this.selectedFiles.length != 1)
                return false;
            var target = this.selectedFiles[0];

            if(this.clipboard.fileTreeNode.samePointer(target)) {
                return false;
            }

            return this.currentDir.isWritable() && target.isDirectory();
        },

	followernames() {
	    return this.social.followers;
	},
    friendnames() {
        return this.social.friends;
    },
    followingnames() {
        return this.social.following;
    },
    groups() {
        return {groupsNameToUid: this.social.groupsNameToUid, groupsUidToName: this.social.groupsUidToName};
    },

        username() {
            var context = this.getContext();
            if (context == null)
                return "";
            return context.username;
        }
    },
    methods: {
	init() {
	    const that = this;
        if (this.context != null && this.context.username == null) {
            // from a secret link
            this.context.getEntryPath().thenApply(function(linkPath) {
                var path = that.initPath == null ? null : decodeURIComponent(that.initPath);
                if (path != null && (path.startsWith(linkPath) || linkPath.startsWith(path))) {
                    that.changePath(path);
                } else {
                    that.changePath(linkPath);
                    that.context.getByPath(that.getPath())
                        .thenApply(function(file){file.get().getChildren(that.context.crypto.hasher, that.context.network).thenApply(function(children){
                            var arr = children.toArray();
                            if (arr.length == 1) {
                                if (that.initiateDownload) {
                                    that.downloadFile(arr[0]);
                                } else if (that.openFile){
                                    var open = () => {
                                        that.updateFiles(arr[0].getFileProperties().name);
                                    };
                                    that.onUpdateCompletion.push(open);
                                }
                            }
                        })
                    });
                }
            });
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
            this.context.getPaymentProperties(false).thenApply(function(paymentProps) {
                if (paymentProps.isPaid()) {
                    that.paymentProperties = paymentProps;
                } else
                    that.context.getPendingSpaceRequests().thenApply(reqs => {
                        if (reqs.toArray([]).length > 0)
                            that.isAdmin = true;
                    });
            });
        }
        this.showPendingServerMessages();
	},
	clearTabNavigation() {
	    let that = this;
	    Vue.nextTick(function() {
            let gridItems = document.getElementsByClassName('grid-item');
            let appGridItems = document.getElementsByClassName('app-grid-item');
            let toolbarItems = document.getElementsByClassName('toolbar-item');
            let overlayItems = document.getElementsByClassName('overlay-item');
            for(var g=0; g < overlayItems.length; g++) {
                overlayItems[g].removeAttribute("tabindex");
            }
            for(var i=0; i < gridItems.length; i++) {
                gridItems[i].removeAttribute("tabindex");
            }
            for(var j=0; j < appGridItems.length; j++) {
                appGridItems[j].removeAttribute("tabindex");
            }
            for(var k=0; k < toolbarItems.length; k++) {
                toolbarItems[k].removeAttribute("tabindex");
            }
	    });
    },
	buildTabNavigation() {
	    let that = this;
	    Vue.nextTick(function() {
            let gridItems = document.getElementsByClassName('grid-item');
            let appGridItems = document.getElementsByClassName('app-grid-item');
            let uploadItems = document.getElementsByClassName('upload-item');
            let toolbarItems = document.getElementsByClassName('toolbar-item');
            let settingsItems = document.getElementsByClassName('settings-item');
            let overlayItems = document.getElementsByClassName('overlay-item');
            for(var g=0; g < overlayItems.length; g++) {
                overlayItems[g].setAttribute("tabindex", 0);
            }
            for(var l=0; l < toolbarItems.length; l++) {
                toolbarItems[l].setAttribute("tabindex", 0);
            }
            if (that.showAppgrid) {
                if (that.showUploadMenu || that.showSettingsMenu || that.viewMenu) {
                    for(var j=0; j < appGridItems.length; j++) {
                        appGridItems[j].removeAttribute("tabindex");
                    }
                } else {
                    for(var j=0; j < appGridItems.length; j++) {
                        appGridItems[j].setAttribute("tabindex", 0);
                    }
                }
            } else {
                if (that.showUploadMenu || that.showSettingsMenu || that.viewMenu) {
                    for(var i=0; i < gridItems.length; i++) {
                        gridItems[i].removeAttribute("tabindex");
                    }
                } else {
                    for(var i=0; i < gridItems.length; i++) {
                        gridItems[i].setAttribute("tabindex", 0);
                    }
                }
            }
            if (that.showUploadMenu) {
                that.showSettingsMenu = false;
                for(var k=0; k < uploadItems.length; k++) {
                    uploadItems[k].setAttribute("tabindex", 0);
                }
                for(var l=0; l < toolbarItems.length; l++) {
                    toolbarItems[l].removeAttribute("tabindex");
                }
                document.getElementById("uploadButton").setAttribute("tabindex", 0);
            } else if (that.showSettingsMenu) {
                that.showUploadMenu = false;
                for(var m=0; m < settingsItems.length; m++) {
                    settingsItems[m].setAttribute("tabindex", 0);
                }
                for(var l=0; l < toolbarItems.length; l++) {
                    toolbarItems[l].removeAttribute("tabindex");
                }
                document.getElementById("settings-menu").setAttribute("tabindex", 0);
            } else if (that.viewMenu) { //context menu
                that.showSettingsMenu = false;
                that.showUploadMenu = false;
                for(var l=0; l < toolbarItems.length; l++) {
                    toolbarItems[l].removeAttribute("tabindex");
                }
            }
            if (!that.showUploadMenu) {
                for(var k=0; k < uploadItems.length; k++) {
                    uploadItems[k].removeAttribute("tabindex");
                }
            }
            if (!that.showSettingsMenu) {
                for(var m=0; m < settingsItems.length; m++) {
                    settingsItems[m].removeAttribute("tabindex");
                }
            }
        });
	},
	showPendingServerMessages() {
        let context = this.getContext();
        let that = this;
        context.getServerConversations().thenApply(function(conversations){
            let allConversations = [];
            let conv = conversations.toArray();
            conv.forEach(function(conversation){
                let arr = conversation.messages.toArray();
                let lastMessage = arr[arr.length - 1];
                allConversations.push({id: lastMessage.id(), sendTime: lastMessage.getSendTime().toString().replace("T", " "),
                    contents: lastMessage.getContents(), previousMessageId: lastMessage.getPreviousMessageId(),
                    from: lastMessage.getAuthor(), msg: lastMessage});
                arr.forEach(function(message){
                    that.messageMonitors.push({id: message.id(), sendTime: message.getSendTime().toString().replace("T", " "),
                        contents: message.getContents(), previousMessageId: message.getPreviousMessageId(),
                        from: message.getAuthor(), msg: message});
                });
            });
            if(allConversations.length > 0) {
                Vue.nextTick(function() {
                    allConversations.forEach(function(msg){
                        that.conversationMonitors.push(msg);
                    });
                });
            }
        }).exceptionally(function(throwable) {
            throwable.printStackTrace();
        });
	},
        showFiles(data) {
            this.showAppgrid = false;
            this.view="files";
            this.path = data.path;
            this.buildTabNavigation();
        },
    processPending() {
        for (var i=0; i < this.onUpdateCompletion.length; i++) {
            this.onUpdateCompletion[i].call();
        }
        this.onUpdateCompletion = [];
    },

	// roundToDisplay(x) {
	//     return Math.round(x * 100)/100;
	// },

    // convertBytesToHumanReadable(bytesAsString) {
    //     let bytes = Number(bytesAsString);
	//     if (bytes < 1024)
	// 	return bytes + " Bytes";
	//     if (bytes < 1024*1024)
	// 	return this.roundToDisplay(bytes/1024) + " KiB";
	//     if (bytes < 1024*1024*1024)
	// 	return this.roundToDisplay(bytes/1024/1024) + " MiB";
	//     return this.roundToDisplay(bytes/1024/1024/1024) + " GiB";
	// },

	updateUsage() {
	    var context = this.getContext();
            if (this.isSecretLink)
		return;
	    var that = this;
	    this.context.getSpaceUsage().thenApply(u => {
	        that.usageBytes = u
	    });
	},

	updateQuota() {
	    var context = this.getContext();
            if (this.isSecretLink)
		return;
	    var that = this;
	    return this.context.getQuota().thenApply(q => {
	        that.quotaBytes = q;
                return q;
            });
	},

	updateHistory(app, path, filename) {
	    if (this.isSecretLink)
		return;
	    const currentProps = this.getPropsFromUrl();
	    const pathFromUrl = currentProps == null ? null : currentProps.path;
	    const appFromUrl = currentProps == null ? null : currentProps.app;
	    if (path == pathFromUrl && app == appFromUrl)
		return;
	    var rawProps = propsToFragment({app:app, path:path, filename:filename});
	    var props = this.encryptProps(rawProps);
	    window.location.hash = "#" + propsToFragment(props);
	},

	getPropsFromUrl() {
	    try {
		return this.decryptProps(fragmentToProps(window.location.hash.substring(1)));
	    } catch(e) {
		return null;
	    }
	},

	encryptProps(props) {
	    var context = this.getContext();
	    var both = context.encryptURL(props)
	    const nonce = both.base64Nonce;
	    const ciphertext = both.base64Ciphertext;
	    return {nonce:nonce, ciphertext:ciphertext};
	},

	decryptProps(props) {
	    if (this.isSecretLink)
		return path;
	    var context = this.getContext();
	    return fragmentToProps(context.decryptURL(props.ciphertext, props.nonce));
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
		if (! differentPath)
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
            this.toggleNav();
        } else {
            for (var i=0; i < newPath.length; i++) {
                if (newPath[i] != currentPath[i]) {
                    this.changePath(directory);
                    this.toggleNav();
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
        if (! fromRoot) {
            if (this.isNotBackground) {
                path = path + this.selectedFiles[0].getFileProperties().name;
            } else {
                path = path.substring(0, path.length -1);
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
    	        this.importSharedCalendar(path.substring(0, path.length -1), this.currentDir, true, pathItems[0]);
    	        this.changePath("/");
	        }
	    }
    },
	updateCurrentDir() {
	    this.updateCurrentDirectory(null);
	},
	updateCurrentDirectory(selectedFilename) {
            var context = this.getContext();
            if (context == null)
                return Promise.resolve(null);
            var path = this.getPath();
            var that = this;
            context.getByPath(path).thenApply(function(file){
                that.currentDir = file.get();
                that.updateFiles(selectedFilename);
            }).exceptionally(function(throwable) {
                console.log(throwable.getMessage());
            });
        },
        updateFiles(selectedFilename) {
            var current = this.currentDir;
            if (current == null)
                return Promise.resolve([]);
            let that = this;
            let context = this.getContext();
            let path = that.path.length == 0 ? ["/"] : that.path;
            let directoryPath = peergos.client.PathUtils.directoryToPath(path);
            context.getDirectorySharingState(directoryPath).thenApply(function(updatedSharedWithState) {
                current.getChildren(context.crypto.hasher, context.network).thenApply(function(children){
                    that.sharedWithState = updatedSharedWithState;
                    var arr = children.toArray();
                    that.showSpinner = false;
                    that.files = arr.filter(function(f){
                        return !f.getFileProperties().isHidden;
                    });
                    that.buildTabNavigation();
                    if(selectedFilename != null) {
                        that.selectedFiles = that.files.filter(f => f.getName() == selectedFilename);
                        that.gallery();
                    } else {
                        that.sharedWithDataUpdate();
                        that.openAppFromFolder();
                    }
                }).exceptionally(function(throwable) {
                    console.log(throwable.getMessage());
                });
            }).exceptionally(function(throwable) {
                console.log(throwable.getMessage());
            });
        },

	updateSocial(callbackFunc) {
	    var context = this.getContext();
            if (context == null || context.username == null)
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
            context.getSocialState().thenApply(function(socialState){
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
            var context = this.getContext();
            if (this.selectedFiles.length != 1 || context == null) {
                this.sharedWithData = {read_shared_with_users:[], edit_shared_with_users:[] };
                return;
            }
            var file = this.selectedFiles[0];
            var filename = file.getFileProperties().name;

            let latestFile = this.files.filter(f => f.getName() == filename)[0];
            this.selectedFiles = [latestFile];
            let fileSharedWithState = this.sharedWithState.get(filename);
            let read_usernames = fileSharedWithState.readAccess.toArray([]);
            let edit_usernames = fileSharedWithState.writeAccess.toArray([]);
            this.sharedWithData = {read_shared_with_users:read_usernames, edit_shared_with_users:edit_usernames};
        },
        getContext() {
            return this.context;
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
            var newLevel = level || 0,
            path = this.path.slice(0, newLevel).join('/');

            if (newLevel < this.path.length) {
                this.changePath(path);
            } else if (newLevel == this.path.length) {
                this.currentDirChanged();
            }
        },

        askMkdir() {
            this.prompt_placeholder='Folder name';
            this.prompt_message='Enter a new folder name';
            this.prompt_value='';
            this.prompt_consumer_func = function(prompt_result) {
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
            this.warning_message='Are you sure you want to delete ' + file.getName() + extra +'?';
            this.warning_body='';
            this.warning_consumer_func = deleteFn;
            this.showWarning = true;
        },
        closeWarning() {
            this.showWarning = false;
            this.buildTabNavigation();
        },
        confirmDownload(file, downloadFn) {
            var size = this.getFileSize(file.getFileProperties());
            if (this.supportsStreaming() || size < 50*1024*1024)
                return downloadFn();
            var sizeMb = (size/1024/1024) | 0;
            this.warning_message='Are you sure you want to download ' + file.getName() + " of size " + sizeMb +'MiB?';
            if(this.detectFirefoxWritableSteams()) {
                this.warning_body="Firefox has added support for streaming behind a feature flag. To enable streaming; open about:config, enable 'javascript.options.writable_streams' and then open a new tab";
            } else {
                this.warning_body="We recommend Chrome for downloads of large files. Your browser doesn't support it and may crash or be very slow";
            }
            this.warning_consumer_func = downloadFn;
            this.showWarning = true;
        },

        confirmView(file, viewFn) {
	        var size = this.getFileSize(file.getFileProperties());
	        if (this.supportsStreaming() || size < 50*1024*1024)
		        return viewFn();
	        var sizeMb = (size/1024/1024) | 0;
            this.warning_message='Are you sure you want to view ' + file.getName() + " of size " + sizeMb +'MiB?';
            if(this.detectFirefoxWritableSteams()) {
                this.warning_body="Firefox has added support for streaming behind a feature flag. To enable streaming; open about:config, enable 'javascript.options.writable_streams' and then open a new tab";
            } else {
                this.warning_body="We recommend Chrome for downloads of large files. Your browser doesn't support it and may crash or be very slow";
            }
            this.warning_consumer_func = viewFn;
            this.showWarning = true;
        },

        switchView() {
            this.grid = !this.grid;
            this.buildTabNavigation();
        },

        currentDirChanged() {
            // force reload of computed properties
            this.forceUpdate++;
        },

	gotoSignup() {
	    var url = window.location.origin + window.location.pathname + "?signup=true";
	    this.openLinkInNewTab(url);
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
            var context = this.getContext();
            this.showSpinner = true;
            var that = this;

            this.currentDir.mkdir(name, context.network, false, context.crypto)
                .thenApply(function(updatedDir){
		    that.currentDir = updatedDir;
		    that.updateFiles();
		    that.onUpdateCompletion.push(function() {
                        that.showSpinner = false;
		    });
		    that.updateUsage();
                }.bind(this)).exceptionally(function(throwable) {
		    that.errorTitle = 'Error creating directory: ' + name;
		    that.errorBody = throwable.getMessage();
		    that.showError = true;
		    that.showSpinner = false;
		    that.updateUsage();
		});
        },

        askForFiles() {
            this.toggleUploadMenu();
            document.getElementById('uploadFileInput').click();
        },

        askForDirectories() {
            this.toggleUploadMenu();
            document.getElementById('uploadDirectoriesInput').click();
        },

        dndDrop(evt) {
            evt.preventDefault();
            let entries = evt.dataTransfer.items;
            let allItems = [];
            for(i=0; i < entries.length; i ++) {
                let entry = entries[i].webkitGetAsEntry();
                if(entry != null) {
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
                    if (item.isDirectory){
                           let reader = item.createReader();
                           let doBatch = function() {
                                reader.readEntries(function(entries) {
                                    if (entries.length > 0) {
                                        for(i=0; i < entries.length; i ++) {
                                            items.push(entries[i]);
                                        }
                                        doBatch();
                                    } else {
                                        that.getEntries(items, ++itemIndex, that, allFiles);
                                    }
                                });
                           };
                           doBatch();
                    }else{
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
            let uploadPath = this.getPath();
            var uploadParams = {
                cancelUpload: false,
                accumulativeFileSize: 0,
                applyReplaceToAll : false,
                replaceFile : false,
                fileInfoStore : []
            };
            var future = peergos.shared.util.Futures.incomplete();
            this.showSpinner = true;
            if(files.length > 10) {
                this.spinnerMessage = "preparing for upload";
            }
            this.traverseDirectories(uploadPath, uploadPath, null, 0, files, 0, fromDnd, uploadParams, future);
            let that = this;
            future.thenApply(done => {
                this.spinnerMessage = "";
                that.updateFiles();
                //resetting .value tricks browser into allowing subsequent upload of same file(s)
                document.getElementById('uploadFileInput').value = "";
                document.getElementById('uploadDirectoriesInput').value = "";
                let progressStore = [];
                uploadParams.fileInfoStore.forEach(fileInfo => {
                    var thumbnailAllocation = Math.min(100000, fileInfo.file.size / 10);
                    var resultingSize = fileInfo.file.size + thumbnailAllocation;
                    var progress = {
                        show:true,
                        title:"Encrypting and uploading " + fileInfo.file.name,
                        done:0,
                        max:resultingSize
                    };
                    that.progressMonitors.push(progress);
                    progressStore.push(progress);
                });
                let futureUploads = peergos.shared.util.Futures.incomplete();
                that.reduceAllUploads(uploadParams.fileInfoStore.reverse(), progressStore.slice().reverse(), uploadParams, futureUploads);
                futureUploads.thenApply(done => {
                    progressStore.forEach(progress => {
                        let idx = that.progressMonitors.indexOf(progress);
                        if(idx >= 0) {
                            that.progressMonitors.splice(idx, 1);
                        }
                    });
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
            this.context.getByPath(currentDir).thenApply(function(updatedDirOpt){
                let updatedDir = updatedDirOpt.get();
                if (dirIndex < dirs.length - 1) {
                    let dirName = dirs[dirIndex];
                    let path = currentDir + dirName + "/" ;

                    updatedDir.hasChild(dirName, that.context.crypto.hasher, that.context.network)
                        .thenApply(function(alreadyExists){
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
                                    .thenApply(function(updated){
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
            this.replace_message='Directory: "' + dirName + '" already exists in this location. Do you wish to continue?';
            this.replace_body='';
            this.replace_consumer_cancel_func = cancelFn;
            this.replace_consumer_func = replaceFn;
            this.replace_showApplyAll = false;
            this.showReplace = true;
        },
        uploadFilesFromDirectory(that, refreshDir, origDir, currentDir, dirs, dirIndex, items, itemIndex, fromDnd, uploadParams, future) {
            //optimisation - Next entry will likely be in the same directory
            if(itemIndex < items.length) {
                let nextFile = items[itemIndex];
                let nextDirs = that.splitDirectory(nextFile, fromDnd);
                let sameDirectory = dirs.length == nextDirs.length;
                 if (sameDirectory) {
                    for(var i = 0 ; i < dirs.length -1; i++) {
                        if(dirs[i] != nextDirs[i]) {
                            sameDirectory = false;
                            break;
                        }
                    }
                 }
                if (sameDirectory) {
                    if (nextFile.name != '.DS_Store') { //FU OSX
                        var uploadFileFuture = peergos.shared.util.Futures.incomplete();
                        this.showSpinner = true;
                        if(items.length > 10) {
                            this.spinnerMessage = "preparing for upload (" + itemIndex + " of " + items.length + ")";
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
            if(fromDnd) {
                let that = this;
                file.file(function(fileEntry) {
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
            this.context.getByPath(directory).thenApply(function(updatedDirOpt){
                let updatedDir = updatedDirOpt.get();
                updatedDir.hasChild(file.name, that.context.crypto.hasher, that.context.network)
                    .thenApply(function(alreadyExists){
                        if(alreadyExists) {
                            if (uploadParams.applyReplaceToAll) {
                                if(uploadParams.replaceFile) {
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
            this.replace_message='File: "' + file.name + '" already exists in this location. Do you wish to replace it?';
            this.replace_body='';
            this.replace_consumer_cancel_func = cancelFn;
            this.replace_consumer_func = replaceFn;
            this.replace_showApplyAll = true;
            this.showReplace = true;
        },
        uploadOrReplaceFile(file, directory, refreshDirectory, overwriteExisting, uploadParams, uploadFileFuture) {
            var fileStore = {
                file : file,
                directory : directory,
                refreshDirectory : refreshDirectory,
                overwriteExisting : overwriteExisting
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
            var updateProgressBar = function(len){
                progress.done += len.value_0;
                //that.progressMonitors.sort(function(a, b) {
                //  return Math.floor(b.done / b.max) - Math.floor(a.done / a.max);
                //});
                if (progress.done >= progress.max) {
                    progress.show = false;
                }
            };
            let that = this;
            var reader = new browserio.JSFileReader(file);
            var java_reader = new peergos.shared.user.fs.BrowserFileReader(reader);
            let context = this.getContext();
            context.getByPath(directory).thenApply(function(updatedDirOpt){
                let spaceAfterOperation = that.checkAvailableSpace(file.size);
                if (spaceAfterOperation < 0) {
                    that.errorTitle = "Unable to upload: " + file.name + " . File size exceeds available space";
                    that.errorBody = "Please free up " + that.convertBytesToHumanReadable('' + -spaceAfterOperation) + " and try again";
                    that.showError = true;
                    uploadParams.cancelUpload = true;
                    future.complete(false);
                    return;
                }
                updatedDirOpt.get().uploadFileJS(file.name, java_reader, (file.size - (file.size % Math.pow(2, 32)))/Math.pow(2, 32), file.size,
                    overwriteExisting, overwriteExisting ? true : false, context.network, context.crypto, updateProgressBar,
                    context.getTransactionService()
                ).thenApply(function(res) {
                    var thumbnailAllocation = Math.min(100000, file.size / 10);
                    updateProgressBar({ value_0: thumbnailAllocation});
                    if (refreshDirectory) {
                        that.showSpinner = true;
                        that.currentDir = res;
                        that.updateFiles();
                    }
                    context.getSpaceUsage().thenApply(u => {
                        that.usageBytes = u;
                        future.complete(true);
                    });
                }).exceptionally(function(throwable) {
                    progress.show = false;
                    that.errorTitle = 'Error uploading file: ' + file.name;
                    that.errorBody = throwable.getMessage();
                    that.showError = true;
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
                for (var i=0; i < this.conversationMonitors.length; i++ ) {
                    let currentMessage = this.conversationMonitors[i];
                    if(currentMessage.id == msgId) {
                        this.conversationMonitors.splice(i, 1);
                        break;
                    }
                }
            }
        },
        getMessage(msgId) {
            if (msgId != null) {
                //linear scan
                for (var i=0; i < this.messageMonitors.length; i++ ) {
                    let currentMessage = this.messageMonitors[i];
                    if(currentMessage.id == msgId) {
                        return this.messageMonitors[i];
                    }
                }
            }
            return null;
        },
        sendFeedback(contents) {
            this.showSpinner = true;
            let that = this;
            var maxContextSize = peergos.shared.user.ServerMessage.MAX_CONTENT_SIZE;
            var trimmedContents = contents.length > maxContextSize ? contents.substring(0, maxContextSize) : contents;
            this.context.sendFeedback(trimmedContents)
                .thenApply(function(res) {
                    that.showSpinner = false;
                    if (res) {
                        console.log("Feedback submitted!");
                        that.closeFeedbackForm(null, false);
                    } else {
                        that.errorTitle = 'Error sending feedback';
                        that.errorBody = "";
                        that.showError = true;
                    }
            }).exceptionally(function(throwable) {
                that.errorTitle = 'Error sending feedback';
                that.errorBody = throwable.getMessage();
                that.showError = true;
                that.showSpinner = false;
            });
        },
        sendMessage(msgId, contents) {
            let that = this;
            let message = this.getMessage(msgId);
            if (message != null) {
                this.showSpinner = true;
                var maxContextSize = peergos.shared.user.ServerMessage.MAX_CONTENT_SIZE;
                var trimmedContents = contents.length > maxContextSize ? contents.substring(0, maxContextSize) : contents;
                this.context.sendReply(message.msg, trimmedContents)
                    .thenApply(function(res) {
                        that.showSpinner = false;
                        if (res) {
                            console.log("message sent!");
                            that.closeFeedbackForm(msgId, true);
                        } else {
                            that.errorTitle = 'Error sending message';
                            that.errorBody = "";
                            that.showError = true;
                        }
                }).exceptionally(function(throwable) {
                    that.errorTitle = 'Error sending message';
                    that.errorBody = throwable.getMessage();
                    that.showError = true;
                    that.showSpinner = false;
                });
            }
        },

        closeFeedbackForm(msgId, submitted) {
            let submittedMsgId = submitted ? msgId : null;
            this.showFeedbackForm = false;
            this.messageId = null;
            this.popConversation(submittedMsgId);
            this.buildTabNavigation();
        },
        viewConversations() {
            let that = this;
            const ctx = this.getContext()
            this.showSpinner = true;
            ctx.getSocialFeed().thenApply(function(socialFeed) {
                ctx.getSocialState().thenApply(function(socialState){
                    that.socialState = socialState;
                    that.socialFeed = socialFeed;
                    that.showSpinner = false;
                    that.showChatViewer = true;
                });
            }).exceptionally(function(throwable) {
                that.showMessage(throwable.getMessage());
                that.showSpinner = false;
            });
        },
        showChat() {
            if (this.showSpinner) {
                return;
            }
            this.toggleNav();
            this.viewConversations();
        },
        closeChatViewer() {
            this.showChatViewer = false;
        },

        loadMessageThread(msgId) {
            let messages = [];
            if (msgId == null) {
                return messages;
            }
            var finished = false;
            while (!finished) {
                let message = this.getMessage(msgId);
                if (message == null) {
                    break;
                }
                messages.push({id: message.id, sendTime: message.sendTime,
                    contents: message.contents, from: message.from, visible: false});
                if (message.previousMessageId == null || message.previousMessageId >= msgId) {
                    finished = true;
                }
                msgId = message.previousMessageId;
            }
            return messages.reverse();
        },

        replyToMessage(msgId) {
            if (this.showFeedbackForm) {
                return;
            }
            this.messageId = msgId;
            this.showFeedbackForm = true;
        },

        dismissMessage(msgId) {
            if (this.showFeedbackForm) {
                return;
            }
            this.messageId = null;
            if (msgId != null) {
                let message = this.getMessage(msgId);
                if (message != null) {
                     let that = this;
                     this.showSpinner = true;
                     this.context.dismissMessage(message.msg).thenApply(res => {
                        this.showSpinner = false;
                        if (res) {
                            console.log("acknowledgement sent!");
                            that.popConversation(msgId);
                        } else {
                           that.errorTitle = 'Error acknowledging message';
                           that.errorBody = "";
                           that.showError = true;
                        }
                     }).exceptionally(function(throwable) {
                           that.errorTitle = 'Error acknowledging message';
                           that.errorBody = throwable.getMessage();
                           that.showError = true;
                           that.showSpinner = false;
                    });
                }
            }
        },

        toggleUploadMenu() {
            this.showUploadMenu = !this.showUploadMenu;
            this.buildTabNavigation();
        },

        showChangePassword() {
            this.toggleUserMenu();
            this.showPassword = true;
        },
        closeChangePassword() {
            this.showPassword = false;
            this.buildTabNavigation();
        },
        showViewAccount() {
            this.toggleUserMenu();
            this.showAccount = true;
        },
        closeViewAccount() {
            this.showAccount = false;
            this.buildTabNavigation();
        },
        showProfile(showEditForm) {
            if(! showEditForm) {
                this.closeMenu();
            } else {
                this.clearTabNavigation();
            }
            let username = showEditForm ? this.context.username : this.selectedFiles[0].getOwnerName();
            this.displayProfile(username, showEditForm);
        },
        displayProfile(username, showEditForm) {
            this.showSpinner = true;
            let that = this;
            let context = this.context;
            peergos.shared.user.ProfilePaths.getProfile(username, context).thenApply(profile => {
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
                if (showEditForm) {
                    that.showProfileEditForm = true;
                } else {
                    that.showProfileViewForm = true;
                }
            });
        },
        closeProfile() {
            this.buildTabNavigation();
            this.showProfileEditForm = false;
            this.showProfileViewForm = false
        },
        showRequestStorage(fromMenu) {
            var that = this;
            if (fromMenu) {
                this.toggleUserMenu();
            } else {
                this.clearTabNavigation();
            }
            this.context.getPaymentProperties(false).thenApply(function(paymentProps) {
            if (paymentProps.isPaid()) {
                that.paymentProperties = paymentProps;
                that.showBuySpace = true;
            } else
                that.showRequestSpace = true;
            });
        },
        closeRequestSpace() {
            this.showRequestSpace = false
            this.buildTabNavigation();
        },
        closeSelect() {
            this.showSelect = false;
            this.buildTabNavigation();
        },
        showTodoBoard() {
            let that = this;
            this.select_placeholder='Todo Board';
            this.select_message='Create or open Todo Board';
            that.clearTabNavigation();
            that.showSpinner = true;
            that.context.getByPath(this.getContext().username).thenApply(homeDir => {
                homeDir.get().getChildren(that.context.crypto.hasher, that.context.network).thenApply(function(children){
                    let childrenArray = children.toArray();
                    let todoBoards = childrenArray.filter(f => f.getName().endsWith('.todo') && f.getFileProperties().mimeType == "application/vnd.peergos-todo");
                    that.select_items= todoBoards.map(item => {
                        let name = item.getName();
                        return name.substring(0, name.length - 5);
                    }).sort(function(a, b) {
                      	return a.localeCompare(b);
                    });
                    that.select_consumer_func = function(select_result) {
                        if (select_result === null)
                            return;
                        that.currentTodoBoardName = select_result.endsWith('.todo') ?
                            select_result.substring(0, select_result.length - 5) : select_result;
                        let foundIndex = todoBoards.findIndex(v => {
                            let name = v.getName();
                            return name.substring(0, name.length - 5) === that.currentTodoBoardName;
                        });
                        if (foundIndex == -1) {
                            that.selectedFiles = [];
                        } else {
                            that.selectedFiles = [todoBoards[foundIndex]];
                        }
                        that.clearTabNavigation();
                        that.showTodoBoardViewer = true;
                        that.updateHistory("todo", that.getPath(), "");
                    };
                    that.showSpinner = false;
                    that.showSelect = true;
                });
            });
        },
        showTextEditor() {
            let that = this;
            this.select_placeholder='filename';
            this.select_message='Create or open Text file';
            this.clearTabNavigation();
            that.showSpinner = true;
            that.context.getByPath(this.getContext().username).thenApply(homeDir => {
                homeDir.get().getChildren(that.context.crypto.hasher, that.context.network).thenApply(function(children){
                    let childrenArray = children.toArray();
                    let textFiles = childrenArray.filter(f => f.getFileProperties().mimeType.startsWith("text/"));
                    that.select_items = textFiles.map(f => f.getName()).sort(function(a, b) {
                      	return a.localeCompare(b);
                    });
                    that.select_consumer_func = function(select_result) {
                        if (select_result === null)
                            return;
                        let foundIndex = textFiles.findIndex(v => v.getName() === select_result);
                        if (foundIndex == -1) {
                            that.showSpinner = true;
                            let context = that.getContext();
                            let empty = peergos.shared.user.JavaScriptPoster.emptyArray();
                            let reader = new peergos.shared.user.fs.AsyncReader.ArrayBacked(empty);
                            homeDir.get().uploadFileJS(select_result, reader, 0, 0,
                                false, false, context.network, context.crypto, function(len){},
                                context.getTransactionService()
                            ).thenApply(function(updatedDir) {
                                updatedDir.getChild(select_result, context.crypto.hasher, context.network).thenApply(function(textFileOpt) {
                                    that.showSpinner = false;
                                    that.selectedFiles = [textFileOpt.get()];
                                    that.clearTabNavigation();
                                    that.showCodeEditor = true;
                                    that.updateHistory("editor", that.getPath(), "");
                                });
                            }).exceptionally(function(throwable) {
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
        showCalendar() {
            this.clearTabNavigation();
            this.importFile = null;
            this.importCalendarPath = null;
            this.owner = this.context.username;
            this.loadCalendarAsGuest = false;
            this.showCalendarViewer = true;
	        this.updateHistory("calendar", this.getPath(), "");
        },
        logout() {
            this.toggleUserMenu();
            this.context = null;
	    window.location.fragment = "";
            window.location.reload();
        },

        showMessage(title, message) {
            this.messages.push({
                title: title,
                body: message,
                show: true
            });
        },

        showAdminPanel() {
            this.toggleUserMenu();
            const context = this.getContext()
            if (context == null)
                return;
            const that = this;
            context.getAndDecodePendingSpaceRequests().thenApply(reqs => {
                that.admindata.pending = reqs.toArray([]);
                that.showAdmin = true;
            });
        },
        closeAdmin() {
            this.showAdmin = false;
            this.buildTabNavigation();
        },
        showTourViewer() {
            this.clearTabNavigation();
            this.showTour = true;
        },
        closeTour() {
            this.buildTabNavigation();
            this.showTour = false
        },
        showSocialView(name) {
            this.clearTabNavigation();
            this.showSocial = true;
            this.externalChange++;
        },
        closeSocial() {
            this.buildTabNavigation();
            this.showSocial = false;
        },
        showTimelineView() {
            let that = this;
            if (this.showSpinner) {
                return;
            }
            this.showSpinner = true;
            this.spinnerMessage = "Building your news feed. This could take a minute...";
            const ctx = this.getContext()
            ctx.getSocialFeed().thenCompose(function(socialFeed) {
                return socialFeed.update().thenApply(function(updated) {
                    that.socialFeed = updated;
                    that.clearTabNavigation();
                    that.showTimeline = true;
                    that.showSpinner = false;
                    that.spinnerMessage = "";
                    that.updateHistory("timeline", that.getPath(), "");
                });
            }).exceptionally(function(throwable) {
                that.showMessage(throwable.getMessage());
                that.spinnerMessage = "";
                that.showSpinner = false;
            });
        },
        closeTimeline() {
            this.showTimeline = false;
            this.buildTabNavigation();
            this.forceSharedRefreshWithUpdate++;
        },
        updateSocialFeedInstance(updated) {
            this.socialFeed = updated;
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
            if(target.isDirectory()) {
                let clipboard = this.clipboard;
                if (typeof(clipboard) ==  undefined || typeof(clipboard.op) == "undefined")
                    return;

                if(clipboard.fileTreeNode.samePointer(target)) {
                    return;
                }
                that.showSpinner = true;

                var context = this.getContext();
                if (clipboard.op == "cut") {
                    let name = clipboard.fileTreeNode.getFileProperties().name;
                    console.log("paste-cut "+ name + " -> "+target.getFileProperties().name);
                    let filePath = peergos.client.PathUtils.toPath(that.path, name);
                    clipboard.fileTreeNode.moveTo(target, clipboard.parent, filePath, context)
                        .thenApply(function() {
                            that.currentDirChanged();
			                that.onUpdateCompletion.push(function() {
                            that.showSpinner = false;
			            });
                    }).exceptionally(function(throwable) {
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
                        clipboard.fileTreeNode.copyTo(target, context)
                            .thenApply(function() {
                                that.currentDirChanged();
                                that.onUpdateCompletion.push(function() {
                                    that.updateUsage();
                                    that.showSpinner = false;
                            });
                        }).exceptionally(function(throwable) {
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
            file.getChildren(this.context.crypto.hasher, this.context.network).thenApply(function(children) {
                let arr = children.toArray();
                for(var i = 0; i < arr.length; i++) {
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
                    { size: 4096, walkCounter: 1}, future);
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
            var context = this.getContext();
            this.context.getByPath(dirPath)
                .thenApply(function(dir){dir.get().getChild(filename, that.context.crypto.hasher, that.context.network).thenApply(function(child){
                    let file = child.get();
                    if (file == null) {
                        return;
                    }
                    that.filesToShare = [file];
                    that.pathToFile = dirPath.split('/');
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
            this.sharedWithData = {read_shared_with_users:read_usernames, edit_shared_with_users:edit_usernames};
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
            this.context = newContext;
        },
        deleteAccount(password) {
            console.log("Deleting Account");
            this.showSpinner = true;
            var that = this;
            this.getContext().deleteAccount(password).thenApply(function(result){
                if (result) {
                    that.showMessage("Account Deleted!");
                    setTimeout(function(){ that.logout(); }, 5000);
                } else {
                    that.updateFiles();
                    that.errorTitle = "Error Deleting Account";
                    that.errorBody = throwable.getMessage();
                    that.showError = true;
                    that.showSpinner = false;
                }
            }).exceptionally(function(throwable) {
                that.updateFiles();
                that.errorTitle = "Error Deleting Account";
                that.errorBody = throwable.getMessage();
                that.showError = true;
                that.showSpinner = false;
            });
        },
        changePath(path) {
            if(path == "/" && this.path.length == 0) {
                return; //already root
            }
            console.debug('Changing to path:'+ path);
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
            for (var i=0; i < this.selectedFiles.length; i++) {
                var file = this.selectedFiles[i];
                this.navigateOrDownload(file);
            }
        },
        importICALFile(isSecretLink) {
            if (this.selectedFiles.length == 0)
                return;
            this.closeMenu();
            let file = this.selectedFiles[0];
            this.importCalendarFile(isSecretLink, file);
        },
        importCalendarFile(isSecretLink, file) {
            let props = file.getFileProperties();
            let that = this;
            let context = this.getContext();
            file.getInputStream(context.network, context.crypto, props.sizeHigh(), props.sizeLow(), function(read) {})
                .thenCompose(function(reader) {
                    var size = that.getFileSize(props);
                    var data = convertToByteArray(new Int8Array(size));
                    return reader.readIntoArray(data, 0, data.length)
                        .thenApply(function(read){
                            that.importFile = new TextDecoder().decode(data);
                            that.importCalendarPath = null;
                            that.owner = file.getOwnerName();
                            that.loadCalendarAsGuest = isSecretLink;
                            Vue.nextTick(function() {
                                that.showCalendarViewer = true;
                            });
                        });
            })
        },
        importSharedCalendar(path, file, isSecretLink, owner) {
            this.importFile = null;
            this.importCalendarPath = path;
            this.owner = owner;
            this.loadCalendarAsGuest = isSecretLink;
            this.showCalendarViewer = true;
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
		        this.confirmDownload(file, () => {that.downloadFile(file);});
	        }
        },

        navigateOrMenu(event, file) {
            this.navigateOrMenuTab(event, file, false)
        },
        navigateOrMenuTab(event, file, fromTabKey) {
            if (this.showSpinner) // disable user input whilst refreshing
                return;
            this.closeMenu();
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
            return '/'+this.path.join('/') + (this.path.length > 0 ? "/" : "");
        },

        dragStart(ev, treeNode) {
            console.log("dragstart");

            ev.dataTransfer.effectAllowed='move';
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
                ev.dataTransfer.effectAllowed='copy';
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
            if(id != moveId && target.isDirectory()) {
                const clipboard = this.clipboard;
                if (typeof(clipboard) ==  undefined || typeof(clipboard.op) == "undefined")
                    return;
                that.showSpinner = true;
                var context = this.getContext();
                if (clipboard.op == "cut") {
        		    var name = clipboard.fileTreeNode.getFileProperties().name;
                    console.log("drop-cut " + name + " -> "+target.getFileProperties().name);
                    let filePath = peergos.client.PathUtils.toPath(that.path, name);
                    clipboard.fileTreeNode.moveTo(target, clipboard.parent, filePath, context)
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
                    file.copyTo(target, context)
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
        isProfileViewable() {
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
                Vue.nextTick(function() {
                    var menu = document.getElementById("right-click-menu-profile");
                    if (menu != null)
                        menu.focus();
                    this.setMenu(e.y, e.x, "right-click-menu-profile")
                }.bind(this));
                e.preventDefault();
            } else {
                if(file) {
                    this.isNotBackground = true;
                    this.selectedFiles = [file];
                } else {
                    this.isNotBackground = false;
                    this.selectedFiles = [this.currentDir];
                }
                this.setContextMenu(true);
                Vue.nextTick(function() {
                    var menu = document.getElementById("right-click-menu");
                    if (menu != null) {
                        if (fromTabKey === true) {
                            this.navigationViaTabKey = true;
                            menu.removeAttribute("tabindex");
                            let contextMenuItems = document.getElementsByClassName('context-menu-item');
                            for(var g=0; g < contextMenuItems.length; g++) {
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
            this.prompt_placeholder='File name';
            this.prompt_message='Enter a file name';
            this.prompt_value='';
            this.prompt_consumer_func = function(prompt_result) {
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
            let context = this.getContext();
            let empty = peergos.shared.user.JavaScriptPoster.emptyArray();
            let reader = new peergos.shared.user.fs.AsyncReader.ArrayBacked(empty);
            this.currentDir.uploadFileJS(filename, reader, 0, 0,
                false, false, context.network, context.crypto, function(len){},
                context.getTransactionService()
            ).thenApply(function(res) {
                that.currentDir = res;
                that.updateFiles();
                that.onUpdateCompletion.push(function() {
                    that.showSpinner = false;
                });
            }).exceptionally(function(throwable) {
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
            let old_name =  fileProps.name
            this.closeMenu();
            let fileType = fileProps.isDirectory ? "directory" : "file";

            this.prompt_placeholder = 'New name';
	        this.prompt_value = old_name;
            this.prompt_message = 'Enter a new name';
            var that = this;
            this.prompt_consumer_func = function(prompt_result) {
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
                console.log("Renaming " + old_name + "to "+ newName);
                Vue.nextTick(function() {
                    let filePath = peergos.client.PathUtils.toPath(that.path, old_name);
                    file.rename(newName, that.currentDir, filePath, that.getContext())
                        .thenApply(function(parent){
                            that.currentDir = parent;
                            that.updateFiles();
                            that.showSpinner = false;
                        }).exceptionally(function(throwable) {
                            that.updateFiles();
                            that.errorTitle = "Error renaming " + fileType + ": " + old_name;
                            that.errorBody = throwable.getMessage();
                            that.showError = true;
                            that.showSpinner = false;
                        });
                });
            };
            this.showPrompt =  true;
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

            for (var i=0; i < selectedCount; i++) {
                var file = this.selectedFiles[i];
                var that = this;
                var parent = this.currentDir;
                var context = this.getContext();
                this.confirmDelete(file, () => {
                    that.deleteOne(file, parent, context);
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
                .thenApply(function(b){
                    that.currentDirChanged();
                    that.showSpinner = false;
		    that.updateUsage();
                }).exceptionally(function(throwable) {
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
                for(var g=0; g < contextMenuItems.length; g++) {
                    contextMenuItems[g].removeAttribute("tabindex");
                }
                let closeItem = document.getElementById('close-context-menu-item');
                if (closeItem) {
                    closeItem.classList.add("hidden-context-menu-item");
                }
            }
            this.navigationViaTabKey = false;
        },
        toggleNav () {
            if (this.showAppgrid)
                this.view = "files"
            else
                this.view = "appgrid"
            this.showAppgrid = ! this.showAppgrid;
            this.buildTabNavigation();
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