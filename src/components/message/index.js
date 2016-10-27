module.exports = {
    template: require('message.html'),
    data: function() {
        return {
	}
    },
    props: ['show', 'title', 'message'],
    created: function() {
    },
    methods: {
        closeMessage: function () {
            this.show = false;
        }
    }
}
