<template>
	<article class="app-view calendar-view">
		<AppHeader>
			<template #primary>
				<h1>{{ translate("CALENDAR.TITLE") }}</h1>
			</template>
		</AppHeader>
		<main>
            <Spinner v-if="showSpinner" :message="spinnerMessage"></Spinner>
	    <iframe id="calendar-iframe" :src="frameUrl()" allow="clipboard-write" style="width:100%; flex:1; min-height:0" frameBorder="0"></iframe>
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
		</main>
	</article>
</template>

<script>
const AppHeader = require("../components/AppHeader.vue");
const Choice = require('../components/choice/Choice.vue');
const Confirm = require("../components/confirm/Confirm.vue");
const ProgressBar = require("../components/drive/ProgressBar.vue");
const Prompt = require("../components/prompt/Prompt.vue");
const Spinner = require("../components/spinner/Spinner.vue");
const i18n = require("../i18n/index.js");

const routerMixins = require("../mixins/router/index.js");

module.exports = {
    components: {
        Choice,
        Confirm,
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
            calendarItemLinks: {},
            CONFIG_FILENAME: 'App.config',
            NEW_CALENDAR_FILENAME: 'calendar.inf',
            showSpinner: false,
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
            isCalendarReadOnly: false,
            hasEmail: false
        }
    },
	computed: {
		...Vuex.mapState([
			'context',
			'socialData',
			'mirrorBatId',
			'isDark',
		]),
		...Vuex.mapGetters([
			'isSecretLink',
			'getPath',
			'currentFilename',
			'currentTheme',
		]),
	},
	watch: {
		isDark() {
			this.postMessage({type: 'setTheme', currentTheme: this.currentTheme});
		}
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
                    that.isCalendarReadOnly = that.isSecretLink && !loadedParameters.isWritable;
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
        document.body.style.overflow = 'hidden';
    },
    beforeDestroy(){
        document.body.style.overflow = '';
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
                    owner: that.context.username, hasEmail: hasEmail, isWritable: true});
            } else {
                that.context.getByPath(path).thenApply(dirOpt => {
                    if (! dirOpt.isPresent()) {
                        that.$toast.error(that.translate('CALENDAR.ERROR.LOAD'), {timeout:false});
                        future.complete(null);
                    } else {
                        let dir = dirOpt.get();
                        let dirParts = path.split('/').filter(s => s.length > 0);
                        future.complete({importFile: null, importCalendarPath: path,
                            owner: dirParts[0], hasEmail: hasEmail, isWritable: dir.isWritable()});
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
    // Targeted at the frame's own origin rather than '*': these messages
    // carry the user's event contents and freshly minted secret links, and
    // frameUrl() builds the iframe's src from this same origin, so it can
    // never be anything else.
    postMessage: function(obj) {
    	var iframe = document.getElementById("calendar-iframe");
        if (this.isIframeInitialised) {
            iframe.contentWindow.postMessage(obj, this.frameDomain());
        } else {
            let that = this;
            this.sendPing(iframe);
            window.setTimeout(function() {that.postMessage(obj);}, 30);
        }
    },
    sendPing: function(iframe) {
        let theme = this.$store.getters.currentTheme;
        iframe.contentWindow.postMessage({type: 'ping', currentTheme: theme, hasEmail: this.hasEmail}, this.frameDomain());
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
        // Listen for response messages from the frame.
        window.addEventListener('message', function (e) {
            // The `e.source` identity check is what actually gates this: only
            // the calendar frame's own window can be the source, whatever
            // origin it reports. "null" is still accepted alongside the real
            // origin because a host embedding this page in a sandboxed
            // context reports an opaque origin. Everything past this point
            // is untrusted input and is validated before use - see
            // isSafeEventId/eventDirPath.
            if ((e.origin === "null" || e.origin === that.frameDomain()) && e.source === iframe.contentWindow) {
                if (e.data.type == 'pong') {
                    that.isIframeInitialised = true;
                } else if(e.data.type=="save") {
                    that.saveEvent(calendar, e.data);
                } else if(e.data.type=="deleteCalendar") {
                    that.deleteCalendar(calendar, e.data);
                } else if(e.data.type=="delete") {
                    that.deleteEvent(calendar, e.data);
                } else if(e.data.type=="removeSpinner") {
                    that.removeSpinner();
                } else if(e.data.type=="saveAll") {
                    that.saveAllEvents(calendar, e.data);
                } else if(e.data.type=="downloadIcs") {
                    that.downloadIcsFile(e.data.filename, e.data.item);
                } else if(e.data.type=="emailEvent") {
                    that.emailEvent(e.data);
                } else if(e.data.type=="loadAdditional") {
                    that.loadAdditional(calendar, e.data.year, e.data.month, 'loadAdditional');
                } else if (e.data.action == 'requestRenameCalendar') {
                    that.renameCalendarRequest(calendar, e.data.calendar, e.data.newName);
                } else if (e.data.action == 'requestCalendarColorChange') {
                    that.calendarColorChangeRequest(calendar, e.data.calendarName, e.data.newColor);
                } else if (e.data.action == 'requestAddCalendar') {
                    that.addCalendarRequest(calendar, e.data.newColor, e.data.newName);
                } else if (e.data.action == 'shareStateRequest') {
                    that.sendShareState(e.data);
                } else if (e.data.action == 'shareAddUser') {
                    that.shareCalendarItemWith(e.data);
                } else if (e.data.action == 'shareRemoveUser') {
                    that.unshareCalendarItemWith(e.data);
                } else if (e.data.action == 'shareCreateLink') {
                    that.createCalendarItemLink(e.data);
                } else if (e.data.action == 'shareRevokeLink') {
                    that.revokeCalendarItemLink(e.data);
                }
            }
        });
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
    renameCalendarRequest: function(calendar, calendarItem, suppliedName) {
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
                        that.showMessage(true, that.nameExistsMessage(newName));
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
                let previousName = calendarItem.name;
                calendarToChange.name = newName;
                calendarItem.name = newName;
                that.displaySpinner();
                that.updatePropertiesFile(calendar, that.calendarProperties).thenApply(res => {
                    that.removeSpinner();
                    that.postMessage({type: 'respondRenameCalendar', calendar: calendarItem});
                }).exceptionally(function(throwable) {
                    calendarToChange.name = previousName;
                    calendarItem.name = previousName;
                    that.removeSpinner();
                    that.showMessage(true, that.translate('CALENDAR.ERROR.SAVE'));
                    return null;
                });
            });
        };
        // The calendar app collects the name in its own modal; reuse this
        // consumer (validation + uniqueness live in it) instead of asking
        // a second time. Falls back to the prompt when none was supplied.
        if (suppliedName != null && suppliedName.length > 0) {
            this.prompt_consumer_func(suppliedName);
            return;
        }
        this.showPrompt =  true;
    },
    addCalendarRequest: function(calendar, newColor, suppliedName) {
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
                        that.showMessage(true, that.nameExistsMessage(newName));
                        return;
                    }
                }
                //create directory
                that.displaySpinner();
                let newId = String(that.calendarProperties.calendars.length + 1);
                let dirName = that.generateDirectoryName();
                let entry = {name:newName, directory:dirName, color: newColor, shareable: true};
                that.calendarProperties.calendars.push(entry);
                let failed = function(throwable) {
                    that.dropCalendarEntry(entry);
                    that.removeSpinner();
                    that.showMessage(true, that.translate('CALENDAR.ERROR.SAVE'));
                    return null;
                };
                // Both chains are guarded rather than one: the inner future is
                // not returned, so a failure there never reaches the outer one.
                that.createCalendarFile(calendar, dirName, {name:newName, color: newColor}).thenApply(done => {
                    that.updatePropertiesFile(calendar, that.calendarProperties).thenApply(res => {
                        that.removeSpinner();
                        that.postMessage({type: 'respondAddCalendar', newId: newId, newName: newName, newColor: newColor});
                    }).exceptionally(failed);
                }).exceptionally(failed);
            });
        };
        // The calendar app collects the name in its own modal; reuse this
        // consumer (validation + uniqueness live in it) instead of asking
        // a second time. Falls back to the prompt when none was supplied.
        if (suppliedName != null && suppliedName.length > 0) {
            this.prompt_consumer_func(suppliedName);
            return;
        }
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
        let changed = null;
        let previousColor = null;
        for (var i=0;i < that.calendarProperties.calendars.length; i++) {
            let entry = that.calendarProperties.calendars[i];
            if (entry.name == calendarName) {
                changed = entry;
                previousColor = entry.color;
                entry.color = newColor;
                break;
            }
        }
        that.displaySpinner();
        that.updatePropertiesFile(calendar, that.calendarProperties).thenApply(res => {
            that.removeSpinner();
            that.postMessage({type: 'respondCalendarColorChange', calendarName: calendarName, newColor: newColor});
        }).exceptionally(function(throwable) {
            if (changed != null)
                changed.color = previousColor;
            that.removeSpinner();
            that.showMessage(true, that.translate('CALENDAR.ERROR.SAVE'));
            return null;
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
        // The list is updated in memory before the file is written, so a
        // failed write has to take the entry back out - otherwise the view
        // keeps a calendar the stored file never got, and the next successful
        // write persists it.
        let entry = {name:currentCalendarName, owner: that.owner,
            directory: directory, color: color};
        that.calendarProperties.calendars.push(entry);
        that.updatePropertiesFile(calendar, that.calendarProperties).thenApply(res => {
            that.load(calendar, year, month);
        }).exceptionally(function(throwable) {
            that.dropCalendarEntry(entry);
            that.removeSpinner();
            that.showMessage(true, that.translate('CALENDAR.ERROR.SAVE'));
            return null;
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
            that.getTaskItems(calendar).thenApply(function(taskItems) {
                that.getCalendarEventsAroundMonth(calendar, year, month).thenApply(function(allEvents) {
                    that.loadEvents(year, month, allEvents.previous, allEvents.current,
                            allEvents.next, recurringEvents, taskItems, importCalendarEventParams);
                });
            });
        });
    },

    loadEvents: function(year, month, eventsPreviousMonth, eventsThisMonth, eventsNextMonth, recurringEvents, taskItems, importCalendarEventParams) {
        let that = this;
        let yearMonth = year * 12 + (month-1);
        let calendars = [];
        for(var i=0;i < that.calendarProperties.calendars.length;i++) {
            let calendar = that.calendarProperties.calendars[i];
            calendars.push({name: calendar.name, color: calendar.color, owner: calendar.owner, shareable: calendar.shareable});
        }
        Vue.nextTick(function() {
            let username = (that.loadCalendarAsGuest && !that.isCalendarReadOnly) ? that.owner : that.context.username;
            that.postMessage({type: 'load', previousMonth: eventsPreviousMonth,
                currentMonth: eventsThisMonth, nextMonth: eventsNextMonth, recurringEvents: recurringEvents,
                tasks: taskItems, yearMonth: yearMonth, username: username, calendars: calendars,
                importCalendarEventParams: importCalendarEventParams, isReadOnly: that.isCalendarReadOnly});
        });
    },
    postDeleteCalendar: function(calendar, data) {
        let that = this;
        // Matched by name: entries in calendarProperties.calendars carry no
        // id, so findIndex on one always returned -1 and splice(-1, 1)
        // dropped the last calendar instead of the deleted one.
        let index = this.calendarProperties.calendars.findIndex(v => v.name === data.calendarName);
        if (index !== -1) {
            this.calendarProperties.calendars.splice(index, 1);
        }
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
        // The calendar app runs its own confirm dialog, so asking again here
        // would stack a second one on top of it.
        let proceed = () => { that.showConfirm = false;
        	    that.displaySpinner();
        	    if (isSharedCalendar) {
                    that.postDeleteCalendar(calendar, data);
        	    } else {
                    let directory = that.findCalendarDirectory(data.calendarName);
                    if (directory == null) {
                        that.removeSpinner();
                        that.showMessage(true, that.translate('CALENDAR.ERROR.DELETE'));
                        return;
                    }
                    let dirPath = peergos.client.PathUtils.directoryToPath([directory]);
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
            };
        if (data.confirmed) {
            proceed();
        } else {
            this.confirmDeleteCalendar(data.calendarName, proceed, () => { that.showConfirm = false;});
        }
    },
    confirmDeleteCalendar: function(calendarName, deleteCalendarFunction, cancelFunction) {

        this.confirm_message= this.translate("CALENDAR.DELETE.CONFIRM").replace("$NAME", calendarName);
        this.confirm_body='';
        this.confirm_consumer_cancel_func = cancelFunction;
        this.confirm_consumer_func = deleteCalendarFunction;
        this.showConfirm = true;
    },
    // An event id originates in a .ics UID, which can come from any file the
    // user imports, and year/month arrive over postMessage - all three are
    // concatenated into a path below. The app sanitises ids at its own
    // boundary; this is the privileged side refusing to build a path out of
    // anything that could climb out of the event directory.
    // Tasks live beside the year buckets rather than inside one: a task
    // may have no due date at all, so there is no year/month to file it
    // under. Same fail-closed contract as eventDirPath - an unknown
    // calendar name resolves to nothing, never to a default.
    taskDirPath: function(calendarName) {
        let calendarDirectory = this.findCalendarDirectory(calendarName);
        return calendarDirectory == null ? null : calendarDirectory + "/tasks";
    },
    itemDirPath: function(item) {
        return item.isTask ? this.taskDirPath(item.calendarName)
            : this.eventDirPath(item.calendarName, item.year, item.month, item.isRecurring);
    },
    isSafeEventId: function(id) {
        return this.isString(id) && id.length > 0 && id !== '.' && id !== '..'
            && id.indexOf('/') === -1 && id.indexOf('\\') === -1;
    },
    eventDirPath: function(calendarName, year, month, isRecurring) {
        let calendarDirectory = this.findCalendarDirectory(calendarName);
        if (calendarDirectory == null) {
            return null;
        }
        if (isRecurring) {
            return calendarDirectory + "/recurring";
        }
        let y = parseInt(year, 10);
        let m = parseInt(month, 10);
        if (!(y >= 1 && y <= 9999) || !(m >= 1 && m <= 12)) {
            return null;
        }
        return calendarDirectory + "/" + y + "/" + m;
    },
    // Guards the two entry points that turn an app message into a path.
    // Returns false (and clears the spinner it was raised under) rather than
    // letting a bad id or month reach PathUtils.
    isValidEventRequest: function(calendarName, year, month, id, isRecurring, isTask) {
        let dirPath = isTask ? this.taskDirPath(calendarName)
            : this.eventDirPath(calendarName, year, month, isRecurring);
        if (this.isSafeEventId(id) && dirPath != null) {
            return true;
        }
        this.removeSpinner();
        this.showMessage(true, this.translate('CALENDAR.ERROR.SAVE.EVENT'));
        return false;
    },
    removeCalendarEvent: function(calendar, calendarName, year, month, id, isRecurring, isTask) {
        let dirPath = isTask ? this.taskDirPath(calendarName)
            : this.eventDirPath(calendarName, year, month, isRecurring);
        let filename = id + this.CALENDAR_FILE_EXTENSION;
        let filePath = peergos.client.PathUtils.toPath(dirPath.split('/'), filename);
        return calendar.deleteInternal(filePath);
    },
    deleteEvent: function(calendar, item) {
	    const that = this;
	    that.displaySpinner();
	    if (!this.isValidEventRequest(item.calendarName, item.year, item.month, item.Id, item.isRecurring, item.isTask)) {
	        return;
	    }
        this.removeCalendarEvent(calendar, item.calendarName, item.year, item.month, item.Id, item.isRecurring, item.isTask).thenApply(function(res) {
	        that.removeSpinner();
        }).exceptionally(function(throwable) {
            that.showMessage(true, that.translate(item.isTask ? "CALENDAR.ERROR.DELETE.TASK" : "CALENDAR.ERROR.DELETE.EVENT"));
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
    getPropertiesFile: function(calendar) {
        let that = this;
        let filePath = peergos.client.PathUtils.directoryToPath([this.CONFIG_FILENAME]);
        let future = peergos.shared.util.Futures.incomplete();
        calendar.readInternal(filePath).thenApply(data => {
            that.includeUnlistedCalendars(calendar, JSON.parse(new TextDecoder().decode(data)), future);
            return null;
        }).exceptionally(function(throwable) {//File not found
            if (throwable.detailMessage.startsWith("File not found")) {
                let props = new Object();
                props.calendars = [];
                props.calendars.push({name: 'My Calendar', directory: 'default', color: '#00a9ff'});
                that.includeUnlistedCalendars(calendar, props, future);
            } else {
                that.showMessage(true, that.translate('CALENDAR.ERROR.LOAD.FILE'));
                let empty = new Object();
                empty.calendars = [];
                future.complete(empty);
            }
            return null;
        });
        return future;
    },
    // A calendar directory can exist without an App.config entry. The CalDAV bridge creates
    // them that way on purpose: this file is read once when the app opens and written back
    // whole on every edit, so a second writer would have its entry dropped by the next edit
    // in an open tab. Adopting the directories found on disk is what makes a calendar made
    // over CalDAV visible here, without either side having to write the other's file.
    includeUnlistedCalendars: function(calendar, props, future) {
        let that = this;
        if (props.calendars == null)
            props.calendars = [];
        calendar.dirInternal(null, null).thenApply(function(filenames) {
            let listed = props.calendars.map(c => c.directory);
            let unlisted = filenames.toArray([]).filter(name =>
                name != that.CONFIG_FILENAME && listed.indexOf(name) < 0);
            if (unlisted.length == 0) {
                future.complete(props);
                return null;
            }
            let outstanding = unlisted.length;
            unlisted.forEach(directory => {
                that.readCalendarInfo(calendar, directory, function(info) {
                    if (info != null && info.name != null)
                        props.calendars.push({name: info.name, directory: directory,
                            color: info.color == null ? '#00a9ff' : info.color, shareable: true});
                    if (--outstanding == 0)
                        future.complete(props);
                });
            });
            return null;
        }).exceptionally(function(throwable) {
            future.complete(props);
            return null;
        });
    },
    // Always calls back, with null for anything that is not a readable calendar.inf, so one
    // stray file in the data directory cannot leave the app waiting forever.
    readCalendarInfo: function(calendar, directory, consumer) {
        let filePath = peergos.client.PathUtils.directoryToPath([directory, this.NEW_CALENDAR_FILENAME]);
        calendar.readInternal(filePath).thenApply(data => {
            try {
                consumer(JSON.parse(new TextDecoder().decode(data)));
            } catch (e) {
                consumer(null);
            }
            return null;
        }).exceptionally(function(throwable) {
            consumer(null);
            return null;
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
            // `owner`, not `this.owner`: this callback is a plain function,
            // so `this` was not the component and the fallback threw a
            // TypeError instead of returning. Shape matches what callers
            // read off it (json.name / json.color), not a properties file.
            return {name: owner + "-shared", color: '#00a9ff'};
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
    // A name that is not on the list resolves to nothing rather than to the default
    // calendar: falling back would have let a delete or a share land on a directory
    // the request never named.
    findCalendarDirectory: function(calendarName) {
        for (var i=0; i < this.calendarProperties.calendars.length; i++) {
            let calendar = this.calendarProperties.calendars[i];
            if (calendar.name == calendarName) {
                return calendar.directory;
            }
        }
        return null;
    },
    updateCalendarEvent: function(calendar, item) {
        let dirPath = this.itemDirPath(item);
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
	    if (!this.isValidEventRequest(item.calendarName, item.year, item.month, item.Id, item.isRecurring, item.isTask)) {
	        return;
	    }
	    // A task has no recurrence and no month to move between, so none of
	    // the event placement logic below applies to it.
	    if (item.isTask) {
	        this.updateCalendarEvent(calendar, item).thenApply(function(res) {
	            that.removeSpinner();
	        }).exceptionally(function(throwable) {
	            that.showMessage(true, that.translate('CALENDAR.ERROR.SAVE.TASK'));
	            that.removeSpinner();
	            return null;
	        });
	        return;
	    }
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
                    let jsErr = throwable.backingJsObject || throwable;
                    console.log("Save event error:", jsErr.message, jsErr.stack);
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
           // Without this the future never settles when the upload directory
           // cannot be resolved, and the spinner stays up for good.
           }).exceptionally(function (throwable) {
               that.showMessage(true, that.translate('CALENDAR.ERROR.UPLOAD'));
               uploadFuture.complete(false);
               return null;
           });
       }
       return uploadFuture;
    },
    prepareImportCalendarEvent: function(item, uploadParams) {
        let that = this;

        // itemDirPath, not eventDirPath: an imported task belongs in the
        // calendar's tasks/ directory and arrives in the same batch.
        let dirPath = this.itemDirPath(item);
        if (dirPath == null) {
            this.showMessage(true, this.translate('CALENDAR.ERROR.IMPORT.EVENT'));
            return;
        }
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
    // Every event and task from one import, written as a single batched
    // upload rather than a write per item: a file with hundreds of events
    // would otherwise be hundreds of round trips. The recursion this
    // replaced existed only to ask about each event in turn - the app owns
    // that conversation now and reports one summary at the end.
    saveAllEvents: function(calendar, data) {
        const that = this;
        this.removeSpinner();
        let items = (data && data.items) || [];
        if (items.length == 0) {
            return;
        }
        let name = 'bulkImport';
        let title = this.translate("CALENDAR.IMPORT.MSG").replace("$ITEMS", items.length);
        let progress = {title: title, done: 0, max: items.length, name: name};
        let uploads = {
            directoryPath: this.context.username + "/.apps/" + this.CALENDAR_DIR_NAME + "/" + this.DATA_DIR_NAME + "/",
            uploadPaths: [],
            fileUploadProperties: [],
            progress: progress,
            name: name,
            title: title
        };
        // A single file finishes before a progress bar could be read, and
        // one that flashes and vanishes reads as a glitch.
        if (items.length > 1) {
            this.$toast({component: ProgressBar, props: progress}, {icon: false, timeout: false, id: name});
        }
        items.forEach(function(item) { that.prepareImportCalendarEvent(item, uploads); });
        this.bulkUpload(uploads).thenApply(function(done) {
            that.removeSpinner();
            if (done) {
                that.showMessage(false, that.translate('CALENDAR.IMPORT.COMPLETE'));
            }
        }).exceptionally(function(throwable) {
            that.$toast.dismiss(name);
            that.removeSpinner();
            that.showMessage(true, that.translate('CALENDAR.ERROR.IMPORT.EVENT'));
            return null;
        });
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
    // Same shape as getRecurringCalendarEvents: one directory per calendar,
    // read whole. Tasks are read in full rather than by month because an
    // open task matters regardless of which month is on screen - and an
    // undated one has no month to be found under.
    getTaskItems: function(calendar) {
        let that = this;
        let accumulator = [];
        let future = peergos.shared.util.Futures.incomplete();
        if (that.calendarProperties.calendars.length == 0) {
            future.complete(accumulator);
        }
        that.calendarProperties.calendars.forEach(currentCalendar => {
            let dirStr = currentCalendar.directory + "/tasks";
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
    // --- Sharing driven by the calendar app's own modal ---
    // Read/write access and secret links. The sharing state is keyed by a
    // resolved file's own properties name, so the file has to be looked up
    // first rather than addressed by a path string.
    shareItemPath: function(req) {
        let base = this.context.username + "/.apps/" + this.CALENDAR_DIR_NAME + "/" + this.DATA_DIR_NAME;
        if (req.target == 'calendar') {
            let directory = this.findCalendarDirectory(req.calendarName);
                return directory == null ? null : {dir: base, name: directory};
        }
        // Same guard as the save/delete paths, and it matters most here:
        // createCalendarItemLink concatenates this into a plain string path
        // for createSecretLink, which normalises nothing.
        let sub = this.eventDirPath(req.calendarName, req.year, req.month, req.isRecurring);
        if (sub == null || !this.isSafeEventId(req.id)) {
            return null;
        }
        return {dir: base + "/" + sub, name: req.id + this.CALENDAR_FILE_EXTENSION};
    },
    shareError: function(throwable) {
        this.removeSpinner();
        let detail = throwable == null ? "" : (throwable.getMessage ? throwable.getMessage() : throwable);
        this.showMessage(true, this.translate('CALENDAR.ERROR.SHARE.ITEM') + (detail ? ": " + detail : ""));
    },
    withSharedFile: function(req, action) {
        let that = this;
        let loc = this.shareItemPath(req);
        // Every bail-out reports: these run under a spinner the caller
        // raised, and the app is waiting on a reply that would never come.
        if (loc == null) {
            this.shareError(null);
            return;
        }
        this.context.getByPath(loc.dir).thenApply(function(dirOpt) {
            let dir = dirOpt.get();
            if (dir == null) {
                that.shareError(null);
                return;
            }
            dir.getChild(loc.name, that.context.crypto.hasher, that.context.network).thenApply(function(childOpt) {
                let file = childOpt.get();
                if (file == null) {
                    that.shareError(null);
                    return;
                }
                action(loc, file, file.getFileProperties().name);
            }).exceptionally(function(t) { that.shareError(t); });
        }).exceptionally(function(t) { that.shareError(t); });
    },
    sendShareState: function(req) {
        let that = this;
        this.withSharedFile(req, function(loc, file, name) {
            let directoryPath = peergos.client.PathUtils.directoryToPath(loc.dir.split('/'));
            that.context.getDirectorySharingState(directoryPath).thenApply(function(state) {
                let shared = state.get(name);
                let users = [];
                let writeUsers = [];
                if (shared != null) {
                    // String(...) per entry: toArray hands back Java strings
                    // carrying GWT internals, which postMessage cannot clone.
                    let asNames = function (set) {
                        return set.toArray([]).map(function (u) { return String(u); });
                    };
                    writeUsers = asNames(shared.writeAccess);
                    // Deduped: write access is also recorded as read access
                    // for some shares, which rendered the user twice.
                    users = asNames(shared.readAccess).concat(writeUsers)
                        .filter(function(u, i, all) { return all.indexOf(u) === i; });
                }
                let link = that.calendarItemLinks[req.calendarName + '/' + name];
                // The app clears the spinner once it has actually rendered
                // this state - a cross-origin message hop lands after Vue's
                // own tick, so clearing here uncovers the modal too early.
                that.postMessage({type: 'respondShareState', requestId: req.requestId, users: users,
                    writeUsers: writeUsers, secretLink: link == null ? null : link.url});
            }).exceptionally(function(t) { that.shareError(t); });
        });
    },
    shareCalendarItemWith: function(req) {
        let that = this;
        if (!req.username) return;
        this.displaySpinner();
        this.withSharedFile(req, function(loc, file, name) {
            let filePath = peergos.client.PathUtils.toPath(loc.dir.split('/'), name);
            let users = peergos.client.JsUtil.asSet([req.username]);
            let grant = req.access == 'edit'
                ? that.context.shareWriteAccessWith(filePath, users)
                : that.context.shareReadAccessWith(filePath, users);
            grant.thenApply(function() {
                that.sendShareState(req);
            }).exceptionally(function(t) { that.shareError(t); });
        });
    },
    unshareCalendarItemWith: function(req) {
        let that = this;
        if (!req.username) return;
        this.displaySpinner();
        this.withSharedFile(req, function(loc, file, name) {
            let filePath = peergos.client.PathUtils.toPath(loc.dir.split('/'), name);
            let users = peergos.client.JsUtil.asSet([req.username]);
            that.context.unShareReadAccessWith(filePath, users).thenApply(function() {
                return that.context.unShareWriteAccessWith(filePath, users);
            }).thenApply(function() {
                that.sendShareState(req);
            }).exceptionally(function(t) { that.shareError(t); });
        });
    },
    createCalendarItemLink: function(req) {
        let that = this;
        this.displaySpinner();
        this.withSharedFile(req, function(loc, file, name) {
            // createSecretLink takes a plain string path, unlike
            // share*AccessWith which take a PathUtils Path (see Sync.vue).
            let linkPath = "/" + loc.dir + "/" + name;
            let key = req.calendarName + '/' + name;
            let mint = function() {
                that.context.createSecretLink(linkPath, req.access == 'edit', java.util.Optional.empty(), "", "", false)
                    .thenApply(function(props) {
                        // Same construction as SecretLink.vue's buildHref().
                        let host = window.location.host;
                        let scheme = host.startsWith("localhost:") ? "http://" : "https://";
                        that.calendarItemLinks[key] = {
                            url: scheme + host + "/" + that.context.getLinkString(props),
                            // Kept so the link can actually be deleted later -
                            // deleteSecretLink is addressed by label, not by URL.
                            label: props.getLinkLabel(),
                            writable: req.access == 'edit'
                        };
                        that.sendShareState(req);
                    }).exceptionally(function(t) { that.shareError(t); });
            };
            let previous = that.calendarItemLinks[key];
            if (previous == null) {
                mint();
                return;
            }
            // Changing the access level re-mints, and a file holds a *list* of
            // links (see DriveShare.deleteLink), so minting on top of an
            // existing one leaves that one live at its old access - and its
            // label is overwritten here, which is the only handle the modal
            // has to revoke it.
            let filePath = peergos.client.PathUtils.toPath(loc.dir.split('/'), name);
            that.context.deleteSecretLink(previous.label, filePath, previous.writable).thenApply(function(res) {
                delete that.calendarItemLinks[key];
                mint();
            }).exceptionally(function(t) { that.shareError(t); });
        });
    },
    revokeCalendarItemLink: function(req) {
        let that = this;
        this.displaySpinner();
        this.withSharedFile(req, function(loc, file, name) {
            let key = req.calendarName + '/' + name;
            let link = that.calendarItemLinks[key];
            if (link == null) {
                that.sendShareState(req);
                return;
            }
            // Dropping the URL on this side alone would leave the link live
            // and still handing out the file - it has to be deleted.
            let filePath = peergos.client.PathUtils.toPath(loc.dir.split('/'), name);
            that.context.deleteSecretLink(link.label, filePath, link.writable).thenApply(function(res) {
                delete that.calendarItemLinks[key];
                that.sendShareState(req);
            }).exceptionally(function(t) { that.shareError(t); });
        });
    },
    // Takes an entry back out of the in-memory list after its write failed.
    dropCalendarEntry: function(entry) {
        let at = this.calendarProperties.calendars.indexOf(entry);
        if (at > -1)
            this.calendarProperties.calendars.splice(at, 1);
    },
    nameExistsMessage: function(name) {
        return this.translate('CALENDAR.NAME.EXISTS').replace('$NAME', name);
    },
    // The app hands the .ics text over rather than downloading it itself: a
    // blob: URL never reaches the Android app's DownloadListener, and the
    // native bridge that takes the text instead only exists in this frame.
    downloadIcsFile: function(filename, text) {
        // The name comes from the frame, and it is about to be a filename.
        let safe = String(filename == null ? '' : filename).replace(/[\\\/\u0000-\u001f]/g, '_').slice(0, 120);
        if (safe === '' || safe === '.' || safe === '..') {
            safe = this.translate('CALENDAR.TITLE');
        }
        if (!safe.toLowerCase().endsWith(this.CALENDAR_FILE_EXTENSION)) {
            safe = safe + this.CALENDAR_FILE_EXTENSION;
        }
        if (typeof window.Android !== "undefined" && window.Android
                && typeof window.Android.saveToDownloads === "function") {
            // The native side reports its own completion, so no toast here.
            window.Android.saveToDownloads(safe, "text/calendar", text);
            return;
        }
        let url = window.URL.createObjectURL(new Blob([text], {type: "text/calendar;charset=utf-8"}));
        let link = document.createElement("a");
        link.href = url;
        link.download = safe;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        this.showMessage(false, this.translate('CALENDAR.EVENT.DOWNLOADED').replace("$NAME", safe));
    },
    // Opens the stored .ics in the Peergos Email app as a real attachment.
    // Only offered when the account has that app - the frame is told so in
    // `ping` and falls back to a mailto: summary when it doesn't.
    emailEvent: function(req) {
        let sub = this.eventDirPath(req.calendarName, req.year, req.month, req.isRecurring);
        if (sub == null || !this.isSafeEventId(req.id)) {
            this.showMessage(true, this.translate('CALENDAR.ERROR.LOAD.FILE'));
            return;
        }
        let path = this.context.username + "/.apps/" + this.CALENDAR_DIR_NAME + '/' + this.DATA_DIR_NAME + "/" + sub;
        this.openFileOrDir("Email", path, {filename: req.id + this.CALENDAR_FILE_EXTENSION});
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
.calendar-view {
	display: grid;
	grid-template-rows: auto 1fr;
	height: 100vh;
	overflow: hidden;
}
.calendar-view main{
	overflow: hidden;
	min-height: 0;
	display: flex;
	flex-direction: column;
}

</style>
