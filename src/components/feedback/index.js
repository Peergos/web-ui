module.exports = {
    template: require('feedback.html'),
    props: ['show', 'context'],
    methods: {
        close: function () {
            this.show = false;
        },
        submitFeedback: function(){
            var context = this.getContext();
            var formFeedback = document.getElementById("feedback-text").value;
            console.log("Feedback to submit: " + formFeedback);
            return context.submitFeedback(formFeedback).thenApply(x => console.log("Feedback submitted!"));
        },
        getContext: function(){
            var x = this.contextUpdates;
            return this.context;
        }
    }
}
