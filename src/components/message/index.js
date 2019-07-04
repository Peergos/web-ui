module.exports = {
    template: require('message.html'),
    data: function() {
        return {
        }
    },
    props: ['title', 'message'],
    created: function() {
    },
    methods: {
        closeMessage: function () {
            this.$emit("remove-message");
        }
    }
}
