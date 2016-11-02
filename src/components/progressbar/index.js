module.exports = {
    template: require('progressbar.html'),
    data: function() {
        return {
	}
    },
    props: ['show', 'title', 'done', 'max'],
    created: function() {
    },
    methods: {
        closeMessage: function () {
            this.show = false;
        }
    }
}
