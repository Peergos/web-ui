module.exports = {
    template: require('calendar.html'),
    data: function() {
        return {
            APPS_DIR_NAME: '.apps',
            CALENDAR_DIR_NAME: 'calendar',
            DATA_DIR_NAME: 'data',
            CALENDAR_FILE_EXTENSION: '.ics',
            CONFIG_FILENAME: 'App.config',
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
            confirm_consumer_func: () => {}
        }
    },
    props: ['context', 'messages', 'importFile', 'importSharedEvent', 'shareWith', 'loadCalendarAsGuest'],
    created: function() {
        let that = this;
        this.displaySpinner();
        if (that.loadCalendarAsGuest) {
            that.startListener(null);
        } else {
            peergos.shared.user.App.init(that.context, "calendar", ".ics").thenCompose(calendar =>
                that.getPropertiesFile(calendar).thenApply(props => {
                    that.calendarProperties = props;
                    that.startListener(calendar)
                })
            );
        }
    },
    methods: {
	startListener: function(calendar) {
	    var that = this;
	    var iframe = document.getElementById("editor");
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
            if (e.origin === "null" && e.source === iframe.contentWindow) {
                if(e.data.type=="save") {
                    that.saveEvent(calendar, e.data);
                } else if(e.data.type=="saveAll") {
                    that.saveAllEvents(calendar, e.data);
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
                } else if(e.data.type=="shareCalendarEvent") {
                    that.shareCalendarEvent(calendar, e.data.id, e.data.year, e.data.month);
                } else if (e.data.action == 'requestRenameCalendar') {
                    that.renameCalendarRequest(calendar, e.data.currentName);
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
        if(this.importFile != null) {
            this.importICSFile();
        } else {
            this.load(calendar, year, month, 'load');
        }
	},
    renameCalendarRequest: function(calendar, currentName) {
        let that = this;
        this.prompt_placeholder = 'New Calendar name';
        this.prompt_value = currentName;
        this.prompt_message = 'Enter a new name';
        this.prompt_max_input_size = 20;
        this.prompt_consumer_func = function(prompt_result) {
            if (prompt_result === null)
                return;
            if (prompt_result === currentName)
                return;
            let newName = prompt_result.trim();
            if (newName === '')
                return;
            if (newName === '.' || newName === '..')
                return;
            setTimeout(function(){
                for(var i=0;i < that.calendarProperties.calendars.length; i++) {
                    let calendar = that.calendarProperties.calendars[i];
                    if(calendar.name == currentName) {
                        calendar.name = prompt_result;
                        break;
                    }
                }
                that.updatePropertiesFile(calendar, that.calendarProperties).thenApply(res => {
                    var iframe = document.getElementById("editor");
                    iframe.contentWindow.postMessage({type: 'respondRenameCalendar', oldName: currentName, newName: prompt_result}, '*');
                });
            });
        };
        this.showPrompt =  true;
    },
    importICSFile: function() {
        let that = this;
        let iframe = document.getElementById("editor");
        setTimeout(function(){
            iframe.contentWindow.postMessage({type: 'importICSFile', contents: that.importFile,
                isSharedWithUs: that.importSharedEvent, loadCalendarAsGuest: that.loadCalendarAsGuest,
                username: that.context.username }, '*');
        });
    },
    loadAdditional: function(calendar, year, month, messageType) {
        let that = this;
        this.getCalendarEventsForMonth(calendar, year, month).thenApply(function(allEvents) {
            that.loadAdditionalEvents(year, month, messageType, allEvents);
        });
    },
    loadAdditionalEvents: function(year, month, messageType, eventsThisMonth) {
        let iframe = document.getElementById("editor");
        let yearMonth = year * 12 + (month -1);
        setTimeout(function(){
            iframe.contentWindow.postMessage({type: messageType, currentMonth: eventsThisMonth
                , yearMonth: yearMonth }, '*');
        });
    },
    load: function(calendar, year, month, messageType) {
        let that = this;
        this.getCalendarEventsAroundMonth(calendar, year, month).thenApply(function(allEvents) {
            that.loadEvents(year, month, messageType, allEvents.previous, allEvents.current,
                    allEvents.next, that.context.username);
        });
    },

    loadEvents: function(year, month, messageType, eventsPreviousMonth, eventsThisMonth, eventsNextMonth) {
        let that = this;
        let iframe = document.getElementById("editor");
        let yearMonth = year * 12 + (month-1);
        setTimeout(function(){
            let calendars = [];
            for(var i=0;i < that.calendarProperties.calendars.length;i++) {
                let calendar = that.calendarProperties.calendars[i];
                calendars.push({name: calendar.name});
            }
            iframe.contentWindow.postMessage({type: messageType, previousMonth: eventsPreviousMonth,
                    currentMonth: eventsThisMonth, nextMonth: eventsNextMonth, yearMonth: yearMonth
                    , username: that.context.username, calendars: calendars}, '*');
        });
    },
    removeCalendarEvent: function(calendar, year, month, id) {
        let dirPath = "default/" + year + "/" + month;
        let filename = id + this.CALENDAR_FILE_EXTENSION;
        let filePath = peergos.client.PathUtils.toPath(dirPath.split('/'), filename);
        return calendar.deleteInternal(filePath);
    },
    deleteEvent: function(calendar, item) {
	    const that = this;
	    that.displaySpinner();
        this.removeCalendarEvent(calendar, item.year, item.month, item.Id).thenApply(function(res) {
	        that.removeSpinner();
        }).exceptionally(function(throwable) {
            that.showMessage("Unable to delete event","Please close calendar and try again");
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
        this.showMessage(msg);
    },
    renameCalendar: function(msg) {
        this.showMessage(msg);
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
                props.calendars.push({name:'My Calendar', directory:'default'});
                return props;
            } else {
                that.showMessage("Unable to load file","Please close calendar and try again");
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
    updateCalendarEvent: function(calendar, year, month, id, calendarEvent) {
        let dirPath = "default/" + year + "/" + month;
        let filename = id + this.CALENDAR_FILE_EXTENSION;
        let filePath = peergos.client.PathUtils.toPath(dirPath.split('/'), filename);
        let encoder = new TextEncoder();
        let uint8Array = encoder.encode(calendarEvent);
        let bytes = convertToByteArray(uint8Array);
        return calendar.writeInternal(filePath, bytes);
    },
    saveEvent: function(calendar, item) {
	    const that = this;
	    that.displaySpinner();
        this.updateCalendarEvent(calendar, item.year, item.month, item.Id, item.item).thenApply(function(res) {
	        that.removeSpinner();
        }).exceptionally(function(throwable) {
            that.showMessage("Unable to save event","Please close calendar and try again");
            console.log(throwable.getMessage());
	        that.removeSpinner();
        });
    },
    saveAllEvents: function(calendar, items) {
        this.removeSpinner();
        this.saveAllEventsRecursive(calendar, items.items, 0);
    },
    saveAllEventsRecursive: function(calendar, items, index) {
        const that = this;
        if(index == items.length) {
            that.close();
        } else {
            let item = items[index];
            this.confirmImportEventFile(item.summary,
                () => { that.showConfirm = false; that.importEventFile(calendar, items, index);},
                () => { that.showConfirm = false; that.saveAllEventsRecursive(calendar, items, ++index);}
            );
        }
    },
    importEventFile: function(calendar, items, index) {
        let that = this;
        let item = items[index];
        that.displaySpinner();
        this.updateCalendarEvent(calendar, item.year, item.month, item.Id, item.item).thenApply(function(res) {
           that.saveAllEventsRecursive(calendar, items, ++index);
        }).exceptionally(function(throwable) {
           that.removeSpinner();
           that.close();
           that.showMessage("Unable to import event");
           console.log(throwable.getMessage());
        });
    },
    confirmImportEventFile: function(summary, importFunction, cancelFunction) {
        this.confirm_message='Do you wish to import Event: ' + summary.datetime + ' - ' + summary.title;
        this.confirm_body='';
        this.confirm_consumer_cancel_func = cancelFunction;
        this.confirm_consumer_func = importFunction;
        this.showConfirm = true;
    },
    getCalendarEventsForMonth: function(calendar, year, month) {
        let that = this;
        let dirStr = "default/" + year + "/" + month;
        let directoryPath = peergos.client.PathUtils.directoryToPath(dirStr.split('/'));
        return calendar.dirInternal(directoryPath).thenCompose(filenames => {
            return that.getEventsForMonth(calendar, dirStr, filenames.toArray([]));
        });
    },
    getCalendarEventsAroundMonth: function(calendar, year, month) {
        let that = this;
        let previousMonth = month == 1 ? {year:year -1, month: 12}
                : {year: year, month:month -1};
        let currentMonth = {year: year, month: month};
        let nextMonth = month == 12 ? {year:year +1, month:1}
                : {year:year, month:month +1};
        let future = peergos.shared.util.Futures.incomplete();
        that.getCalendarEventsForMonth(calendar, previousMonth.year, previousMonth.month).thenApply(previous =>
                that.getCalendarEventsForMonth(calendar, currentMonth.year, currentMonth.month).thenApply(current =>
                        that.getCalendarEventsForMonth(calendar, nextMonth.year, nextMonth.month).thenApply(next => {
                                let result = {previous: previous, current: current, next: next};
                                future.complete(result);
                        })
                )
        );
        return future;
    },
    reduceAllEvents: function(calendar, directory, filenames, accumulator, future) {
        let that = this;
        let eventFilename = filenames.pop();
        if (eventFilename == null) {
            future.complete(accumulator);
        } else {
            let filePath = peergos.client.PathUtils.toPath(directory.split('/'), eventFilename);
            calendar.readInternal(filePath).thenApply(data => {
                accumulator.push(new TextDecoder().decode(data));
                that.reduceAllEvents(calendar, directory, filenames, accumulator, future);
            });
        }
    },
    getEventsForMonth: function(calendar, directory, filenames) {
        let that = this;
        let future = peergos.shared.util.Futures.incomplete();
        that.reduceAllEvents(calendar, directory, filenames, [], future);
        return future;
    },
    downloadEvent: function(calendar, title, event) {
        let that = this;
        this.displaySpinner();
        let encoder = new TextEncoder();
        let uint8Array = encoder.encode(event);
        let data = convertToByteArray(uint8Array);
        let blob =  new Blob([data], {type: "octet/stream"});
        let url = window.URL.createObjectURL(blob);
        let link = document.getElementById("downloadEventAnchor");
        link.href = url;
        link.type = "text/calendar";
        link.download = 'event - ' + title + '.ics';
        link.click();
        this.removeSpinner();
    },
    shareCalendarEvent: function(calendar, id, year, month) {
        let that = this;
        that.shareWith(this.CALENDAR_DIR_NAME + '/' + this.DATA_DIR_NAME + "/default/" + year + '/' + month, id + '.ics', false);
    },
    showMessage: function(title, body) {
        this.messages.push({
            title: title,
            body: body,
            show: true
        });
    },
    close: function () {
        this.$emit("hide-calendar");
    }
    }
}
