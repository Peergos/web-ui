module.exports = {
    template: require('feedback.html'),
    data: function() {
        return {
            showSpinner: false,
            isFeedback: false,
        }
    },
    props: ['context','closeFeedbackForm','messageId'],
    created: function() {
        if(this.messageId != null) {
            this.isFeedback = false;
        } else {
            this.isFeedback = true;
        }
    },
    methods: {
        close: function () {
            this.closeFeedbackForm(this.messageId, false);
        },
        submitFeedback: function() {
            var that = this;
            var contents = document.getElementById("feedback-text").value;
            if (contents.length > 0) {
                this.showSpinner = true;
                this.context.sendMessage(this.messageId, contents)
                    .thenApply(function(success) {
                        that.showSpinner = false;
                        console.log("Feedback submitted!");
                        that.closeFeedbackForm(that.messageId, that.isFeedback ? false : true);
                });
            }
        }
    }
}
