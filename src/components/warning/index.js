module.exports = {
    template: require('warning.html'),
    data: function() {
        return {}
    },
    props: ['show', 'warning_message', 'warning_body', 'consumer_func'],
    created: function() {
    },
    methods: {
        close: function () {
            this.show = false;
        },

        complete: function() {
            this.close();
            this.consumer_func();
        }
    }
}
