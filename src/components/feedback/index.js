module.exports = {
    template: require('feedback.html'),
    data: function() {
        return {
            showSpinner: false,
            isFeedback: false,
            messageThread: []
        }
    },
    props: ['loadMessageThread', 'closeFeedbackForm','messageId', 'sendFeedback', 'sendMessage'],
    created: function() {
        if(this.messageId != null) {
            this.isFeedback = false;
            this.messageThread = this.loadMessageThread(this.messageId);
            this.messageThread[this.messageThread.length -1].visible = true;
        } else {
            this.isFeedback = true;
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
        }
    }
}
