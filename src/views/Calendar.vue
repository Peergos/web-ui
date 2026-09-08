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
            <!-- Sharing is a privileged action, so it happens here rather than in
                 the frame: the app can ask for this dialog, but every recipient,
                 every link and every revocation is chosen in Peergos' own UI. -->
            <Share
                v-if="showShare"
                v-on:hide-share-with="closeShare"
                v-on:update-files="updateSharedFile()"
                :data="sharedWithData"
                :fromApp="true"
                :displayName="shareDisplayName"
                :allowReadWriteSharing="true"
                :allowCreateSecretLink="true"
                :autoOpenSecretLink="false"
                :files="filesToShare"
                :path="pathToShare"
                :followernames="followernames"
                :friendnames="friendnames"
                :groups="groups">
            </Share>
		</main>
	</article>
</template>

<script>
const AppHeader = require("../components/AppHeader.vue");
const Choice = require('../components/choice/Choice.vue');
const Confirm = require("../components/confirm/Confirm.vue");
const ProgressBar = require("../components/drive/ProgressBar.vue");
const Prompt = require("../components/prompt/Prompt.vue");
const Share = require("../components/drive/DriveShare.vue");
const Spinner = require("../components/spinner/Spinner.vue");
const i18n = require("../i18n/index.js");

const routerMixins = require("../mixins/router/index.js");

// Reminders outlive this view: opening the drive should not cancel an alarm
// the user set in the calendar, and a view is destroyed the moment it is
// switched away from. They are replaced whenever the app sends a new list, and
// each one checks at fire time that the account it was armed for is still the
// one signed in.
let reminderTimers = [];
let reminderGeneration = 0;

