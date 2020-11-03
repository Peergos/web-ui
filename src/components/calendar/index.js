module.exports = {
    template: require('calendar.html'),
    data: function() {
        return {
            APPS_DIR_NAME: '.apps',
            CALENDAR_DIR_NAME: 'calendar',
            DATA_DIR_NAME: 'data',
            CALENDAR_FILE_EXTENSION: '.ics',
            showSpinner: false,
            spinnerMessage: ""
        }
    },
    props: ['context', 'messages', 'importFile', 'importSharedEvent','shareWith'],
    created: function() {
        let that = this;
        this.displaySpinner();
        peergos.shared.user.App.init(this.context, "calendar", ".ics").thenApply(calendar =>
            that.startListener(calendar)
        );
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
                    that.downloadEvent(calendar, e.data.event);
                } else if(e.data.type=="addToClipboardEvent") {
                    that.addToClipboardEvent(calendar, e.data.id, e.data.year, e.data.month);
                } else if(e.data.type=="shareCalendarEvent") {
                    that.shareCalendarEvent(calendar, e.data.id, e.data.year, e.data.month);
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
    importICSFile: function() {
        let that = this;
        let iframe = document.getElementById("editor");
        setTimeout(function(){
            iframe.contentWindow.postMessage({type: 'importICSFile', contents: that.importFile, isSharedWithUs: that.importSharedEvent, username: that.context.username }, '*');
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
            iframe.contentWindow.postMessage({type: messageType, previousMonth: eventsPreviousMonth,
                    currentMonth: eventsThisMonth, nextMonth: eventsNextMonth, yearMonth: yearMonth, username: that.context.username}, '*');
        });
    },
    removeCalendarEvent: function(calendar, year, month, id) {
        let dirPath = "" + year + "/" + month;
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
    displaySpinner: function(item) {
        this.showSpinner = true;
    },
    removeSpinner: function(item) {
        this.showSpinner = false;
    },
    displayMessage: function(msg) {
        this.showMessage(msg);
    },
    updateCalendarEvent: function(calendar, year, month, id, calendarEvent) {
        let dirPath = year + "/" + month;
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
        this.saveAllEventsRecursive(calendar, items.items, 0);
    },
    saveAllEventsRecursive: function(calendar, items, index) {
        const that = this;
        if(index == items.length) {
            that.removeSpinner();
            that.close();
            that.showMessage(items.length + " Event(s) successfully imported!");
        } else {
            let item = items[index];
            this.updateCalendarEvent(calendar, item.year, item.month, item.Id, item.item).thenApply(function(res) {
                that.saveAllEventsRecursive(calendar, items, ++index);
            }).exceptionally(function(throwable) {
                that.removeSpinner();
                that.close();
                that.showMessage("Unable to import event");
                console.log(throwable.getMessage());
            });
        }
    },
    getCalendarEventsForMonth: function(calendar, year, month) {
        let that = this;
        let dirStr = "" + year + "/" + month;
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
    createSecretLink: function(calendar, year, month, id) {
        let dirPath = "" + year + "/" + month;
        let filename = id + this.CALENDAR_FILE_EXTENSION;
        let filePath = peergos.client.PathUtils.toPath(dirPath.split('/'), filename);
        return calendar.createSecretLinkInternal(filePath);
    },
    addToClipboardEvent: function(calendar, id, year, month) {
        let that = this;
        this.displaySpinner();
        this.createSecretLink(calendar, year, month, id).thenApply(function(secretLink){
            let link = window.location.origin + window.location.pathname +
                    "#" + propsToFragment({secretLink:true, link:secretLink});
            navigator.clipboard.writeText(link).then(function() { that.displayMessage("Secret link to Calendar event copied to clipboard");}, function() {
              console.error("Unable to write to clipboard.");
            });
            that.removeSpinner();
        });
    },
    downloadEvent: function(calendar, event) {
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
        link.download = 'event.ics';
        link.click();
        this.removeSpinner();
    },
    shareCalendarEvent: function(calendar, id, year, month) {
        let that = this;
        that.shareWith(this.CALENDAR_DIR_NAME + '/' + this.DATA_DIR_NAME + '/' + year + '/' + month, id + '.ics', false);
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
