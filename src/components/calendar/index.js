module.exports = {
    template: require('calendar.html'),
    data: function() {
        return {
            showSpinner: false,
            spinnerMessage: ""
        }
    },
    props: ['context', 'messages'],
    created: function() {
        this.displaySpinner();
        this.startListener();
    },
    methods: {
	startListener: function() {
	    var that = this;
	    var iframe = document.getElementById("editor");
	    if (iframe == null) {
    		setTimeout(that.startListener, 1000);
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
                    that.saveEvent(e.data.text);
                } else if(e.data.type=="delete") {
                    that.deleteEvent(e.data.text);
                } else if(e.data.type=="displaySpinner") {
                    that.displaySpinner();
                } else if(e.data.type=="removeSpinner") {
                    that.removeSpinner();
                }
            }
        });
	    // Note that we're sending the message to "*", rather than some specific
            // origin. Sandboxed iframes which lack the 'allow-same-origin' header
            // don't have an origin which you can target: you'll have to send to any
            // origin, which might alow some esoteric attacks. Validate your output!

        this.context.getAllCalendarEvents().thenCompose(function(allEvents) {
            let items = allEvents.toArray([]);
            let allItems = [];
            let itemCount = items.length;
            if (itemCount == 0) {
                setTimeout(function(){
                    iframe.contentWindow.postMessage({text: allItems}, '*');
                });
            } else {
                items.forEach(function(item, idx){
                    let entry = {Id: item.Id, categoryId: item.categoryId, title: item.title,
                        isAllDay: item.isAllDay, start: item.start, end: item.end,
                        location: item.location, isPrivate: item.isPrivate, state: item.state, memo: item.memo
                    };
                    allItems.push(entry);
                    if(idx == itemCount -1) {
                        setTimeout(function(){
                            iframe.contentWindow.postMessage({text: allItems}, '*');
                        });
                    }
                });
            }
	    });
	},
    deleteEvent: function(item) {
	    const that = this;
	    that.displaySpinner();
        this.context.removeCalendarEvent(item.year, item.month, item.Id).thenApply(function(res) {
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
    saveEvent: function(item) {
	    const that = this;
	    that.displaySpinner();
        let entry = new peergos.shared.user.CalendarEvent(item.Id, item.categoryId, item.title,
            item.isAllDay, item.start, item.end, item.location,item.isPrivate, item.state, item.memo
        );
        this.context.updateCalendarEvent(item.year, item.month, entry).thenApply(function(res) {
	        that.removeSpinner();
        }).exceptionally(function(throwable) {
            that.showMessage("Unable to save event","Please close calendar and try again");
            console.log(throwable.getMessage());
	        that.removeSpinner();
        });
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
