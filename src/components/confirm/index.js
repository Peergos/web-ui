module.exports = {
    template: require('confirm.html'),
    data: function() {
        return {
        }
    },
    props: ['confirm_message', 'confirm_body', 'consumer_cancel_func', 'consumer_func'],
    created: function() {
    },
    methods: {
        close: function() {
            this.$emit("hide-confirm");
        },
        no: function() {
            this.close();
            this.consumer_cancel_func();
        },
        yes: function() {
            this.close();
            this.consumer_func();
        }
    }
}
