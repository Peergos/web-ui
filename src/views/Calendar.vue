<template>
	<article class="app-view calendar-view">
		<AppHeader>
			<template #primary>
				<h1>{{ translate("CALENDAR.TITLE") }}</h1>
			</template>
		</AppHeader>
		<main>
            <Spinner v-if="showSpinner" :message="spinnerMessage"></Spinner>
            <a id="downloadEventAnchor" style="display:none"></a>
	    <iframe id="calendar-iframe" :src="frameUrl()" style="width:100%; min-height:100vh" frameBorder="0"></iframe>
            <Choice
                v-if="showChoice"
                v-on:hide-choice="showChoice = false"
                :choice_message='choice_message'
                :choice_body="choice_body"
                :choice_consumer_func="choice_consumer_func"
                :choice_options="choice_options">
            </Choice>
            <Prompt
                v-if="showPrompt"
                v-on:hide-prompt="showPrompt = false"
                :prompt_message='prompt_message'
                :placeholder="prompt_placeholder"
                :max_input_size="prompt_max_input_size"
                :value="prompt_value"
                :consumer_func="prompt_consumer_func">
            </Prompt>
            <Confirm
                v-if="showConfirm"
                v-on:hide-confirm="showConfirm = false"
                :confirm_message='confirm_message'
                :confirm_body="confirm_body"
                :consumer_cancel_func="confirm_consumer_cancel_func"
                :consumer_func="confirm_consumer_func">
            </Confirm>
            <Share
		v-if="showShare"
		v-on:hide-share-with="closeShare"
		v-on:update-shared-refresh="forceSharedRefreshWithUpdate++"
		v-on:update-files="updateSharedFile()"
		:data="sharedWithData"
		:fromApp="fromApp"
		:displayName="displayName"
		:allowReadWriteSharing="allowReadWriteSharing"
		:allowCreateSecretLink="allowCreateSecretLink"
                :autoOpenSecretLink="true"
		:files="filesToShare"
		:path="pathToFile"
		:followernames="followernames"
		:friendnames="friendnames"
		:groups="groups"
		:messages="messages">
	    </Share>
		</main>
	</article>
</template>

<script>
const AppHeader = require("../components/AppHeader.vue");
const Choice = require('../components/choice/Choice.vue');
const Confirm = require("../components/confirm/Confirm.vue");
const Share = require("../components/drive/DriveShare.vue");
const ProgressBar = require("../components/drive/ProgressBar.vue");
const Prompt = require("../components/prompt/Prompt.vue");
const Spinner = require("../components/spinner/Spinner.vue");
const i18n = require("../i18n/index.js");

const routerMixins = require("../mixins/router/index.js");

