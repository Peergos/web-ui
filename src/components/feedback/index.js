module.exports = {
    template: require('feedback.html'),
    data: function() {
        return {
        showSpinner: false
        }
    },
    props: ['show', 'context', 'messages', 'externalchange'],
    methods: {
        close: function () {
            this.show = false;
        },
        showMessage: function(title, body) {
            this.messages.push({
                title: title,
                body: body,
                show: true
            });
        },
        submitFeedback: function(fb) {
            var formFeedback = document.getElementById("feedback-text").value;
            var that = this;
            console.log("Feedback to submit: " + formFeedback);
            this.showSpinner = true;
            this.context.submitFeedback(formFeedback)
                .thenApply(function(success) {
                    that.showMessage("Feedback submitted!", "Your feedback has been added to a folder shared with Peergos developers.");
                    that.showSpinner = false;
                    console.log("Feedback submitted!");
                    that.externalchange++;
                });
        },
        getContext: function(){
            var x = this.contextUpdates;
            return this.context;
        }
    }
}
