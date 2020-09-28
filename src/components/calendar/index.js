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
                    that.saveEvent(e.data);
                } else if(e.data.type=="delete") {
                    that.deleteEvent(e.data);
                } else if(e.data.type=="displaySpinner") {
                    that.displaySpinner();
                } else if(e.data.type=="removeSpinner") {
                    that.removeSpinner();
                } else if(e.data.type=="displayMessage") {
                    that.displayMessage(e.data.message);
                } else if(e.data.type=="loadAdditional") {
                    that.loadAdditional(e.data.year, e.data.month, 'loadAdditional');
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
        this.load(year, monthIndex, 'load');
	},
    loadAdditional: function(year, month, messageType) {
        let calendar = this.context.getCalendarApp();
        let that = this;
        calendar.getCalendarEventsForMonth(year, month).thenCompose(function(allEvents) {
            that.loadAdditionalEvents(year, month, messageType, allEvents.toArray([]));
        });
    },
    loadAdditionalEvents: function(year, month, messageType, eventsThisMonth) {
        let currentMonth = [];
        eventsThisMonth.forEach(function(item){
            currentMonth.push({item:item, isSharedWithUs: false});
        });
        let iframe = document.getElementById("editor");
        let yearMonth = year * 12 + (month -1);
        setTimeout(function(){
            iframe.contentWindow.postMessage({type: messageType, currentMonth: currentMonth
                , yearMonth: yearMonth }, '*');
        });
    },
    load: function(year, month, messageType) {
        let calendar = this.context.getCalendarApp();
        let that = this;
        calendar.getCalendarEventsAroundMonth(year, month).thenCompose(function(allEvents) {
            that.loadEvents(year, month, messageType, allEvents.left.toArray([]), allEvents.middle.toArray([]),
                    allEvents.right.toArray([]));
        });
    },

    loadEvents: function(year, month, messageType, eventsPreviousMonth, eventsThisMonth, eventsNextMonth) {
        let previousMonth = [];
        let currentMonth = [];
        let nextMonth = [];
        eventsPreviousMonth.forEach(function(item){
            previousMonth.push({item:item, isSharedWithUs: false});
        });
        eventsThisMonth.forEach(function(item){
            currentMonth.push({item:item, isSharedWithUs: false});
        });
        eventsNextMonth.forEach(function(item){
            nextMonth.push({item:item, isSharedWithUs: false});
        });
        let iframe = document.getElementById("editor");
        let yearMonth = year * 12 + (month-1);
        setTimeout(function(){
            iframe.contentWindow.postMessage({type: messageType, previousMonth: previousMonth,
                    currentMonth: currentMonth, nextMonth: nextMonth, yearMonth: yearMonth}, '*');
        });
    },
    deleteEvent: function(item) {
	    const that = this;
	    that.displaySpinner();
        let calendar = this.context.getCalendarApp();
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
    saveEvent: function(item) {
	    const that = this;
	    that.displaySpinner();
        let calendar = this.context.getCalendarApp();
        calendar.updateCalendarEvent(item.year, item.month, item.Id, item.item).thenApply(function(res) {
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