module.exports = {
    components: {
        Choice,
        Confirm,
		AppHeader,
		ProgressBar,
		Prompt,
		Share,
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
            // A sweep walks every stored month so the app can search and
            // export the whole calendar, not just the months the grid has
            // fetched. Caps are generous but finite: a walk is bounded work,
            // never an open-ended crawl of someone's whole history.
            MAX_SWEEP_MONTHS: 600,
            MAX_SWEEP_EVENTS: 50000,
            MAX_SWEEP_QUEUE: 4,
            sweepToken: 0,
            sweepActive: null,
            sweepQueue: [],
            // Bumped for every load, so buckets read for a load the app has
            // already replaced are dropped rather than posted into it.
            loadToken: 0,
            // Both undone in beforeDestroy: the window outlives this view.
            messageListener: null,
            shareRetry: null,
            // Writes this host has started and not yet seen land, by entry id. A share
            // request for an entry can arrive while its own write is still in flight.
            pendingWrites: Object.create(null),
            listenerRetry: null,
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
            hasEmail: false,
            // The share dialog's own state; nothing in the frame writes to it.
            showShare: false,
            shareDisplayName: '',
            sharedWithData: {read_shared_with_users: [], edit_shared_with_users: []},
            filesToShare: [],
            pathToShare: []
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
		followernames: function() {
			return this.socialData.followers;
		},
		friendnames: function() {
			return this.socialData.friends;
		},
		groups: function() {
			return {groupsNameToUid: this.socialData.groupsNameToUid,
				groupsUidToName: this.socialData.groupsUidToName};
		},
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
        this.cancelSweeps();
        clearTimeout(this.listenerRetry);
        clearTimeout(this.shareRetry);
        if (this.messageListener != null) {
            window.removeEventListener('message', this.messageListener);
            this.messageListener = null;
        }
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
        // The view can be torn down with messages still to send - a sweep
        // being cancelled on the way out, say. Without this the retry below
        // reschedules itself against a frame that no longer exists.
        if (iframe == null) {
            return;
        }
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
    		this.listenerRetry = setTimeout(function(){that.startListener(calendar)}, 1000);
	    	return;
	    }
        // One shape in both directions: `type` names the message and the rest
        // is its payload. Built without a prototype, so a message naming
        // "constructor" finds nothing to call.
        let handlers = Object.assign(Object.create(null), {
            pong: function() { that.isIframeInitialised = true; },
            save: function(data) { that.saveEvent(calendar, data); },
            saveAll: function(data) { that.saveAllEvents(calendar, data); },
            delete: function(data) { that.deleteEvent(calendar, data); },
            deleteCalendar: function(data) { that.deleteCalendar(calendar, data); },
            removeSpinner: function() { that.removeSpinner(); },
            downloadIcs: function(data) { that.downloadIcsFile(data.filename, data.item); },
            emailEvent: function(data) { that.emailEvent(data); },
            sweep: function(data) { that.requestSweep(calendar, data); },
            loadAdditional: function(data) {
                let when = that.requestedMonth(data);
                if (when != null) that.loadAdditional(calendar, when.year, when.month);
            },
            reminders: function(data) { that.scheduleReminders(data.items); },
            // Read the store again from scratch: another device, a CalDAV
            // client or the phone's own calendar can have written since this
            // was opened, and nothing announces that.
            refresh: function(data) {
                let now = new Date();
                let when = that.requestedMonth(data) || {year: now.getFullYear(), month: now.getMonth() + 1};
                that.displaySpinner();
                that.getPropertiesFile(calendar).thenApply(function(props) {
                    that.calendarProperties = props;
                    that.load(calendar, when.year, when.month);
                }).exceptionally(function(t) {
                    // A refresh reads; a failure here is not a save that went wrong.
                    that.removeSpinner();
                    that.showMessage(true, that.translate('CALENDAR.ERROR.LOAD'));
                    return null;
                });
            },
            requestAddCalendar: function(data) { that.addCalendarRequest(calendar, data.newColor, data.newName); },
            requestRenameCalendar: function(data) { that.renameCalendarRequest(calendar, data.calendar, data.newName); },
            requestCalendarColorChange: function(data) { that.calendarColorChangeRequest(calendar, data.calendarName, data.newColor); },
            openShare: function(data) { that.openShareDialog(data); }
        });
        // The `e.source` identity check is what actually gates this: only the
        // calendar frame's own window can be the source, whatever origin it
        // reports. "null" is accepted alongside the real origin because a
        // host embedding this page in a sandboxed context reports an opaque
        // one. Everything past this point is untrusted input and is validated
        // before use - see isSafeEventId/eventDirPath.
        // Kept so leaving the view can take it back off the window - a view
        // opened twice would otherwise leave the first listener behind.
        this.messageListener = function (e) {
            if (e.origin !== "null" && e.origin !== that.frameDomain()) return;
            if (e.source !== iframe.contentWindow) return;
            let handler = e.data == null ? null : handlers[e.data.type];
            if (handler != null) handler(e.data);
        };
        window.addEventListener('message', this.messageListener);
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
                        // A writable secret link is the other way a calendar
                        // we do not own can be edited.
                        that.calendarProperties.calendars.push({name: json.name, owner: that.owner,
                           directory: calendarDirectory, color: json.color,
                           writable: !that.isCalendarReadOnly});
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
    // A calendar name becomes a directory name and a wire identifier, so the
    // same rules apply wherever one is entered. Null means it was refused,
    // with the reason already on screen.
    acceptableCalendarName: function(supplied) {
        let name = supplied.trim();
        if (name === '' || name === '.' || name === '..') {
            return null;
        }
        if (!name.match(/^[a-z\d\-_\s]+$/i)) {
            this.showMessage(true, this.translate('CALENDAR.INVALID.NAME'));
            return null;
        }
        return name;
    },

    calendarNameTaken: function(name) {
        if (this.findCalendar(name) == null) {
            return false;
        }
        this.showMessage(true, this.nameExistsMessage(name));
        return true;
    },

    renameCalendarRequest: function(calendar, calendarItem, suppliedName) {
        let that = this;
        this.preparePrompt(calendarItem.name);
        this.prompt_consumer_func = function(prompt_result) {
            if (prompt_result === null)
                return;
            if (prompt_result === calendarItem.name)
                return;
            let newName = that.acceptableCalendarName(prompt_result);
            if (newName == null)
                return;
            setTimeout(function(){
                //make sure names are unique
                if (that.calendarNameTaken(newName)) {
                    return;
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
        this.askOrUseName(suppliedName);
    },
    addCalendarRequest: function(calendar, newColor, suppliedName) {
        let that = this;
        if (!this.isHexColor(newColor)) {
            return;
        }
        this.preparePrompt("");
        this.prompt_consumer_func = function(prompt_result) {
            if (prompt_result === null)
                return;
            let newName = that.acceptableCalendarName(prompt_result);
            if (newName == null)
                return;
            setTimeout(function(){
                //make sure names are unique
                if (that.calendarNameTaken(newName)) {
                    return;
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
        this.askOrUseName(suppliedName);
    },
    // Both calendar prompts ask the same question under the same limit; only
    // the name they start from differs.
    preparePrompt: function(value) {
        this.prompt_placeholder = this.translate('CALENDAR.NEW.NAME');
        this.prompt_value = value;
        this.prompt_message = this.translate('CALENDAR.ENTER.NAME');
        this.prompt_max_input_size = 20;
    },
    // Both calendar prompts end the same way: the app collects the name in
    // its own modal, so the consumer just set (validation and uniqueness live
    // in it) runs on that name rather than asking a second time. Only a name
    // that never arrived falls back to the prompt.
    askOrUseName: function(suppliedName) {
        if (suppliedName != null && suppliedName.length > 0) {
            this.prompt_consumer_func(suppliedName);
            return;
        }
        this.showPrompt = true;
    },
    // A month named by the frame reaches a stored path, so it is read as a
    // number in range before it gets there rather than concatenated as it
    // arrived - the same guard eventDirPath applies on the way in.
    requestedMonth: function(data) {
        let year = parseInt(data.year, 10);
        let month = parseInt(data.month, 10);
        if (!(year >= 1 && year <= 9999) || !(month >= 1 && month <= 12)) {
            return null;
        }
        return {year: year, month: month};
    },
    // A colour crosses the frame boundary and is written into a file other
    // clients read, so the privileged half decides what a colour is rather
    // than trusting the app's own field to have been used.
    isHexColor: function(x) {
        return this.isString(x) && /^#[0-9a-f]{6}$/i.test(x);
    },
    isString: function(x) {
        return typeof x === 'string' || x instanceof String;
    },
    calendarColorChangeRequest: function(calendar, calendarName, newColor) {
        let that = this;
        if (!this.isHexColor(newColor)) {
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
    // --- Whole-calendar sweep ---------------------------------------------
    // Search and export need every stored month, not only the ones the grid
    // has fetched. The walk lists what actually exists - year directories,
    // then month directories - reads one month at a time and streams each
    // back as it lands, so results appear progressively and a big calendar
    // never blocks the view. Every accepted request gets exactly one
    // `sweepDone`, whatever fails along the way, so the app is never left
    // waiting on a reply that will not come.
    requestSweep: function(calendar, data) {
        let requestId = data.requestId;
        if (typeof requestId !== 'number' || !isFinite(requestId)) {
            return;
        }
        let reason = data.reason == 'export' ? 'export' : 'search';
        let job = {calendar: calendar, requestId: requestId, reason: reason, targets: [],
            months: 0, events: 0, failed: 0, capped: false, ended: false};
        let all = this.calendarProperties == null ? [] : this.calendarProperties.calendars;
        if (data.calendarName == null) {
            job.targets = all.slice();
        } else {
            // Fail closed on an unknown name, exactly as the save, delete and
            // share paths do - a name that resolves to nothing is answered,
            // not guessed at.
            job.targets = all.filter(function(c) { return c.name == data.calendarName; });
            if (job.targets.length == 0) {
                job.failed = 1;
                this.finishSweep(job, 'unknown-calendar');
                return;
            }
        }
        // Bounded queue: a user hammering the search box or the export item
        // cannot pile up walks faster than they finish.
        if (this.sweepQueue.length >= this.MAX_SWEEP_QUEUE) {
            job.failed = 1;
            this.finishSweep(job, 'busy');
            return;
        }
        // Raised on the way in rather than when the walk starts: an export
        // queued behind a search sweep would otherwise look like a click
        // that did nothing at all.
        if (reason == 'export') {
            this.displaySpinner();
        }
        this.sweepQueue.push(job);
        this.runNextSweep();
    },

    finishSweep: function(job, error) {
        this.postMessage({type: 'sweepDone', requestId: job.requestId, reason: job.reason,
            months: job.months, events: job.events, failed: job.failed,
            capped: job.capped, error: error == null ? null : error});
    },

    runNextSweep: function() {
        let that = this;
        if (this.sweepActive != null || this.sweepQueue.length == 0) {
            return;
        }
        let job = this.sweepQueue.shift();
        job.token = this.sweepToken;
        this.sweepActive = job;
        this.sweepListCalendar(job, 0, [], function(months) {
            that.sweepReadMonths(job, months, 0);
        });
    },

    endSweep: function(job, error) {
        if (! this.answerSweep(job, error)) {
            return;
        }
        if (this.sweepActive === job) {
            this.sweepActive = null;
        }
        this.runNextSweep();
    },

    // Answers a job exactly once, whichever way it ends, and lifts the spinner
    // an export raised. Returns whether this call was the one that ended it.
    answerSweep: function(job, error) {
        if (job.ended) {
            return false;
        }
        job.ended = true;
        if (job.reason == 'export') {
            this.removeSpinner();
        }
        this.finishSweep(job, error);
        return true;
    },

    // The app that asked has thrown away the state it would have used the
    // answer for, so stop walking and answer everything still outstanding.
    cancelSweeps: function() {
        let that = this;
        this.sweepToken++;
        let queued = this.sweepQueue.splice(0, this.sweepQueue.length);
        let active = this.sweepActive;
        this.sweepActive = null;
        if (active != null) {
            that.answerSweep(active, 'cancelled');
        }
        queued.forEach(function(job) { that.answerSweep(job, 'cancelled'); });
    },

    // Directory names are data from the store, so they are matched against
    // the same bounds eventDirPath() writes with rather than trusted.
    isSweepYear: function(name) {
        let n = parseInt(name, 10);
        return /^[0-9]{1,4}$/.test(name) && n >= 1 && n <= 9999;
    },

    isSweepMonth: function(name) {
        let n = parseInt(name, 10);
        return /^[0-9]{1,2}$/.test(name) && n >= 1 && n <= 12;
    },

    sweepListCalendar: function(job, index, months, done) {
        let that = this;
        if (job.token !== this.sweepToken) {
            this.endSweep(job, 'cancelled');
            return;
        }
        if (index >= job.targets.length) {
            done(months);
            return;
        }
        let cal = job.targets[index];
        let next = function() { that.sweepListCalendar(job, index + 1, months, done); };
        let path = peergos.client.PathUtils.directoryToPath(cal.directory.split('/'));
        job.calendar.dirInternal(path, cal.owner).thenApply(function(names) {
            // Year directories only: `recurring` and `tasks` sit beside them
            // and are already sent in full at startup.
            let years = names.toArray([]).map(function(n) { return String(n); })
                .filter(that.isSweepYear)
                .sort(function(a, b) { return parseInt(b, 10) - parseInt(a, 10); });
            that.sweepListYears(job, cal, years, 0, months, next);
        }).exceptionally(function(t) { job.failed++; next(); });
    },

    sweepListYears: function(job, cal, years, index, months, done) {
        let that = this;
        if (job.token !== this.sweepToken) {
            this.endSweep(job, 'cancelled');
            return;
        }
        if (index >= years.length) {
            done();
            return;
        }
        let year = years[index];
        let next = function() { that.sweepListYears(job, cal, years, index + 1, months, done); };
        let dirStr = cal.directory + "/" + year;
        let path = peergos.client.PathUtils.directoryToPath(dirStr.split('/'));
        job.calendar.dirInternal(path, cal.owner).thenApply(function(names) {
            names.toArray([]).map(function(n) { return String(n); })
                .filter(that.isSweepMonth)
                .sort(function(a, b) { return parseInt(b, 10) - parseInt(a, 10); })
                .forEach(function(month) { months.push({cal: cal, year: year, month: month}); });
            next();
        }).exceptionally(function(t) { job.failed++; next(); });
    },

    sweepReadMonths: function(job, months, index) {
        let that = this;
        if (job.token !== this.sweepToken) {
            this.endSweep(job, 'cancelled');
            return;
        }
        if (index >= months.length) {
            this.endSweep(job, null);
            return;
        }
        if (job.months >= this.MAX_SWEEP_MONTHS || job.events >= this.MAX_SWEEP_EVENTS) {
            job.capped = true;
            this.endSweep(job, null);
            return;
        }
        let entry = months[index];
        let dirStr = entry.cal.directory + "/" + entry.year + "/" + entry.month;
        let path = peergos.client.PathUtils.directoryToPath(dirStr.split('/'));
        let next = function() { that.sweepReadMonths(job, months, index + 1); };
        job.calendar.dirInternal(path, entry.cal.owner).thenApply(function(filenames) {
            that.getEventsForMonth(job.calendar, entry.cal.name, entry.cal.owner, dirStr, filenames.toArray([]))
                .thenApply(function(items) {
                    if (job.token !== that.sweepToken) {
                        that.endSweep(job, 'cancelled');
                        return;
                    }
                    job.months++;
                    job.events += items.length;
                    // Sent even when empty: an empty month is how the app
                    // learns that entries another device deleted are gone.
                    that.postMessage({type: 'sweepBatch', requestId: job.requestId,
                        calendarName: entry.cal.name,
                        yearMonth: parseInt(entry.year, 10) * 12 + (parseInt(entry.month, 10) - 1),
                        items: items});
                    next();
                }).exceptionally(function(t) { job.failed++; next(); });
        }).exceptionally(function(t) { job.failed++; next(); });
    },

    loadAdditional: function(calendar, year, month) {
        let that = this;
        this.getCalendarEventsForMonth(calendar, year, month).thenApply(function(events) {
            that.postMonthEvents(year, month, events, false);
        });
    },
    postMonthEvents: function(year, month, eventsThisMonth, isLoadBucket) {
        this.postMessage({type: 'loadAdditional', currentMonth: eventsThisMonth,
            yearMonth: year * 12 + (month - 1), loadBucket: isLoadBucket});
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
    // The calendars are all the app needs to paint the grid, so they go over
    // on their own and the stored entries follow, one message per bucket, as
    // each read lands. The buckets are read at the same time rather than one
    // after another: they are independent directories, and a phone waiting
    // for the slowest of them was waiting for all of them.
    loadCalendars: function(calendar, year, month, importCalendarEventParams) {
        let that = this;
        let token = ++this.loadToken;
        let months = this.monthsAroundMonth(year, month);
        Vue.nextTick(function() {
            // Posted before the reads start, so no bucket can arrive at the
            // app ahead of the shell that clears the state it belongs to.
            // One message per month, plus the recurring folder and the tasks.
            that.postLoadShell(year, month, months.length + 2, importCalendarEventParams);
            months.forEach(function(each) {
                that.getCalendarEventsForMonth(calendar, each.year, each.month).thenApply(function(events) {
                    if (token === that.loadToken)
                        that.postMonthEvents(each.year, each.month, events, true);
                });
            });
            that.getRecurringCalendarEvents(calendar).thenApply(function(recurringEvents) {
                // Recurring entries are stored outside the months and carry
                // no yearMonth: they are not a month the grid can mark read.
                if (token === that.loadToken)
                    that.postMessage({type: 'loadAdditional', currentMonth: recurringEvents, loadBucket: true});
            });
            that.getTaskItems(calendar).thenApply(function(taskItems) {
                if (token === that.loadToken)
                    that.postMessage({type: 'loadTasks', tasks: taskItems, loadBucket: true});
            });
        });
    },

    // Identity, calendars and the month on screen - everything the first
    // paint needs. `pendingBuckets` is how many messages still owe it data,
    // which is what the app shows progress for and holds an import behind.
    postLoadShell: function(year, month, pendingBuckets, importCalendarEventParams) {
        let calendars = [];
        for (var i = 0; i < this.calendarProperties.calendars.length; i++) {
            let entry = this.calendarProperties.calendars[i];
            calendars.push({name: entry.name, color: entry.color, owner: entry.owner,
                shareable: entry.shareable, writable: entry.writable !== false});
        }
        let username = (this.loadCalendarAsGuest && !this.isCalendarReadOnly) ? this.owner : this.context.username;
        // A `load` resets the app's whole state, so anything a previous
        // frame asked for is answered and dropped rather than streamed
        // into a page that no longer has anywhere to put it.
        this.cancelSweeps();
        this.postMessage({type: 'load', yearMonth: year * 12 + (month - 1), username: username,
            calendars: calendars, pendingBuckets: pendingBuckets,
            importCalendarEventParams: importCalendarEventParams, isReadOnly: this.isCalendarReadOnly});
    },
    postDeleteCalendar: function(calendar, data) {
        let that = this;
        // Matched by name: entries in calendarProperties.calendars carry no
        // id, so findIndex on one always returned -1 and splice(-1, 1)
        // dropped the last calendar instead of the deleted one.
        let index = this.calendarProperties.calendars.findIndex(v => v.name === data.calendarName);
        let removed = index === -1 ? null : this.calendarProperties.calendars.splice(index, 1)[0];
        this.updatePropertiesFile(calendar, this.calendarProperties).thenApply(res => {
            that.removeSpinner();
            that.postMessage({type: 'respondDeleteCalendar', calendar: data});
        }).exceptionally(function(throwable) {
            // The list is updated before the file is written, so a failed
            // write has to take the entry back - and the app is told nothing,
            // which leaves the calendar it still shows the true state.
            if (removed != null) {
                that.calendarProperties.calendars.splice(index, 0, removed);
            }
            that.removeSpinner();
            that.showMessage(true, that.translate('CALENDAR.ERROR.SAVE'));
            return null;
        });
    },
    deleteCalendar: function(calendar, data) {
        let that = this;
        let entry = this.findCalendar(data.calendarName);
        let calendars = this.calendarProperties.calendars;
        // The account's own first calendar is the one the app never offers to delete;
        // a name that resolves to nothing is refused rather than asked about.
        if (entry == null || (entry === calendars[0] && (entry.owner == null || entry.owner == this.context.username))) {
            this.showMessage(true, this.translate('CALENDAR.ERROR.DELETE'));
            return;
        }
        let isSharedCalendar = entry.owner != null && entry.owner != this.context.username;
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
        // Always asked here: a dialog inside the frame cannot stand in for the
        // user's answer to this side.
        this.confirmDeleteCalendar(data.calendarName, proceed, () => { that.showConfirm = false;});
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
        return this.isString(id) && id.length > 0 && id.length <= 200
            && id !== '.' && id !== '..'
            && id.indexOf('/') === -1 && id.indexOf('\\') === -1
            && !/[\u0000-\u001f]/.test(id);
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
        return calendar.deleteInternal(filePath, this.findCalendarOwner(calendarName));
    },
    deleteEvent: function(calendar, item) {
	    const that = this;
	    that.displaySpinner();
	    if (!this.isValidEventRequest(item.calendarName, item.year, item.month, item.Id, item.isRecurring, item.isTask)) {
	        return;
	    }
	    // Otherwise a delete that follows the create closely can land first, and the write
	    // then puts the entry back.
	    this.afterPendingWrite(item.Id, function() { that.removeStoredEvent(calendar, item); });
    },
    removeStoredEvent: function(calendar, item) {
	    const that = this;
        this.removeCalendarEvent(calendar, item.calendarName, item.year, item.month, item.Id, item.isRecurring, item.isTask).thenApply(function(res) {
	        that.removeSpinner();
        }).exceptionally(function(throwable) {
            // Deleting is asking for the entry to be gone, so an entry that is
            // already gone is the outcome, not a failure. It happens in
            // ordinary use: moving an entry deletes the copy at its old
            // placement, and another device - or an earlier move - may have
            // removed it first. Only a file still sitting there is an error.
            that.deletedFilePresent(calendar, item).thenApply(function(present) {
                if (present) {
                    that.showMessage(true, that.translate(item.isTask ? "CALENDAR.ERROR.DELETE.TASK" : "CALENDAR.ERROR.DELETE.EVENT"));
                }
                that.removeSpinner();
            });
        });
    },
    /** Whether the file a delete just failed on is still in its directory. */
    deletedFilePresent: function(calendar, item) {
        let future = peergos.shared.util.Futures.incomplete();
        let dirPath = item.isTask ? this.taskDirPath(item.calendarName)
            : this.eventDirPath(item.calendarName, item.year, item.month, item.isRecurring);
        if (dirPath == null) {
            future.complete(false);
            return future;
        }
        let filename = item.Id + this.CALENDAR_FILE_EXTENSION;
        let path = peergos.client.PathUtils.directoryToPath(dirPath.split('/'));
        calendar.dirInternal(path, this.findCalendarOwner(item.calendarName)).thenApply(function(names) {
            future.complete(names.toArray([]).map(function(n) { return String(n); }).indexOf(filename) !== -1);
        }).exceptionally(function(t) {
            // The directory itself is unreadable or gone, so the entry is not
            // there either.
            future.complete(false);
            return null;
        });
        return future;
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
            that.loadCalendarProperties(calendar, JSON.parse(new TextDecoder().decode(data)), future);
            return null;
        }).exceptionally(function(throwable) {//File not found
            if (throwable.detailMessage.startsWith("File not found")) {
                let props = new Object();
                props.calendars = [];
                props.calendars.push({name: 'My Calendar', directory: 'default', color: '#00a9ff'});
                that.loadCalendarProperties(calendar, props, future);
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
    // Discovery first, then writability, then the caller gets its properties.
    loadCalendarProperties: function(calendar, props, future) {
        let that = this;
        let discovered = peergos.shared.util.Futures.incomplete();
        this.includeUnlistedCalendars(calendar, props, discovered);
        discovered.thenApply(function(loaded) {
            that.resolveCalendarWritability(loaded, future);
            return null;
        });
    },

    // A calendar of our own is always writable. One shared with us is writable
    // only if the share said so, which the stored properties cannot know - the
    // filesystem is the only authority, so ask it once at load.
    resolveCalendarWritability: function(props, future) {
        let that = this;
        let shared = [];
        props.calendars.forEach(function(c) {
            if (c.owner != null && c.owner != that.context.username) {
                shared.push(c);
            } else {
                c.writable = true;
            }
        });
        if (shared.length == 0) {
            future.complete(props);
            return;
        }
        let outstanding = shared.length;
        let settle = function() {
            if (--outstanding == 0) {
                future.complete(props);
            }
        };
        shared.forEach(function(c) {
            // One count per calendar, whichever way the probe ends.
            let settleOnce = that.onceOnly(settle);
            let path = c.owner + "/" + that.APPS_DIR_NAME + "/" + that.CALENDAR_DIR_NAME
                + "/" + that.DATA_DIR_NAME + "/" + c.directory;
            that.context.getByPath(path).thenApply(function(dirOpt) {
                c.writable = dirOpt.isPresent() && dirOpt.get().isWritable();
                settleOnce();
            }).exceptionally(function(t) {
                // Unreachable now - a revoked share, say. Read-only is the safe
                // reading, and the calendar simply shows nothing.
                c.writable = false;
                settleOnce();
            });
        });
    },

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
    // Counts a step exactly once, whichever way it ends: an error handler can
    // fire after its success path already ran, and counting a step twice
    // finishes the batch while some of it is still outstanding.
    onceOnly: function(step) {
        let done = false;
        return function(arg) {
            if (done) {
                return;
            }
            done = true;
            step(arg);
        };
    },

    findCalendar: function(calendarName) {
        for (var i=0; i < this.calendarProperties.calendars.length; i++) {
            let calendar = this.calendarProperties.calendars[i];
            if (calendar.name == calendarName) {
                return calendar;
            }
        }
        return null;
    },

    findCalendarDirectory: function(calendarName) {
        let calendar = this.findCalendar(calendarName);
        return calendar == null ? null : calendar.directory;
    },

    // Whose app directory the calendar's files live in. Null for one of our
    // own, which is what the App API already reads as "the calling user".
    findCalendarOwner: function(calendarName) {
        let calendar = this.findCalendar(calendarName);
        return calendar == null ? null : calendar.owner;
    },
    updateCalendarEvent: function(calendar, item) {
        let dirPath = this.itemDirPath(item);
        let filename = item.Id + this.CALENDAR_FILE_EXTENSION;
        let encoder = new TextEncoder();
        let uint8Array = encoder.encode(item.item);
        let bytes = convertToByteArray(uint8Array);
        return this.writeCalendarFile(this.findCalendarOwner(item.calendarName), dirPath, filename, bytes);
    },

    // App.writeInternal takes a username, but resolves every write under the
    // *calling* user's root all the same (see App.writeFileContents), so a
    // calendar shared with us could never be written through it. This is the
    // same operation addressed at the owner's root - the idiom AppSandbox's
    // writeFile already uses, with the owner in place of ourselves.
    writeCalendarFile: function(owner, dirPath, filename, bytes) {
        let that = this;
        let future = peergos.shared.util.Futures.incomplete();
        let root = owner == null ? this.context.username : owner;
        let subPath = peergos.client.PathUtils.directoryToPath(
            (this.APPS_DIR_NAME + "/" + this.CALENDAR_DIR_NAME + "/" + this.DATA_DIR_NAME + "/" + dirPath).split('/'));
        let failed = function(throwable) {
            future.completeExceptionally(throwable);
            return null;
        };
        this.context.getByPath(root).thenApply(function(rootOpt) {
            if (! rootOpt.isPresent()) {
                return failed(new Error("No such user: " + root));
            }
            let userRoot = rootOpt.get();
            userRoot.getOrMkdirs(subPath, that.context.network, false, that.getMirrorBatId(userRoot), that.context.crypto)
                .thenApply(function(dir) {
                    dir.uploadOrReplaceFile(filename, new peergos.shared.user.fs.AsyncReader.build(bytes),
                        0, bytes.length, that.context.network, that.context.crypto, function(x) {})
                        .thenApply(function(fw) { future.complete(true); return null; })
                        .exceptionally(failed);
                    return null;
                }).exceptionally(failed);
            return null;
        }).exceptionally(failed);
        return future;
    },
    saveEvent: function(calendar, item) {
	    const that = this;
	    that.displaySpinner();
	    if (!this.isValidEventRequest(item.calendarName, item.year, item.month, item.Id, item.isRecurring, item.isTask)) {
	        return;
	    }
	    // One write, wherever the item is addressed: a task goes to the
	    // calendar's tasks/ folder, an event to its month, and a move arrives
	    // as two messages - a delete of the old placement, then this.
	    let failed = item.isTask ? 'CALENDAR.ERROR.SAVE.TASK' : 'CALENDAR.ERROR.SAVE.EVENT';
	    // Registered before the write starts, so a share or a delete asked for in the
	    // meantime finds it - and a second save of the same entry queues behind it rather
	    // than racing it to the same file.
	    let landed = peergos.shared.util.Futures.incomplete();
	    let settled = function() {
	        if (that.pendingWrites[item.Id] === landed) {
	            delete that.pendingWrites[item.Id];
	        }
	        that.removeSpinner();
	        landed.complete(true);
	    };
	    this.afterPendingWrite(item.Id, function() {
	        that.pendingWrites[item.Id] = landed;
	        let write;
	        try {
	            write = that.updateCalendarEvent(calendar, item);
	        } catch (e) {
	            // Never left pending: everything queued behind this entry would wait for ever.
	            settled();
	            that.showMessage(true, that.translate(failed));
	            return;
	        }
	        write.thenApply(function(res) {
	            settled();
	        }).exceptionally(function(throwable) {
	            settled();
	            that.showMessage(true, that.translate(failed));
	        });
	    });
    },
    // Runs `action` once any write this host has in flight for the entry has landed - at
    // once when there is none. A file is only ever read, replaced or removed after the
    // write that made it, whichever order the frame's messages arrive in.
    afterPendingWrite: function(id, action) {
        let that = this;
        let pending = this.pendingWrites[id];
        if (pending == null) {
            action();
            return;
        }
        // Looked up again once released: a save queued behind the same write starts its
        // own the moment it is released, and this has to fall in behind that one too. The
        // gate always completes - a failed write settles it like a landed one - so there is
        // no failure branch to take here.
        pending.thenApply(function() { that.afterPendingWrite(id, action); });
    },
    getMirrorBatId(file) {
        return file.getOwnerName() == this.context.username ? this.mirrorBatId : java.util.Optional.empty()
    },
    bulkUpload: function(uploadParams) {
       let that = this;
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
           // uploadSubtree asks two questions as it goes - resume this partial
           // upload? replace this existing file? Drive puts both to the user;
           // an import cannot, and the app has already dropped the entries it
           // recognised as duplicates, so everything still in the batch is
           // meant to be written, as the single-event save does. Both
           // arguments are required: leave one out and commitWatcher lands in
           // its slot and the upload fails on an undefined callback.
           let yes = function() { return peergos.shared.util.Futures.of(true); };
           this.context.getByPath(uploadParams.directoryPath).thenApply(uploadDir => {
               uploadDir.ref.uploadSubtree(folderStream, that.getMirrorBatId(uploadDir.ref), that.context.network,
                   that.context.crypto, that.context.getTransactionService(),
                   yes, yes, commitWatcher).thenApply(res => {
                       uploadFuture.complete(true);
               }).exceptionally(function (throwable) {
                    that.showMessage(true, that.translate('CALENDAR.ERROR.UPLOAD'));
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
        // calendar's tasks/ directory and arrives in the same batch. The id
        // is checked here as the single-save path checks it: it is about to
        // become a filename, and this batch is the one path an imported
        // file's own UIDs take.
        let dirPath = this.itemDirPath(item);
        if (dirPath == null || ! this.isSafeEventId(item.Id)) {
            this.showMessage(true, this.translate('CALENDAR.ERROR.IMPORT.EVENT'));
            return;
        }
        let filename = item.Id + this.CALENDAR_FILE_EXTENSION;
        let encoder = new TextEncoder();
        let uint8Array = encoder.encode(item.item);
        let bytes = convertToByteArray(uint8Array);
        let fileSize = uint8Array.byteLength;

        // The uploader reports progress more than once per byte - it encrypts
        // and then uploads - so the bar counts a file the first time its own
        // size is reached and never again. Counting every report instead runs
        // the bar past its maximum and dismisses it before the upload ends.
        let updater = { done: 0, max: fileSize, counted: false };
        let updateProgressBar = function(len) {
            updater.done += len.value_0;
            if (updater.counted || updater.done < updater.max) {
                return;
            }
            updater.counted = true;
            uploadParams.progress.done++;
            that.$toast.update(uploadParams.progress.name,
               {content: {
                    component: ProgressBar,
                    props: {
                        title: uploadParams.progress.title,
                        done: uploadParams.progress.done,
                        max: uploadParams.progress.max
                    }
               }});
        };

        let foundDirectoryIndex = -1;
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
                return;
            }
            // The bar dismisses itself on the last file; an upload that
            // failed never reaches it and would otherwise stay on screen.
            that.$toast.dismiss(name);
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

    // Every bucket - a month, the recurring folder, the tasks folder - is one
    // directory per calendar, read the same way; only the name differs. A
    // calendar whose listing or read fails (a share revoked while we are
    // open) settles as empty, because a future that never completes strands
    // the load behind a spinner nothing clears.
    readFromEachCalendar: function(calendar, subdirectoryOf) {
        let that = this;
        let accumulator = [];
        let future = peergos.shared.util.Futures.incomplete();
        let expected = this.calendarProperties.calendars.length;
        if (expected == 0) {
            future.complete(accumulator);
            return future;
        }
        let settle = function(events) {
            accumulator.push(events);
            if (accumulator.length == expected) {
                future.complete(accumulator.reduce((a, b) => a.concat(b), []));
            }
        };
        this.calendarProperties.calendars.forEach(currentCalendar => {
            // One count per calendar, whichever way it ends.
            let settleOnce = that.onceOnly(settle);
            let dirStr = subdirectoryOf(currentCalendar);
            let directoryPath = peergos.client.PathUtils.directoryToPath(dirStr.split('/'));
            calendar.dirInternal(directoryPath, currentCalendar.owner).thenApply(filenames => {
                that.getEventsForMonth(calendar, currentCalendar.name, currentCalendar.owner, dirStr, filenames.toArray([]))
                    .thenApply(res => settleOnce(res))
                    .exceptionally(function(t) { settleOnce([]); });
            }).exceptionally(function(t) { settleOnce([]); });
        });
        return future;
    },

    getCalendarEventsForMonth: function(calendar, year, month) {
        return this.readFromEachCalendar(calendar, c => c.directory + "/" + year + "/" + month);
    },

    getRecurringCalendarEvents: function(calendar) {
        return this.readFromEachCalendar(calendar, c => c.directory + "/recurring");
    },

    // Read whole rather than by month: an open task matters whichever month is
    // on screen, and an undated one has no month to be found under.
    getTaskItems: function(calendar) {
        return this.readFromEachCalendar(calendar, c => c.directory + "/tasks");
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
        let settle = function(currentCalendar, present, writable) {
            if (!present && currentCalendar.owner != null) { //unshared or deleted
                calendarsToDelete.push(currentCalendar.directory);
                modified[0] = true;
            }
            currentCalendar.writable = writable;
            processed.push(currentCalendar.name);
            if (processed.length == that.calendarProperties.calendars.length) {
                calendarsToDelete.forEach(directory => {
                    let index = that.calendarProperties.calendars.findIndex(v => v.directory === directory);
                    that.calendarProperties.calendars.splice(index, 1);
                });
                future.complete(modified[0]);
            }
        };
        that.calendarProperties.calendars.forEach(currentCalendar => {
            let shared = currentCalendar.owner != null && currentCalendar.owner != that.context.username;
            if (shared) {
                // Someone else's calendar: whether it can be written to is the grant's to say,
                // and the grant can change after the import, so it is read on every load.
                let path = currentCalendar.owner + "/.apps/" + that.CALENDAR_DIR_NAME + "/" + that.DATA_DIR_NAME
                    + "/" + currentCalendar.directory;
                that.context.getByPath(path).thenApply(dirOpt => {
                    settle(currentCalendar, dirOpt.isPresent(), dirOpt.isPresent() && dirOpt.get().isWritable());
                }).exceptionally(t => {
                    settle(currentCalendar, true, false);
                    return null;
                });
                return;
            }
            let directoryPath = peergos.client.PathUtils.directoryToPath(currentCalendar.directory.split('/'));
            calendar.dirInternal(directoryPath, currentCalendar.owner).thenApply(filenames => {
                settle(currentCalendar, !filenames.isEmpty() || currentCalendar.owner == null, true);
            });
        });
        return future;
    },
    // --- Reminders ---------------------------------------------------------
    // The app sends the whole upcoming list whenever its entries change, and
    // this replaces what was scheduled before - so a deleted or moved entry
    // cannot leave an alarm behind. Nothing is sent anywhere: Android hands
    // the list to AlarmManager, and everything else keeps timers for the ones
    // due while the app is open.
    scheduleReminders: function(items) {
        // Android needs nothing here: the sync adapter has already written a
        // Reminders row beside the event in the phone's own calendar, and the
        // system rings that whether this app is open or not. Everywhere else
        // the page raises them for as long as it is open.
        if (typeof window.Android !== "undefined" && window.Android) {
            return;
        }
        // Called through, not passed as a bare reference: the guard reads
        // `this` for its own helpers, and a detached method would lose it.
        this.scheduleReminderTimers(Array.isArray(items) ? items.filter(item => this.isValidReminder(item)) : []);
    },
    isValidReminder: function(item) {
        return item != null && this.isString(item.id) && typeof item.at === 'number'
            && isFinite(item.at) && this.isString(item.title) && this.isString(item.calendar);
    },
    // Desktop and browser: a timer per reminder, which lasts as long as the page
    // does - the view can come and go under it. setTimeout takes a 32-bit delay,
    // so anything beyond ~24 days could not be armed even if we wanted to; the
    // app's own horizon is shorter than that.
    scheduleReminderTimers: function(items) {
        let that = this;
        // The list this call is arming. Asking for permission is asynchronous,
        // and a newer list can land while that dialog is up - without this,
        // granting it would arm reminders that have already been replaced.
        let generation = ++reminderGeneration;
        let store = this.$store;
        let owner = this.context == null ? null : this.context.username;
        reminderTimers.forEach(timer => clearTimeout(timer));
        reminderTimers = [];
        if (typeof Notification === "undefined") {
            return;
        }
        let arm = function() {
            if (generation !== reminderGeneration) {
                return;
            }
            items.forEach(item => {
                let delay = item.at - Date.now();
                if (delay < 0 || delay > 86400000 * 24) {
                    return;
                }
                reminderTimers.push(setTimeout(() => {
                    // Signed out, or signed in as someone else, since this was
                    // armed: their calendar is not this alarm's to announce.
                    let now = store.state.context;
                    if (now == null || now.username !== owner) {
                        return;
                    }
                    new Notification(item.title, {body: that.reminderBody(item), tag: item.id});
                }, delay));
            });
        };
        if (Notification.permission === "granted") {
            arm();
        } else if (Notification.permission !== "denied" && items.length > 0) {
            Notification.requestPermission().then(result => { if (result === "granted") arm(); });
        }
    },
    reminderBody: function(item) {
        let when = new Date(item.at);
        let at = when.getHours() + ':' + (when.getMinutes() < 10 ? '0' : '') + when.getMinutes();
        return item.calendar ? item.calendar + ' · ' + at : at;
    },

    // The month on screen and the two the grid can scroll into without asking
    // for them. The visible one comes first: the reads run together, but it
    // is the one worth starting first.
    monthsAroundMonth: function(year, month) {
        return [{year: year, month: month},
                month == 12 ? {year: year + 1, month: 1} : {year: year, month: month + 1},
                month == 1 ? {year: year - 1, month: 12} : {year: year, month: month - 1}];
    },
    getEventsForMonth: function(calendar, calendarName, owner, directory, filenames) {
        let that = this;
        let accumulator = [];
        let future = peergos.shared.util.Futures.incomplete();
        if (filenames.length == 0) {
            future.complete(accumulator);
            return future;
        }
        // Counted as each read settles, not as each one succeeds: another
        // device can delete a file between this listing and this read, and
        // waiting for a read that will never arrive strands the whole month
        // - on the load path that means a spinner nothing ever clears.
        let settled = 0;
        let settle = function() {
            settled++;
            if (settled == filenames.length) {
                future.complete(accumulator);
            }
        };
        filenames.forEach(eventFilename => {
            // One count per file, whichever way it ends: a throw after the
            // read succeeded reaches the handler below as well, and counting
            // that file twice would complete the month an entry short.
            let settleOnce = that.onceOnly(settle);
            let filePath = peergos.client.PathUtils.toPath(directory.split('/'), eventFilename);
            calendar.readInternal(filePath, owner).thenApply(data => {
                accumulator.push({calendarName: calendarName, data: new TextDecoder().decode(data)});
                settleOnce();
            }).exceptionally(function(t) { settleOnce(); });
        });
        return future;
    },
    // --- Sharing driven by the calendar app's own modal ---
    // Read/write access and secret links. The sharing state is keyed by a
    // resolved file's own properties name, so the file has to be looked up
    // first rather than addressed by a path string.
    shareItemPath: function(req) {
        // Only our own can be shared: someone else's calendar lives under their name, and
        // nothing of theirs is ours to grant.
        let owner = this.findCalendarOwner(req.calendarName);
        if (owner != null && owner != this.context.username) {
            return null;
        }
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
    // The frame can ask for the share dialog and nothing more: no recipient, no
    // access level, no link. What is granted, and to whom, is chosen here in
    // Peergos' own UI, by the person looking at it.
    openShareDialog: function(req) {
        let that = this;
        // The frame asks to share an entry the moment it is created, while the write that
        // makes the file is still in flight: that write is this host's own, so it is waited
        // for outright rather than polled for on a timer.
        this.afterPendingWrite(req.id, function() { that.resolveToShare(req, 5); });
    },
    // What the brief retry still covers: a write this host did not start - another client's,
    // or a batch import's - that is not there yet when the frame asks.
    resolveToShare: function(req, attemptsLeft) {
        let that = this;
        let missing = function() {
            if (attemptsLeft > 1) {
                that.shareRetry = setTimeout(function() { that.resolveToShare(req, attemptsLeft - 1); }, 600);
                return;
            }
            that.showMessage(true, that.translate('CALENDAR.ERROR.LOAD.FILE'));
        };
        let loc = this.shareItemPath(req);
        if (loc == null) {
            // Nothing about an unresolvable path improves by waiting.
            this.showMessage(true, this.translate('CALENDAR.ERROR.LOAD.FILE'));
            return;
        }
        let directoryPath = peergos.client.PathUtils.directoryToPath(loc.dir.split('/'));
        this.context.getByPath(loc.dir).thenApply(function(dirOpt) {
            let dir = dirOpt.isPresent() ? dirOpt.get() : null;
            if (dir == null) {
                missing();
                return;
            }
            dir.getChild(loc.name, that.context.crypto.hasher, that.context.network).thenApply(function(childOpt) {
                let file = childOpt.isPresent() ? childOpt.get() : null;
                if (file == null) {
                    missing();
                    return;
                }
                let name = file.getFileProperties().name;
                that.context.getDirectorySharingState(directoryPath).thenApply(function(state) {
                    let shared = state.get(name);
                    // String() per entry: toArray hands back Java strings carrying
                    // GWT internals, which Vue renders as [object Object].
                    let asNames = function(set) {
                        return set == null ? [] : set.toArray([]).map(function(u) { return String(u); });
                    };
                    that.sharedWithData = {
                        read_shared_with_users: shared == null ? [] : asNames(shared.readAccess),
                        edit_shared_with_users: shared == null ? [] : asNames(shared.writeAccess)
                    };
                    that.filesToShare = [file];
                    that.pathToShare = loc.dir.split('/');
                    that.shareDisplayName = req.displayName == null || String(req.displayName).length === 0
                        ? name : String(req.displayName).slice(0, 120);
                    that.showShare = true;
                });
            }).exceptionally(function(t) { missing(); });
        }).exceptionally(function(t) { missing(); });
    },
    closeShare: function() {
        this.showShare = false;
        this.filesToShare = [];
    },
    // The dialog hands back a file it has just rewritten; keeping the stale
    // handle would make a second share act on a version that no longer exists.
    updateSharedFile: function() {
        let that = this;
        let file = this.filesToShare[0];
        if (file == null)
            return;
        file.getLatest(this.context.network).thenApply(function(updated) {
            that.filesToShare = [updated];
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
