module.exports = {
    template: require('social.html'),
    props: ['show', 'data'],
    created: function() {
    },
    methods: {
        close: function () {
            this.show = false;
        }
    }
}
