module.exports = {
    template: require('error.html'),
    props: ['show', 'title', 'body'],
    created: function() {
    },
    methods: {
        close: function () {
            this.show = false;
        }
    }
}
