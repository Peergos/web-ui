module.exports = {
    template: require('feedback.html'),
    data: function() {
        return {
            showSpinner: false,
            isFeedback: false,
            messageThread: [],
            title: "",
            textAreaPlaceholder: "",
        }
    },
    props: ['loadMessageThread', 'closeFeedbackForm','messageId', 'sendFeedback', 'sendMessage'],
    created: function() {
        if(this.messageId != null) {
            this.isFeedback = false;
            this.title = "Message";
            this.textAreaPlaceholder = "Reply...";
            this.messageThread = this.loadMessageThread(this.messageId);
            this.messageThread[this.messageThread.length -1].visible = true;
	    for (i=0; i < this.messageThread.length; i++)
		this.messageThread[i].paragraphs = this.toParagraphs(this.messageThread[i].contents);
        } else {
            this.isFeedback = true;
            this.title = "Feedback";
            this.textAreaPlaceholder = "Let us know what we can improve.";
        }
    },
    methods: {
        close: function () {
            this.closeFeedbackForm(this.messageId);
        },
        submitFeedback: function() {
            var contents = document.getElementById("feedback-text").value;
            if (contents.length > 0) {
                if (this.isFeedback) {
                    this.sendFeedback(contents);
                } else {
                    this.sendMessage(this.messageId, contents);
                }
            }
        },
	toParagraphs: function(msg) {
	    return msg.split("\n");
	}
    }
}
