module.exports = {
    template: require('warning.html'),
    props: ['show', 'title', 'body'],
    created: function() {
    },
    methods: {
        close: function () {
            this.show = false;
        }
    }
}
