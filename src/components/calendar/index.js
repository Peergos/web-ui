module.exports = {
    template: require('calendar.html'),
    data: function() {
        return {
            showSpinner: false,
            spinnerMessage: ""
        }
    },
    props: ['context', 'messages', 'importFile','shareWith'],
    created: function() {
        let that = this;
        this.displaySpinner();
        this.context.getCalendarApp().thenApply(calendar =>
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
                    that.downloadEvent(calendar, e.data.id, e.data.year, e.data.month, e.data.username);
                } else if(e.data.type=="addToClipboardEvent") {
                    that.addToClipboardEvent(calendar, e.data.id, e.data.year, e.data.month, e.data.username);
                } else if(e.data.type=="shareCalendarEvent") {
                    that.shareCalendarEvent(calendar, e.data.id, e.data.year, e.data.month, e.data.username);
                }
            }
        });
	    // Note that we're sending the message to "*", rather than some specific
            // origin. Sandboxed iframes which lack the 'allow-same-origin' header
            // don't have an origin which you can target: you'll have to send to any
            // origin, which might alow some esoteric attacks. Validate your output!
        let date = new Date();
        let year = 1900 + date.getYear();
        let monthIndex = date.getMonth() + 1;
        if(this.importFile != null) {
            this.importICSFile();
        } else {
            this.load(calendar, year, monthIndex, 'load');
        }
	},
    importICSFile: function() {
        let that = this;
        let iframe = document.getElementById("editor");
        setTimeout(function(){
            iframe.contentWindow.postMessage({type: 'importICSFile', contents: that.importFile}, '*');
        });
    },
    loadAdditional: function(calendar, year, month, messageType) {
        let that = this;
        calendar.getCalendarEventsForMonth(year, month).thenCompose(function(allEvents) {
            that.loadAdditionalEvents(year, month, messageType, allEvents.toArray([]));
        });
    },
    loadAdditionalEvents: function(year, month, messageType, eventsThisMonth) {
        let currentMonth = [];
        let that = this;
        eventsThisMonth.forEach(function(item){
            currentMonth.push({item:item.right, username: item.left});
        });
        let iframe = document.getElementById("editor");
        let yearMonth = year * 12 + (month -1);
        setTimeout(function(){
            iframe.contentWindow.postMessage({type: messageType, currentMonth: currentMonth
                , yearMonth: yearMonth }, '*');
        });
    },
    load: function(calendar, year, month, messageType) {
        let that = this;
        calendar.getCalendarEventsAroundMonth(year, month).thenCompose(function(allEvents) {
            that.loadEvents(year, month, messageType, allEvents.left.toArray([]), allEvents.middle.toArray([]),
                    allEvents.right.toArray([]), that.context.username);
        });
    },

    loadEvents: function(year, month, messageType, eventsPreviousMonth, eventsThisMonth, eventsNextMonth) {
        let previousMonth = [];
        let currentMonth = [];
        let nextMonth = [];
        let that = this;
        eventsPreviousMonth.forEach(function(item){
            previousMonth.push({item:item.right, username: item.left});
        });
        eventsThisMonth.forEach(function(item){
            currentMonth.push({item:item.right, username: item.left});
        });
        eventsNextMonth.forEach(function(item){
            nextMonth.push({item:item.right, username: item.left});
        });
        let iframe = document.getElementById("editor");
        let yearMonth = year * 12 + (month-1);
        setTimeout(function(){
            iframe.contentWindow.postMessage({type: messageType, previousMonth: previousMonth,
                    currentMonth: currentMonth, nextMonth: nextMonth, yearMonth: yearMonth, username: that.context.username}, '*');
        });
    },
    deleteEvent: function(calendar, item) {
	    const that = this;
	    that.displaySpinner();
        calendar.removeCalendarEvent(item.year, item.month, item.Id).thenApply(function(res) {
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
    saveEvent: function(calendar, item) {
	    const that = this;
	    that.displaySpinner();
        calendar.updateCalendarEvent(item.year, item.month, item.Id, item.item).thenApply(function(res) {
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
            calendar.updateCalendarEvent(item.year, item.month, item.Id, item.item).thenApply(function(res) {
                that.saveAllEventsRecursive(calendar, items, ++index);
            }).exceptionally(function(throwable) {
                that.removeSpinner();
                that.close();
                that.showMessage("Unable to import event");
                console.log(throwable.getMessage());
            });
        }
    },
    addToClipboardEvent: function(calendar, id, year, month, username) {
        let that = this;
        this.displaySpinner();
        calendar.getEventFile(username, year, month, id).thenApply(function(file){
            console.log("name=" + file.getName())
            let link = window.location.origin + window.location.pathname +
                    "#" + propsToFragment({secretLink:true,link:file.toLink()});
            navigator.clipboard.writeText(link).then(function() { that.displayMessage("Secret link to event copied to clipboard");}, function() {
              console.error("Unable to write to clipboard.");
            });
            that.removeSpinner();
        });
    },
    downloadEvent: function(calendar, id, year, month, username) {
        let that = this;
        this.displaySpinner();
        calendar.getEventFile(username, year, month, id)
            .thenApply(function(file){
                let props = file.getFileProperties();
                file.getInputStream(that.context.network, that.context.crypto, props.sizeHigh(), props.sizeLow(), function(read) {})
                    .thenCompose(function(reader){
                        let size = props.sizeLow();
                        let data = convertToByteArray(new Int8Array(size));
                        return reader.readIntoArray(data, 0, data.length)
                                .thenApply(function(read){that.openItem('event.ics', data, props.mimeType)});
                    });
            });
    },
    openItem: function(name, data, mimeType) {
        var blob =  new Blob([data], {type: "octet/stream"});
        var url = window.URL.createObjectURL(blob);
        var link = document.getElementById("downloadEventAnchor");
        link.href = url;
        link.type = mimeType;
        link.download = name;
        link.click();
        this.removeSpinner();
    },
    shareCalendarEvent: function(calendar, id, year, month, username) {
        let that = this;
        that.shareWith('calendar/' + this.context.username + '/' + year + '/' + month, id + '.ics', false);
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
