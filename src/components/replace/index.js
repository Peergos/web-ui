module.exports = {
    template: require('replace.html'),
    data: function() {
        return {
            applyToAll:false
        }
    },
    props: ['replace_message', 'replace_body', 'consumer_cancel_func', 'consumer_func'],
    created: function() {
    },
    methods: {
        close: function() {
            this.$emit("hide-replace");
        },
        no: function() {
            this.close();
            this.consumer_cancel_func(this.applyToAll);
        },
        yes: function() {
            this.close();
            this.consumer_func(this.applyToAll);
        }
    }
}
