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
                } else if(e.data.type=="shareCalendarEvent") {
                    that.shareCalendarEvent(calendar, e.data.calendarName, e.data.id, e.data.year, e.data.month);
                } else if (e.data.action == 'requestRenameCalendar') {
                    that.renameCalendarRequest(calendar, e.data.calendar);
                } else if (e.data.action == 'requestCalendarColorChange') {
                    that.calendarColorChangeRequest(calendar, e.data.calendarName, e.data.newColor);
                } else if (e.data.action == 'requestAddCalendar') {
                    that.addCalendarRequest(calendar, e.data.newColor);
                } else if (e.data.action == 'requestCalendarReload') {
                    that.reloadCalendar();
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
    reloadCalendar: function() {
        this.$emit("reload-calendar");
    },
    renameCalendarRequest: function(calendar, calendarItem) {
        let that = this;
        this.prompt_placeholder = 'New Calendar name';
        this.prompt_value = calendarItem.name;
        this.prompt_message = 'Enter a new name';
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
                    var iframe = document.getElementById("editor");
                    iframe.contentWindow.postMessage({type: 'respondRenameCalendar', calendar: calendarItem}, '*');
                });
            });
        };
        this.showPrompt =  true;
    },
    addCalendarRequest: function(calendar, newColor) {
        let that = this;
        this.prompt_placeholder = 'New Calendar name';
        this.prompt_value = "";
        this.prompt_message = 'Enter a new name';
        this.prompt_max_input_size = 20;
        this.prompt_consumer_func = function(prompt_result) {
            if (prompt_result === null)
                return;
            let newName = prompt_result.trim();
            if (newName === '')
                return;
            if (newName === '.' || newName === '..')
                return;
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
                that.calendarProperties.calendars.push({name:newName, directory:dirName, color: newColor});
                that.updatePropertiesFile(calendar, that.calendarProperties).thenApply(res => {
                    that.removeSpinner();
                    var iframe = document.getElementById("editor");
                    iframe.contentWindow.postMessage({type: 'respondAddCalendar', newId: newId, newName: newName, newColor: newColor}, '*');
                });
            });
        };
        this.showPrompt =  true;
    },
    calendarColorChangeRequest: function(calendar, calendarName, newColor) {
        let that = this;
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
            var iframe = document.getElementById("editor");
            iframe.contentWindow.postMessage({type: 'respondCalendarColorChange', calendarName: calendarName, newColor: newColor}, '*');
        });
    },
    //https://stackoverflow.com/questions/105034/how-to-create-guid-uuid
    generateDirectoryName: function() {
      return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
      ).substring(0, 8);
    },
    importICSFile: function() {
        let that = this;
        let iframe = document.getElementById("editor");
        setTimeout(function(){
            iframe.contentWindow.postMessage({type: 'importICSFile', contents: that.importFile,
                isSharedWithUs: that.importSharedEvent, loadCalendarAsGuest: that.loadCalendarAsGuest,
                username: that.context.username }, '*');
        },600);
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
                calendars.push({name: calendar.name, color: calendar.color});
            }
            iframe.contentWindow.postMessage({type: messageType, previousMonth: eventsPreviousMonth,
                    currentMonth: eventsThisMonth, nextMonth: eventsNextMonth, yearMonth: yearMonth
                    , username: that.context.username, calendars: calendars}, '*');
        });
    },
    postDeleteCalendar: function(calendar, data) {
        let that = this;
        this.calendarProperties.calendars.splice(this.calendarProperties.calendars.findIndex(v => v.id === data.id), 1);
        this.updatePropertiesFile(calendar, this.calendarProperties).thenApply(res => {
            that.removeSpinner();
            var iframe = document.getElementById("editor");
            iframe.contentWindow.postMessage({type: 'respondDeleteCalendar', calendar: data}, '*');
        });
    },
    deleteCalendar: function(calendar, data) {
        let that = this;
        this.confirmDeleteCalendar(data.calendarName,
            () => { that.showConfirm = false;
        	    that.displaySpinner();
                let dirPath = peergos.client.PathUtils.directoryToPath(
                    [that.findCalendarDirectory(data.calendarName)]);
                calendar.deleteInternal(dirPath).thenApply(function(res) {
                    that.postDeleteCalendar(calendar, data);
                }).exceptionally(function(throwable) {
                    if (throwable.toString() == "java.util.NoSuchElementException") { //Because calendar had no events
                        that.postDeleteCalendar(calendar, data);
                    } else {
                        that.removeSpinner();
                        that.showMessage("Unable to delete Calendar");
                        console.log(throwable.getMessage());
                    }
                });
            },
            () => { that.showConfirm = false;}
        );
    },
    confirmDeleteCalendar: function(calendarName, deleteCalendarFunction, cancelFunction) {
        this.confirm_message='Do you sure you want to delete calendar: ' + calendarName + " ?";
        this.confirm_body='';
        this.confirm_consumer_cancel_func = cancelFunction;
        this.confirm_consumer_func = deleteCalendarFunction;
        this.showConfirm = true;
    },
    removeCalendarEvent: function(calendar, calendarName, year, month, id) {
        let dirPath = this.findCalendarDirectory(calendarName) + "/" + year + "/" + month;
        let filename = id + this.CALENDAR_FILE_EXTENSION;
        let filePath = peergos.client.PathUtils.toPath(dirPath.split('/'), filename);
        return calendar.deleteInternal(filePath);
    },
    deleteEvent: function(calendar, item) {
	    const that = this;
	    that.displaySpinner();
        this.removeCalendarEvent(calendar, item.calendarName, item.year, item.month, item.Id).thenApply(function(res) {
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
                props.calendars.push({name: 'My Calendar', directory: 'default', color: '#00a9ff'});
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
    findCalendarDirectory: function(calendarName) {
        for (var i=0;i < this.calendarProperties.calendars.length; i++) {
            let calendar = this.calendarProperties.calendars[i];
            if (calendar.name == calendarName) {
                return calendar.directory;
            }
        }
        return "default";
    },
    updateCalendarEvent: function(calendar, calendarName, year, month, id, calendarEvent) {
        let dirPath = this.findCalendarDirectory(calendarName) + "/" + year + "/" + month;
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
	    if(item.calendarName == item.previousCalendarName) {
            this.updateCalendarEvent(calendar, item.calendarName, item.year, item.month, item.Id, item.item).thenApply(function(res) {
                that.removeSpinner();
            }).exceptionally(function(throwable) {
                that.showMessage("Unable to save event","Please close calendar and try again");
                console.log(throwable.getMessage());
                that.removeSpinner();
            });
        } else { //move between calendars
            this.removeCalendarEvent(calendar, item.previousCalendarName, item.year, item.month, item.Id).thenApply(function(res) {
                that.updateCalendarEvent(calendar, item.calendarName, item.year, item.month, item.Id, item.item).thenApply(function(res2) {
                    that.removeSpinner();
                }).exceptionally(function(throwable) {
                    that.showMessage("Unable to save moved event","Please re-create event");
                    console.log(throwable.getMessage());
                    that.removeSpinner();
                });
            }).exceptionally(function(throwable) {
                that.showMessage("Unable to move event","Please close calendar and try again");
                console.log(throwable.getMessage());
                that.removeSpinner();
            });
        }
    },
    saveAllEvents: function(calendar, data) {
        this.removeSpinner();
        this.saveAllEventsRecursive(calendar, data.items, 0, data.showConfirmation);
    },
    saveAllEventsRecursive: function(calendar, items, index, showConfirmation) {
        const that = this;
        if (index == items.length) {
            if (showConfirmation) {
                that.close();
            } else {
    	        that.removeSpinner();
                that.showMessage("Imported: " + items.length + " event(s)");
            }
        } else {
            let item = items[index];
            if (showConfirmation) {
                this.confirmImportEventFile(item.summary,
                    () => { that.showConfirm = false; that.importEventFile(calendar, items, index, showConfirmation);},
                    () => { that.showConfirm = false; that.saveAllEventsRecursive(calendar, items, ++index, showConfirmation);}
                );
            } else {
                this.importEventFile(calendar, items, index, showConfirmation);
            }
        }
    },
    importEventFile: function(calendar, items, index, showConfirmation) {
        let that = this;
        let item = items[index];
        that.displaySpinner();
        this.updateCalendarEvent(calendar, item.calendarName, item.year, item.month, item.Id, item.item).thenApply(function(res) {
           that.saveAllEventsRecursive(calendar, items, ++index, showConfirmation);
        }).exceptionally(function(throwable) {
           that.removeSpinner();
           if (showConfirmation) {
                that.close();
           }
           that.showMessage("Unable to import event");
           console.log(throwable.getMessage());
        });
    },
    confirmImportEventFile: function(summary, importFunction, cancelFunction) {
        this.confirm_message='Do you wish to import Event: ' + summary.datetime
                + ' - ' + summary.title + ' ?';
        this.confirm_body='';
        this.confirm_consumer_cancel_func = cancelFunction;
        this.confirm_consumer_func = importFunction;
        this.showConfirm = true;
    },

    reduceCalendarEventsForMonth: function(calendar, year, month, calendarIndex, accumulator, future) {
            let that = this;
            if (calendarIndex == that.calendarProperties.calendars.length) {
                future.complete(accumulator);
            } else {
                let currentCalendar = that.calendarProperties.calendars[calendarIndex];
                let dirStr = currentCalendar.directory + "/" + year + "/" + month;
                let directoryPath = peergos.client.PathUtils.directoryToPath(dirStr.split('/'));
                calendar.dirInternal(directoryPath).thenCompose(filenames => {
                    that.getEventsForMonth(calendar, currentCalendar.name, dirStr, filenames.toArray([])).thenApply(res => {
                        that.reduceCalendarEventsForMonth(calendar, year, month, ++calendarIndex, accumulator.concat(res), future);
                    })
                });
            }
    },
    getCalendarEventsForMonth: function(calendar, year, month) {
        let future = peergos.shared.util.Futures.incomplete();
        this.reduceCalendarEventsForMonth(calendar, year, month, 0, [], future);
        return future;
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
    reduceAllEvents: function(calendar, calendarName, directory, filenames, accumulator, future) {
        let that = this;
        let eventFilename = filenames.pop();
        if (eventFilename == null) {
            future.complete(accumulator);
        } else {
            let filePath = peergos.client.PathUtils.toPath(directory.split('/'), eventFilename);
            calendar.readInternal(filePath).thenApply(data => {
                accumulator.push({calendarName: calendarName, data: new TextDecoder().decode(data)});
                that.reduceAllEvents(calendar, calendarName, directory, filenames, accumulator, future);
            });
        }
    },
    getEventsForMonth: function(calendar, calendarName, directory, filenames) {
        let that = this;
        let future = peergos.shared.util.Futures.incomplete();
        that.reduceAllEvents(calendar, calendarName, directory, filenames, [], future);
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
    shareCalendarEvent: function(calendar, calendarName, id, year, month) {
        let calendarDirectory = this.findCalendarDirectory(calendarName);
        this.shareWith(this.CALENDAR_DIR_NAME + '/' + this.DATA_DIR_NAME + "/" + calendarDirectory + "/" + year + '/' + month, id + '.ics', false);
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
