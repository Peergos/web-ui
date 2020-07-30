module.exports = {
    template: require('messagebar.html'),
    data: function() {
        return {
        }
    },
    props: ['id', 'date', 'contents', 'replyToMessage', 'dismissMessage'],
    created: function() {
    },
    methods: {
        reply: function() {
            console.log("reply to message id: " + this.id);
            this.replyToMessage(this.id);
        },
        close: function() {
            console.log("acknowledge message id: " + this.id);
            this.dismissMessage(this.id);
        }
    }
}
