module.exports = {
    template: require('warning.html'),
    data: function() {
        return {}
    },
    props: ['warning_message', 'warning_body', 'consumer_func'],
    created: function() {
    },
    methods: {
        close: function() {
            this.$emit("hide-warning");
        },

        complete: function() {
            this.close();
            this.consumer_func();
        }
    }
}
