module.exports = {
    template: require('messagebar.html'),
    data: function() {
        return {
        }
    },
    props: ['id', 'date', 'contents', 'replyToMessage', 'acknowledgeMessage'],
    created: function() {
    },
    methods: {
        reply: function() {
            console.log("reply to message id: " + this.id);
            this.replyToMessage(this.id);
        },
        closeMessage: function() {
            console.log("acknowledge message id: " + this.id);
            this.acknowledgeMessage(this.id);
        }
    }
}
