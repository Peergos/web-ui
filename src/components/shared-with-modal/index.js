module.exports = {
    template: require('shared-with-modal.html'),
    props: ['show', 'data'],
    created: function() {
    },
    methods: {
        close: function () {
            this.show = false;
        }
    }
}
