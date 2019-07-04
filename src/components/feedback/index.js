module.exports = {
    template: require('feedback.html'),
    data: function() {
        return {
        showSpinner: false
        }
    },
    props: ['context', 'messages'],
    methods: {
        close: function () {
            this.$emit("hide-feedback");
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
                    that.$emit("external-change");
                });
        },
        getContext: function(){
            var x = this.contextUpdates;
            return this.context;
        }
    }
}
