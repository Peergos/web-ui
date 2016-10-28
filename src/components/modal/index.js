module.exports = {
    template: require('modal.html'),
    props: ['show', 'title', 'links'],
    created: function() {
    },
    methods: {
	close: function () {
	    this.show = false;
	}
    }
}
