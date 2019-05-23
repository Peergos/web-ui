module.exports = {
    template: require('warning.html'),
    data: function() {
        return {'warning_result': ''}
    },
    props: ['show', 'warning_message', 'warning_body', 'consumer_func'],
    created: function() {
    },
    methods: {
        close: function () {
            this.show = false;
        },

        getWarning: function(warning_result) {
            this.close();
            this.warning_result='';
            this.consumer_func(warning_result);
        }
    }
}