module.exports = {
    components: {
        Choice,
        Confirm,
		Share,
		AppHeader,
		ProgressBar,
		Prompt,
		Spinner
	},
	data: function() {
        return {
            APPS_DIR_NAME: '.apps',
            CALENDAR_DIR_NAME: 'calendar',
            DATA_DIR_NAME: 'data',
            CALENDAR_FILE_EXTENSION: '.ics',
            CONFIG_FILENAME: 'App.config',
            NEW_CALENDAR_FILENAME: 'calendar.inf',
            showSpinner: false,
            showShare: false,
            spinnerMessage: "",
            calendarProperties: null,
            showPrompt: false,
            prompt_message: '',
            prompt_placeholder: '',
            prompt_max_input_size: null,
            prompt_value: '',
            prompt_consumer_func: () => {},
            showConfirm: false,
            confirm_message: "",
            confirm_body: "",
            confirm_consumer_cancel_func: () => {},
            confirm_consumer_func: () => {},
            showChoice: false,
            choice_message: '',
            choice_body: '',
            choice_consumer_func: () => {},
            choice_options: [],
            isIframeInitialised: false,
            importFile: null,
            importCalendarPath: null,
            owner: null,
            loadCalendarAsGuest: false,
            hasEmail: false
        }
    },
    props: ['messages'],
	computed: {
		...Vuex.mapState([
			'context',
			'socialData',
			'mirrorBatId',
		]),
		...Vuex.mapGetters([
			'isSecretLink',
			'getPath',
			'currentFilename'
		]),
        friendnames: function() {
            return this.socialData.friends;
        },
        followernames: function() {
            return this.socialData.followers;
        },
        groups: function() {
		    return {groupsNameToUid: this.socialData.groupsNameToUid, groupsUidToName: this.socialData.groupsUidToName};
	    },
	},
	mixins:[routerMixins, i18n],
    created() {
        let that = this;
        this.displaySpinner();
        this.getInputParameters().thenApply(inputParameters => {
            that.loadInputParameters(inputParameters).thenApply(loadedParameters => {
                if (loadedParameters != null) {
                    that.importFile = loadedParameters.importFile;
                    that.importCalendarPath = loadedParameters.importCalendarPath;
                    that.owner = loadedParameters.owner;
                    that.hasEmail = loadedParameters.hasEmail;
                    that.loadCalendarAsGuest = that.isSecretLink;
                    peergos.shared.user.App.init(that.context, "calendar").thenApply(calendar => {
                        if (that.loadCalendarAsGuest) {
                            that.startListener(calendar);
                        } else {
                            that.getPropertiesFile(calendar).thenApply(props => {
                                that.calendarProperties = props;
                                that.startListener(calendar)
                            })
                        }
                    });
                }
            });
        });
    },
	mounted(){
	},
    methods: {
    getInputParameters: function() {
        let that = this;
        let future = peergos.shared.util.Futures.incomplete();
        const props = this.getPropsFromUrl();
        
        let filename = props.args.filename;
        let isFile = filename != null && filename.length > 0;
        if (!isFile) {
            //loading calendar from left hand menu + shared calendar importing
            future.complete({path: props.path, filename: null});
        } else {
            //shared calendar item importing
            future.complete({path: props.path, filename: filename});
        }
        return future;
    },
    loadInputParameters: function(inputParameters) {
      let future = peergos.shared.util.Futures.incomplete();
      if (inputParameters == null) {
        future.complete(null);
        return future;
      }
      let path = inputParameters.path
      let filename = inputParameters.filename;
      let query = new URLSearchParams(window.location.search)
      let hasEmail = query.get("email") == "true";
      let that = this;
      if (filename == null) {
            if (path == that.context.username) {
                future.complete({importFile: null, importCalendarPath: null,
                    owner: that.context.username, hasEmail: hasEmail});
            } else {
                that.context.getByPath(path).thenApply(dirOpt => {
                    if (! dirOpt.isPresent()) {
                        that.$toast.error(that.translate('CALENDAR.ERROR.LOAD'), {timeout:false});
                        future.complete(null);
                    } else {
                        let dir = dirOpt.get();
                        let dirParts = path.split('/').filter(s => s.length > 0);
                        future.complete({importFile: null, importCalendarPath: path,
                            owner: dirParts[0], hasEmail: hasEmail});
                    }
                });
            }
      } else {
            that.context.getByPath(path + (path.endsWith("/") ? "" : '/') + filename).thenApply(fileOpt => {
                if (! fileOpt.isPresent()) {
                    that.$toast.error(that.translate('CALENDAR.ERROR.LOAD.FILE'), {timeout:false});
                    future.complete(null);
                    return;
                }
                let file = fileOpt.get();
                let props = file.getFileProperties();
                file.getInputStream(that.context.network, that.context.crypto, props.sizeHigh(), props.sizeLow(), function(read) {})
                .thenCompose(function(reader) {
                    var size = that.getFileSize(props);
                    var data = convertToByteArray(new Int8Array(size));
                    return reader.readIntoArray(data, 0, data.length)
                    .thenApply(function(read){
                        future.complete({importFile: new TextDecoder().decode(data), importCalendarPath: null,
                            owner: file.getOwnerName(), hasEmail: hasEmail});
                    });
                });
            });
      }
      return future;
    },
    getFileSize: function(props) {
            var low = props.sizeLow();
            if (low < 0) low = low + Math.pow(2, 32);
            return low + (props.sizeHigh() * Math.pow(2, 32));
    },
    frameUrl: function() {
        return this.frameDomain() + "/apps/calendar/index.html";
    },
    frameDomain: function() {
        return window.location.protocol + "//calendar." + window.location.host;
    },
    postMessage: function(obj) {
    	var iframe = document.getElementById("calendar-iframe");
        if (this.isIframeInitialised) {
            iframe.contentWindow.postMessage(obj, '*');
        } else {
            let that = this;
            this.sendPing(iframe);
            window.setTimeout(function() {that.postMessage(obj);}, 30);
        }
    },
    sendPing: function(iframe) {
        let theme = this.$store.getters.currentTheme;
        iframe.contentWindow.postMessage({type: 'ping', currentTheme: theme, hasEmail: this.hasEmail}, '*');
    },
    initialiseIFrameCommunication: function(iframe, callback, retryCount){
        if (this.isIframeInitialised) {
            callback();
        } else {
            if (retryCount == 0) {
                this.$toast.error("Unable to register service worker. Calendar will not work offline. \nTo enable offline usage, allow 3rd party cookies for " + window.location.protocol + "//[*]." + window.location.host + "\n Note: this is not tracking", {timeout:false});
                callback();
            }else {
                let that = this;
                this.sendPing(iframe);
                window.setTimeout(function() {that.initialiseIFrameCommunication(iframe, callback, retryCount - 1);}, 100);
            }
        }
    },
    startListener: function(calendar) {
	    var that = this;
	    var iframe = document.getElementById("calendar-iframe");
	    if (iframe == null) {
    		setTimeout(function(){that.startListener(calendar)}, 1000);
	    	return;
	    }
        // Listen for response messages from the frames.
        window.addEventListener('message', function (e) {
            // Normally, you should verify that the origin of the message's sender
            // was the origin and source you expected. This is easily done for the
            // unsandboxed frame. The sandboxed frame, on the other hand is more
            // difficult. Sandboxed iframes which lack the 'allow-same-origin'
            // header have "null" rather than a valid origin. This means you still
            // have to be careful about accepting data via the messaging API you
            // create. Check that source, and validate those inputs!
            if ((e.origin === "null" || e.origin === that.frameDomain()) && e.source === iframe.contentWindow) {
                if (e.data.type == 'pong') {
                    that.isIframeInitialised = true;
                } else if(e.data.type=="save") {
                    that.saveEvent(calendar, e.data);
                } else if(e.data.type=="saveAll") {
                    that.saveAllEvents(calendar, e.data);
                } else if(e.data.type=="deleteCalendar") {
                    that.deleteCalendar(calendar, e.data);
                } else if(e.data.type=="delete") {
                    that.deleteEvent(calendar, e.data);
                } else if(e.data.type=="displaySpinner") {
                    that.displaySpinner();
                } else if(e.data.type=="removeSpinner") {
                    that.removeSpinner();
                } else if(e.data.type=="displayMessage") {
                    that.displayMessage(e.data.message);
                } else if(e.data.type=="loadAdditional") {
                    that.loadAdditional(calendar, e.data.year, e.data.month, 'loadAdditional');
                } else if(e.data.type=="downloadEvent") {
                    that.downloadEvent(calendar, e.data.title, e.data.event);
                } else if(e.data.type=="sendEventToNativeEmailClient") {
                    that.sendEventToNativeEmailClient(e.data.calendarName, e.data.id, e.data.year, e.data.month, e.data.isRecurring, e.data.title);
                } else if(e.data.type=="emailEvent") {
                    that.emailEvent(e.data.calendarName, e.data.id, e.data.year, e.data.month, e.data.isRecurring, e.data.title);
                } else if(e.data.type=="shareCalendarEvent") {
                    that.shareCalendarEvent(e.data.calendarName, e.data.id, e.data.year, e.data.month, e.data.isRecurring);
                } else if (e.data.action == 'requestRenameCalendar') {
                    that.renameCalendarRequest(calendar, e.data.calendar);
                } else if (e.data.action == 'requestCalendarColorChange') {
                    that.calendarColorChangeRequest(calendar, e.data.calendarName, e.data.newColor);
                } else if (e.data.action == 'requestAddCalendar') {
                    that.addCalendarRequest(calendar, e.data.newColor);
                } else if (e.data.action == 'requestChoiceSelection') {
                    that.requestChoiceSelection(e.data.method, e.data.includeChangeAll);
                } else if(e.data.action=="shareCalendar") {
                    that.shareCalendar(e.data.calendar);
                }
            }
        });
	    // Note that we're sending the message to "*", rather than some specific
            // origin. Sandboxed iframes which lack the 'allow-same-origin' header
            // don't have an origin which you can target: you'll have to send to any
            // origin, which might alow some esoteric attacks. Validate your output!
        let date = new Date();
        let year = 1900 + date.getYear();
        let month = date.getMonth() + 1;
        that.initialiseIFrameCommunication(iframe, function(){
            if (that.importFile != null) {
                that.importICSFile(calendar, year, month);
            } else if (that.importCalendarPath != null) {
                if (that.loadCalendarAsGuest) {
                    let pathArr = that.importCalendarPath.split('/').filter(n => n.length > 0)
                    let calendarDirectory = pathArr[pathArr.length - 1];
                    that.readCalendarFile(calendar, that.owner, calendarDirectory).thenApply(function(json) {
                        that.calendarProperties = new Object();
                        that.calendarProperties.calendars = [];
                        that.calendarProperties.calendars.push({name: json.name, owner: that.owner,
                           directory: calendarDirectory, color: json.color});
                       that.loadCalendars(calendar, year, month);
                    });
                } else {
                    that.importSharedCalendar(calendar, year, month);
                }
            } else {
                that.load(calendar, year, month);
            }
        }, 100);
	},
	closeShare: function() {
            this.showShare = false;
        },
        shareWith: function(app, filename, allowReadWriteSharing, allowCreateSecretLink, nameToDisplay) {
            let dirPath = this.context.username + "/.apps/" + app;
            this.showShareWithForFile(dirPath, filename, allowReadWriteSharing, allowCreateSecretLink, nameToDisplay);
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
        requestChoiceSelection: function(method, includeChangeAll) {
	    let that = this;
        this.choice_message = method + ' ' + this.translate('CALENDAR.EVENT');
        this.choice_body = '';
        this.choice_consumer_func = (index) => {
            //console.log("response=" + response);
            let chosenIndex = includeChangeAll ? index : index + 1;
            that.postMessage({type: 'respondChoiceSelection', optionIndex: chosenIndex, method: method});
        };
        let options = [];
        if (includeChangeAll) {
            options.push(this.translate('CALENDAR.ALL.EVENTS'));
        }
        options.push(this.translate('CALENDAR.THIS.EVENT'));
        options.push(this.translate('CALENDAR.FUTURE.EVENTS'));
        this.choice_options = options;
        this.showChoice = true;
	},
    renameCalendarRequest: function(calendar, calendarItem) {
        let that = this;
        this.prompt_placeholder = this.translate('CALENDAR.NEW.NAME');
        this.prompt_value = calendarItem.name;
        this.prompt_message = this.translate('CALENDAR.ENTER.NAME');
        this.prompt_max_input_size = 20;
        this.prompt_consumer_func = function(prompt_result) {
            if (prompt_result === null)
                return;
            if (prompt_result === calendarItem.name)
                return;
            let newName = prompt_result.trim();
            if (newName === '')
                return;
            if (newName === '.' || newName === '..')
                return;
            if (!newName.match(/^[a-z\d\-_\s]+$/i)) {
                that.showMessage(true, that.translate('CALENDAR.INVALID.NAME'));
                return;
            }
            setTimeout(function(){
                //make sure names are unique
                for (var i=0;i < that.calendarProperties.calendars.length; i++) {
                    let calendar = that.calendarProperties.calendars[i];
                    if (calendar.name == newName) {
                        return;
                    }
                }
                var calendarToChange = null;
                for (var i=0;i < that.calendarProperties.calendars.length; i++) {
                    let calendar = that.calendarProperties.calendars[i];
                    if (calendar.name == calendarItem.name) {
                        calendarToChange = calendar;
                        break;
                    }
                }
                calendarToChange.name = newName;
                calendarItem.name = newName;
                that.displaySpinner();
                that.updatePropertiesFile(calendar, that.calendarProperties).thenApply(res => {
                    that.removeSpinner();
                    that.postMessage({type: 'respondRenameCalendar', calendar: calendarItem});
                });
            });
        };
        this.showPrompt =  true;
    },
    addCalendarRequest: function(calendar, newColor) {
        let that = this;
        this.prompt_placeholder = this.translate('CALENDAR.NEW.NAME');
        this.prompt_value = "";
        this.prompt_message = this.translate('CALENDAR.ENTER.NAME');
        this.prompt_max_input_size = 20;
        this.prompt_consumer_func = function(prompt_result) {
            if (prompt_result === null)
                return;
            let newName = prompt_result.trim();
            if (newName === '')
                return;
            if (newName === '.' || newName === '..')
                return;
            if (!newName.match(/^[a-z\d\-_\s]+$/i)) {
                that.showMessage(true, that.translate('CALENDAR.INVALID.NAME'));
                return;
            }
            setTimeout(function(){
                //make sure names are unique
                for (var i=0;i < that.calendarProperties.calendars.length; i++) {
                    let calendar = that.calendarProperties.calendars[i];
                    if (calendar.name == newName) {
                        return;
                    }
                }
                //create directory
                that.displaySpinner();
                let newId = String(that.calendarProperties.calendars.length + 1);
                let dirName = that.generateDirectoryName();
                that.calendarProperties.calendars.push({name:newName, directory:dirName, color: newColor, shareable: true});
                that.createCalendarFile(calendar, dirName, {name:newName, color: newColor}).thenApply(done => {
                    that.updatePropertiesFile(calendar, that.calendarProperties).thenApply(res => {
                        that.removeSpinner();
                        that.postMessage({type: 'respondAddCalendar', newId: newId, newName: newName, newColor: newColor});
                    });
                });
            });
        };
        this.showPrompt =  true;
    },
    isString: function(x) {
        return typeof x === 'string' || x instanceof String;
    },
    calendarColorChangeRequest: function(calendar, calendarName, newColor) {
        let that = this;
        if (!this.isString(newColor)) {
            return;
        }
        for (var i=0;i < that.calendarProperties.calendars.length; i++) {
            let calendar = that.calendarProperties.calendars[i];
            if (calendar.name == calendarName) {
                calendar.color = newColor;
                break;
            }
        }
        that.displaySpinner();
        that.updatePropertiesFile(calendar, that.calendarProperties).thenApply(res => {
            that.removeSpinner();
            that.postMessage({type: 'respondCalendarColorChange', calendarName: calendarName, newColor: newColor});
        });
    },
    //https://stackoverflow.com/questions/105034/how-to-create-guid-uuid
    generateDirectoryName: function() {
      return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
      ).substring(0, 8);
    },
    importICSFile: function(calendar, year, month) {
        let that = this;
        if (that.loadCalendarAsGuest) {
            that.postMessage({type: 'importICSFile', contents: that.importFile,
                isSharedWithUs: that.owner != that.context.username, loadCalendarAsGuest: that.loadCalendarAsGuest,
                username: that.context.username, confirmImport: that.confirmImport });
        } else {
            let importCalendarEventParams = {contents: that.importFile,
                isSharedWithUs: that.owner != that.context.username,
                loadCalendarAsGuest: that.loadCalendarAsGuest,
                username: that.context.username };
            this.loadCalendars(calendar, year, month, importCalendarEventParams);
        }
    },
    loadAdditional: function(calendar, year, month, messageType) {
        let that = this;
        this.getCalendarEventsForMonth(calendar, year, month).thenApply(function(allEvents) {
            that.loadAdditionalEvents(year, month, messageType, allEvents);
        });
    },
    loadAdditionalEvents: function(year, month, messageType, eventsThisMonth) {
        let that = this;
        let yearMonth = year * 12 + (month -1);
        that.postMessage({type: messageType, currentMonth: eventsThisMonth
            , yearMonth: yearMonth });
    },
    importSharedCalendar: function(calendar, year, month) {
        let that = this;
        let calendarDirectory = this.importCalendarPath.substring(this.importCalendarPath.lastIndexOf('/') +1);
        let existingCalendar = this.getCalendarForDirectory(calendarDirectory);
        if (existingCalendar != null) {
            that.showMessage(true, that.translate("CALENDAR.ALREADY.IMPORTED").replace("$NAME", existingCalendar.name));
            that.removeSpinner();
            that.close();
        } else {
            this.readCalendarFile(calendar, this.owner, calendarDirectory).thenApply(function(json) {
               that.removeSpinner();
               that.confirmImportCalendar(json.name,
                   () => {
                        that.showConfirm = false;
                        that.importCalendar(calendar, year, month, calendarDirectory, json.name, json.color);
                   },
                   () => { that.showConfirm = false; that.close();}
               );
            });
        }
    },
    importCalendar: function(calendar, year, month, directory, name, color) {
        let that = this;
        that.displaySpinner();
        let calendarName = name;
        var currentCalendarName = '' + calendarName;
        //make sure names are unique
        var done = false;
        var counter = 1;
        while (!done) {
            if (!that.calendarExists(currentCalendarName)) {
                done = true;
            } else {
                currentCalendarName = calendarName + ' (' + counter + ')';
                counter++;
            }
        }
        that.calendarProperties.calendars.push({name:currentCalendarName, owner: that.owner,
            directory: directory, color: color});
        that.updatePropertiesFile(calendar, that.calendarProperties).thenApply(res => {
            that.load(calendar, year, month);
        });
    },
    load: function(calendar, year, month) {
        let that = this;
        that.updateCalendarList(calendar).thenApply(function(modified) {
            if (modified) {
                that.updatePropertiesFile(calendar, that.calendarProperties).thenApply(res => {
                    that.loadCalendars(calendar, year, month);
                });
            } else {
                that.loadCalendars(calendar, year, month);
            }
        });
    },
    loadCalendars: function(calendar, year, month, importCalendarEventParams) {
        let that = this;
        that.getRecurringCalendarEvents(calendar).thenApply(function(recurringEvents) {
            that.getCalendarEventsAroundMonth(calendar, year, month).thenApply(function(allEvents) {
                that.loadEvents(year, month, allEvents.previous, allEvents.current,
                        allEvents.next, recurringEvents, importCalendarEventParams);
            });
        });
    },

    loadEvents: function(year, month, eventsPreviousMonth, eventsThisMonth, eventsNextMonth, recurringEvents, importCalendarEventParams) {
        let that = this;
        let yearMonth = year * 12 + (month-1);
        let calendars = [];
        for(var i=0;i < that.calendarProperties.calendars.length;i++) {
            let calendar = that.calendarProperties.calendars[i];
            calendars.push({name: calendar.name, color: calendar.color, owner: calendar.owner, shareable: calendar.shareable});
        }
        Vue.nextTick(function() {
            that.postMessage({type: 'load', previousMonth: eventsPreviousMonth,
                currentMonth: eventsThisMonth, nextMonth: eventsNextMonth, recurringEvents: recurringEvents,
                yearMonth: yearMonth, username: that.context.username, calendars: calendars, importCalendarEventParams: importCalendarEventParams});
        });
    },
    postDeleteCalendar: function(calendar, data) {
        let that = this;
        this.calendarProperties.calendars.splice(this.calendarProperties.calendars.findIndex(v => v.id === data.id), 1);
        this.updatePropertiesFile(calendar, this.calendarProperties).thenApply(res => {
            that.removeSpinner();
            that.postMessage({type: 'respondDeleteCalendar', calendar: data});
        });
    },
    deleteCalendar: function(calendar, data) {
        let that = this;
        var isSharedCalendar = false;
        for (var i=0; i < that.calendarProperties.calendars.length; i++) {
            let calendar = that.calendarProperties.calendars[i];
            if (calendar.name == data.calendarName) {
                if (calendar.owner != null && calendar.owner != that.context.username) {
                    isSharedCalendar = true;
                }
                break;
            }
        }
        this.confirmDeleteCalendar(data.calendarName,
            () => { that.showConfirm = false;
        	    that.displaySpinner();
        	    if (isSharedCalendar) {
                    that.postDeleteCalendar(calendar, data);
        	    } else {
                    let dirPath = peergos.client.PathUtils.directoryToPath(
                        [that.findCalendarDirectory(data.calendarName)]);
                    calendar.deleteInternal(dirPath).thenApply(function(res) {
                        that.postDeleteCalendar(calendar, data);
                    }).exceptionally(function(throwable) {
                        if (throwable.toString() == "java.util.NoSuchElementException") { //Because calendar had no events
                            that.postDeleteCalendar(calendar, data);
                        } else {
                            that.removeSpinner();
                            that.showMessage(true, that.translate('CALENDAR.ERROR.DELETE'));
                            console.log(throwable.getMessage());
                        }
                    });
                }
            },
            () => { that.showConfirm = false;}
        );
    },
    confirmDeleteCalendar: function(calendarName, deleteCalendarFunction, cancelFunction) {

        this.confirm_message= this.translate("CALENDAR.DELETE.CONFIRM").replace("$NAME", calendarName);
        this.confirm_body='';
        this.confirm_consumer_cancel_func = cancelFunction;
        this.confirm_consumer_func = deleteCalendarFunction;
        this.showConfirm = true;
    },
    removeCalendarEvent: function(calendar, calendarName, year, month, id, isRecurring) {
        let calendarDirectory = this.findCalendarDirectory(calendarName);
        let dirPath =  isRecurring ? calendarDirectory + "/recurring" : calendarDirectory + "/" + year + "/" + month;
        let filename = id + this.CALENDAR_FILE_EXTENSION;
        let filePath = peergos.client.PathUtils.toPath(dirPath.split('/'), filename);
        return calendar.deleteInternal(filePath);
    },
    deleteEvent: function(calendar, item) {
	    const that = this;
	    that.displaySpinner();
        this.removeCalendarEvent(calendar, item.calendarName, item.year, item.month, item.Id, item.isRecurring).thenApply(function(res) {
	        that.removeSpinner();
        }).exceptionally(function(throwable) {
            that.showMessage(true, that.translate("CALENDAR.ERROR.DELETE.EVENT"));
            console.log(throwable.getMessage());
	        that.removeSpinner();
        });
    },
    displaySpinner: function() {
        this.showSpinner = true;
    },
    removeSpinner: function() {
        this.showSpinner = false;
    },
    displayMessage: function(msg) {
        this.showMessage(true, msg);
    },
    getPropertiesFile: function(calendar) {
        let that = this;
        let filePath = peergos.client.PathUtils.directoryToPath([this.CONFIG_FILENAME]);
        return calendar.readInternal(filePath).thenApply(data => {
            return JSON.parse(new TextDecoder().decode(data));
        }).exceptionally(function(throwable) {//File not found
            if (throwable.detailMessage.startsWith("File not found")) {
                let props = new Object();
                props.calendars = [];
                props.calendars.push({name: 'My Calendar', directory: 'default', color: '#00a9ff'});
                return props;
            } else {
                that.showMessage(true, that.translate('CALENDAR.ERROR.LOAD.FILE'));
            }
        });
    },
    updatePropertiesFile: function(calendar, json) {
        let filePath = peergos.client.PathUtils.directoryToPath([this.CONFIG_FILENAME]);
        let encoder = new TextEncoder();
        let uint8Array = encoder.encode(JSON.stringify(json));
        let bytes = convertToByteArray(uint8Array);
        return calendar.writeInternal(filePath, bytes);
    },
    readCalendarFile: function(calendar, owner, directory) {
        let that = this;
        let filePath = peergos.client.PathUtils.directoryToPath([directory, this.NEW_CALENDAR_FILENAME]);
        return calendar.readInternal(filePath, owner).thenApply(data => {
            return JSON.parse(new TextDecoder().decode(data));
        }).exceptionally(function(throwable) {//File not found
            let props = new Object();
            props.calendars = [];
            props.calendars.push({name: this.owner + "-shared", color: '#00a9ff'});
            return props;
        });
    },
    createCalendarFile: function(calendar, directory, json) {
        let filePath = peergos.client.PathUtils.directoryToPath([directory, this.NEW_CALENDAR_FILENAME]);
        let encoder = new TextEncoder();
        let uint8Array = encoder.encode(JSON.stringify(json));
        let bytes = convertToByteArray(uint8Array);
        return calendar.writeInternal(filePath, bytes);
    },
    calendarExists: function(calendarName) {
        for (var i=0; i < this.calendarProperties.calendars.length; i++) {
            let calendar = this.calendarProperties.calendars[i];
            if (calendar.name == calendarName) {
                return true;
            }
        }
        return false;
    },
    getCalendarForDirectory: function(calendarDirectory) {
        for (var i=0; i < this.calendarProperties.calendars.length; i++) {
            let calendar = this.calendarProperties.calendars[i];
            if (calendar.directory == calendarDirectory) {
                return calendar;
            }
        }
        return null;
    },
    findCalendarDirectory: function(calendarName) {
        for (var i=0; i < this.calendarProperties.calendars.length; i++) {
            let calendar = this.calendarProperties.calendars[i];
            if (calendar.name == calendarName) {
                return calendar.directory;
            }
        }
        return "default";
    },
    updateCalendarEvent: function(calendar, item) {
        let calendarDirectory = this.findCalendarDirectory(item.calendarName);
        let dirPath =  item.isRecurring ? calendarDirectory + "/recurring" : calendarDirectory + "/" + item.year + "/" + item.month;
        let filename = item.Id + this.CALENDAR_FILE_EXTENSION;
        let filePath = peergos.client.PathUtils.toPath(dirPath.split('/'), filename);
        let encoder = new TextEncoder();
        let uint8Array = encoder.encode(item.item);
        let bytes = convertToByteArray(uint8Array);
        return calendar.writeInternal(filePath, bytes);
    },
    saveEvent: function(calendar, item) {
	    const that = this;
	    that.displaySpinner();
	    if (item.action == "createRecurring") {
            this.moveEvent(calendar, item, false);
	    } else if (item.action == "deleteRecurring") {
            this.moveEvent(calendar, item, true);
	    } else {
            if(item.calendarName == item.previousCalendarName) {
                this.updateCalendarEvent(calendar, item).thenApply(function(res) {
                    that.removeSpinner();
                }).exceptionally(function(throwable) {
                    that.showMessage(true, that.translate('CALENDAR.ERROR.SAVE.EVENT'));
                    console.log(throwable.getMessage());
                    that.removeSpinner();
                });
            } else {
                this.moveEvent(calendar, item, item.isRecurring);
            }
	    }
    },
    moveEvent: function(calendar, item, removeRecurring) {
        const that = this;
        this.removeCalendarEvent(calendar, item.previousCalendarName, item.year, item.month, item.Id, removeRecurring).thenApply(function(res) {
            that.updateCalendarEvent(calendar, item).thenApply(function(res2) {
                that.removeSpinner();
            }).exceptionally(function(throwable) {
                that.showMessage(true, that.translate('CALENDAR.ERROR.SAVE.MOVED.EVENT') + ". " + that.translate('CALENDAR.RECREATE.EVENT'));
                console.log(throwable.getMessage());
                that.removeSpinner();
            });
        }).exceptionally(function(throwable) {
            that.showMessage(true, that.translate('CALENDAR.ERROR.MOVE.EVENT'));
            console.log(throwable.getMessage());
            that.removeSpinner();
        });
    },
    getMirrorBatId(file) {
        return file.getOwnerName() == this.context.username ? this.mirrorBatId : java.util.Optional.empty()
    },
    bulkUpload: function(uploadParams) {
       let uploadFuture = peergos.shared.util.Futures.incomplete();
       if (uploadParams.uploadPaths.length == 0) {
           uploadFuture.complete(true);
       } else {
           let folderUPList = [];
           for(var i = 0 ; i <  uploadParams.uploadPaths.length; i++) {
               let relativePath = uploadParams.uploadPaths[i];
               let pathList = peergos.client.JsUtil.asList(relativePath.split('/').filter(n => n.length > 0));
               let filePropsList = peergos.client.JsUtil.asList(uploadParams.fileUploadProperties[i]);
               let folderUP = new peergos.shared.user.fs.FileWrapper.FolderUploadProperties(pathList, filePropsList);
               folderUPList.push(folderUP);
           }
           var commitWatcher = {
               get_0: function() {
                   if (uploadParams.progress.done >= uploadParams.progress.max) {
                       setTimeout(() => that.$toast.dismiss(uploadParams.progress.name), 1000);
                   }
                   return true;
               }
           };

           let folderStream = peergos.client.JsUtil.asList(folderUPList).stream();
           let that = this;
           let resumeFileUpload = function(f) {
               let future = peergos.shared.util.Futures.incomplete();
               future.complete(true);
               return future;
           }
           this.context.getByPath(uploadParams.directoryPath).thenApply(uploadDir => {
               uploadDir.ref.uploadSubtree(folderStream, that.getMirrorBatId(uploadDir.ref), that.context.network,
                   that.context.crypto, that.context.getTransactionService(),
                   f => resumeFileUpload(f),
                   commitWatcher).thenApply(res => {
                       uploadFuture.complete(true);
               }).exceptionally(function (throwable) {
                    that.removeSpinner();
                    that.showMessage(true, that.translate('CALENDAR.ERROR.UPLOAD'));
                    console.log(throwable.getMessage());
                    uploadFuture.complete(false);
               });
           });
       }
       return uploadFuture;
    },
    prepareImportCalendarEvent: function(item, uploadParams) {
        let that = this;

        let calendarDirectory = this.findCalendarDirectory(item.calendarName);
        let dirPath =  item.isRecurring ? calendarDirectory + "/recurring" : calendarDirectory + "/" + item.year + "/" + item.month;
        let filename = item.Id + this.CALENDAR_FILE_EXTENSION;
        let encoder = new TextEncoder();
        let uint8Array = encoder.encode(item.item);
        let bytes = convertToByteArray(uint8Array);
        let fileSize = uint8Array.byteLength;

        var updater = {
            done:0,
            max:fileSize,
        };

        let updateProgressBar = function(len){
            updater.done += len.value_0;
            if (updater.done > updater.max) {
                uploadParams.progress.done  = uploadParams.progress.done + 1;
                //console.log('uploadParams.progress.done=' + uploadParams.progress.done + " uploadParams.progress.max=" + uploadParams.progress.max);
                that.$toast.update(uploadParams.progress.name,
                   {content:
                        {
                            component: ProgressBar,
                            props:  {
                            title: uploadParams.progress.title,
                            done: uploadParams.progress.done,
                            max: uploadParams.progress.max
                            },
                        }
                   });
            }
        };

        var foundDirectoryIndex = -1;
        let uploadDirectoryPath = dirPath;
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
        let reader = new peergos.shared.user.fs.AsyncReader.ArrayBacked(bytes);
        let fup = new peergos.shared.user.fs.FileWrapper.FileUploadProperties(filename, {get_0: () => reader},
            (fileSize - (fileSize % Math.pow(2, 32))) / Math.pow(2, 32), fileSize, java.util.Optional.empty(), java.util.Optional.empty(), false,
            true, updateProgressBar);
        let fileUploadList = uploadParams.fileUploadProperties[foundDirectoryIndex];
        fileUploadList.push(fup);
    },
    saveAllEvents: function(calendar, data) {
        this.removeSpinner();
        let name = 'bulkImport';
        let title = this.translate("CALENDAR.IMPORT.MSG").replace("$ITEMS", data.items.length);
        var progress = {
            title:title,
            done:0,
            max:data.items.length,
            name: name
        };
        let uploads = {
            directoryPath: this.context.username + "/.apps/calendar/data/",
            uploadPaths: [],
            fileUploadProperties: [],
            progress: progress,
            name: name,
            title: title
        };
        if (!data.showConfirmation) {
            this.$toast(
                {component: ProgressBar,props:  progress} ,
                { icon: false , timeout:false, id: name});
        }
        this.saveAllEventsRecursive(calendar, data.items, 0, data.showConfirmation, uploads);
    },
    saveAllEventsRecursive: function(calendar, items, index, showConfirmation, uploads) {
        const that = this;
        if (index == items.length) {
            if (showConfirmation) {
                that.removeSpinner();
                that.close();
            } else {
                this.bulkUpload(uploads).thenApply(done => {
                    that.removeSpinner();
                    if (done) {
                        that.showMessage(false, that.translate('CALENDAR.IMPORT.COMPLETE'));
                    }
                });
            }
        } else {
            let item = items[index];
            if (showConfirmation) {
                this.confirmImportEventFile(item.summary,
                    () => { that.showConfirm = false; that.importEventFile(calendar, items, index, showConfirmation, uploads);},
                    () => { that.showConfirm = false; that.saveAllEventsRecursive(calendar, items, ++index, showConfirmation, uploads);}
                );
            } else {
                this.importEventFile(calendar, items, index, showConfirmation, uploads);
            }
        }
    },
    importEventFile: function(calendar, items, index, showConfirmation, uploads) {
        let that = this;
        let item = items[index];
        that.displaySpinner();
        if (showConfirmation) {
            this.updateCalendarEvent(calendar, item).thenApply(function(res) {
                that.postMessage({type: 'respondConfirmImportICSFile', item: item, index: index});
                that.saveAllEventsRecursive(calendar, items, ++index, showConfirmation, uploads);
            }).exceptionally(function(throwable) {
                that.removeSpinner();
                that.close();
                that.showMessage(true, that.translate('CALENDAR.ERROR.IMPORT.EVENT'));
                console.log(throwable.getMessage());
            });
        } else {
            this.prepareImportCalendarEvent(item, uploads);
            this.saveAllEventsRecursive(calendar, items, ++index, showConfirmation, uploads);
        }
    },
    confirmImportEventFile: function(summary, importFunction, cancelFunction) {
        this.confirm_message= this.translate('CALENDAR.IMPORT.EVENT') + ' ' + summary.datetime
                + ' - ' + summary.title + ' ?';
        this.confirm_body='';
        this.confirm_consumer_cancel_func = cancelFunction;
        this.confirm_consumer_func = importFunction;
        this.showConfirm = true;
    },
    confirmImportCalendar: function(calendarName, importFunction, cancelFunction) {
        this.confirm_message= this.translate('CALENDAR.IMPORT.CALENDAR') + ' ' + calendarName + ' ?';
        this.confirm_body='';
        this.confirm_consumer_cancel_func = cancelFunction;
        this.confirm_consumer_func = importFunction;
        this.showConfirm = true;
    },
    getRecurringCalendarEvents: function(calendar) {
        let that = this;
        let accumulator = [];
        let future = peergos.shared.util.Futures.incomplete();
        if (that.calendarProperties.calendars.length == 0) {
            future.complete(accumulator);
        }
        that.calendarProperties.calendars.forEach(currentCalendar => {
            let dirStr = currentCalendar.directory + "/recurring";
            let directoryPath = peergos.client.PathUtils.directoryToPath(dirStr.split('/'));
            calendar.dirInternal(directoryPath, currentCalendar.owner).thenApply(filenames => {
                that.getEventsForMonth(calendar, currentCalendar.name, currentCalendar.owner, dirStr, filenames.toArray([])).thenApply(res => {
                    accumulator.push(res);
                    if (accumulator.length == that.calendarProperties.calendars.length) {
                        future.complete(accumulator.reduce((a, b) => a.concat(b), []));
                    }
                })
            });
        });
        return future;
    },
    getCalendarEventsForMonth: function(calendar, year, month) {
        let that = this;
        let accumulator = [];
        let future = peergos.shared.util.Futures.incomplete();
        if (that.calendarProperties.calendars.length == 0) {
            future.complete(accumulator);
        }
        that.calendarProperties.calendars.forEach(currentCalendar => {
            let dirStr = currentCalendar.directory + "/" + year + "/" + month;
            let directoryPath = peergos.client.PathUtils.directoryToPath(dirStr.split('/'));
            calendar.dirInternal(directoryPath, currentCalendar.owner).thenApply(filenames => {
                that.getEventsForMonth(calendar, currentCalendar.name, currentCalendar.owner, dirStr, filenames.toArray([])).thenApply(res => {
                    accumulator.push(res);
                    if (accumulator.length == that.calendarProperties.calendars.length) {
                        future.complete(accumulator.reduce((a, b) => a.concat(b), []));
                    }
                })
            });
        });
        return future;
    },
    updateCalendarList: function(calendar) {
        let that = this;
        let modified = [false];
        let calendarsToDelete = [];
        let processed = [];
        let future = peergos.shared.util.Futures.incomplete();
        if (that.calendarProperties.calendars.length == 0) {
            future.complete(false);
        }
        that.calendarProperties.calendars.forEach(currentCalendar => {
            let directoryPath = peergos.client.PathUtils.directoryToPath(currentCalendar.directory.split('/'));
            calendar.dirInternal(directoryPath, currentCalendar.owner).thenApply(filenames => {
                if (filenames.isEmpty() && currentCalendar.owner != null) { //unshared or deleted
                    calendarsToDelete.push(currentCalendar.directory);
                    modified[0] = true;
                }
                processed.push(currentCalendar.name);
                if (processed.length == that.calendarProperties.calendars.length) {
                    calendarsToDelete.forEach(directory => {
                        let index = that.calendarProperties.calendars.findIndex(v => v.directory === directory);
                        that.calendarProperties.calendars.splice(index, 1);
                    });
                    future.complete(modified[0]);
                }
            });
        });
        return future;
    },
    getCalendarEventsAroundMonth: function(calendar, year, month) {
        let that = this;
        let previousMonth = month == 1 ? {name: 'previous', year:year -1, month: 12}
                : {name: 'previous', year: year, month:month -1};
        let currentMonth = {name: 'current', year: year, month: month};
        let nextMonth = month == 12 ? {name: 'next', year:year +1, month:1}
                : {name: 'next', year:year, month:month +1};

        let loop = [previousMonth, currentMonth, nextMonth];
        let future = peergos.shared.util.Futures.incomplete();
        const resultMap = new Map();
        loop.forEach(currentMonth => {
            that.getCalendarEventsForMonth(calendar, currentMonth.year, currentMonth.month).thenApply(res => {
                    resultMap.set(currentMonth.name, res);
                    if (resultMap.size == 3) {
                        let result = {previous: resultMap.get('previous'), current: resultMap.get('current'), next: resultMap.get('next')};
                        future.complete(result);
                    }
            })
        });
        return future;
    },
    getEventsForMonth: function(calendar, calendarName, owner, directory, filenames) {
        let that = this;
        let accumulator = [];
        let future = peergos.shared.util.Futures.incomplete();
        if (filenames.length == 0) {
            future.complete(accumulator);
        }
        filenames.forEach(eventFilename => {
            let filePath = peergos.client.PathUtils.toPath(directory.split('/'), eventFilename);
            calendar.readInternal(filePath, owner).thenApply(data => {
                accumulator.push({calendarName: calendarName, data: new TextDecoder().decode(data)});
                if (accumulator.length == filenames.length) {
                    future.complete(accumulator);
                }
            });
        });
        return future;
    },
    downloadEvent: function(calendar, title, event) {
        this.displaySpinner();
        let encoder = new TextEncoder();
        let uint8Array = encoder.encode(event);
        let data = convertToByteArray(uint8Array);
        let blob =  new Blob([data], {type: "octet/stream"});
        let url = window.URL.createObjectURL(blob);
        let link = document.getElementById("downloadEventAnchor");
        link.href = url;
        link.type = "text/calendar";
        link.download = this.translate('CALENDAR.EVENT') + ' - ' + title + '.ics';
        link.click();
        this.removeSpinner();
    },
    sendEventToNativeEmailClient: function(calendarName, id, year, month, isRecurring, title) {
        let calendarDirectory = this.findCalendarDirectory(calendarName);
        let dirPath =  isRecurring ? calendarDirectory + "/recurring" : calendarDirectory + "/" + year + "/" + month;
        let path = this.context.username + "/.apps/" + this.CALENDAR_DIR_NAME + '/' + this.DATA_DIR_NAME + "/" + dirPath;
        let filename = id + '.ics';
        let that = this;
        this.context.getByPath(path + '/' + filename).thenApply(fileOpt => {
            if (fileOpt.isPresent()) {
                let file = fileOpt.get();
                let json = {open:true, secretLink:true,link:file.toLink()};
                let body = that.translate('CALENDAR.EVENT.LINK') + ': ' + window.location.origin + window.location.pathname + "#" + propsToFragment(json);
                var link = document.createElement("a");
                link.href = "mailto:?subject=" + escape(title) + "&body=" + body;
                link.click();
            }
        });
    },
    emailEvent: function(calendarName, id, year, month, isRecurring, title) {
        let calendarDirectory = this.findCalendarDirectory(calendarName);
        let dirPath =  isRecurring ? calendarDirectory + "/recurring" : calendarDirectory + "/" + year + "/" + month;
        let path = this.context.username + "/.apps/" + this.CALENDAR_DIR_NAME + '/' + this.DATA_DIR_NAME + "/" + dirPath;
        let filename = id + '.ics';
        this.openFileOrDir("Email", path, {filename:filename});
    },
    updateSharedFile: function() {
        var file = this.filesToShare[0];
        if (file == null)
            return;
        var that = this;
        file.getLatest(this.context.network).thenApply(updated => {
            that.filesToShare[0] = updated;
        })
    },
    shareCalendarEvent: function(calendarName, id, year, month, isRecurring) {
        let calendarDirectory = this.findCalendarDirectory(calendarName);
        let dirPath =  isRecurring ? calendarDirectory + "/recurring" : calendarDirectory + "/" + year + "/" + month;
        this.shareWith(this.CALENDAR_DIR_NAME + '/' + this.DATA_DIR_NAME + "/" + dirPath,
            id + '.ics', false, true, 'Calendar Event');
    },
    shareCalendar: function(calendar) {
        let calendarDirectory = this.findCalendarDirectory(calendar.name);
        this.shareWith(this.CALENDAR_DIR_NAME + '/' + this.DATA_DIR_NAME, calendarDirectory, false, true,
            this.translate('CALENDAR.LABEL') + ' - ' + calendar.name);
    },
    showMessage: function(isError, message) {
        if (isError) {
            this.$toast.error(message, {timeout:false});
        } else {
            this.$toast(message)
        }
    },
    close: function () {
        //this.$emit("hide-calendar");
    }
    }
}
</script>

<style>
.calendar-view main{
	display: flex;
	align-items: center;
	justify-content: center;
	min-height: 100vh;
}

</style>
