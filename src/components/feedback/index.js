module.exports = {
    template: require('feedback.html'),
    props: ['show'],
    methods: {
        close: function () {
            this.show = false;
        }
    }
}
