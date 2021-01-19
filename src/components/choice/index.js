module.exports = {
    template: require('choice.html'),
    data: function() {
        return {
            picked: 0
        }
    },
    props: ['choice_message', 'choice_body', 'choice_options', 'choice_consumer_func'],
    created: function() {
    },
    methods: {
        close: function() {
            this.$emit("hide-choice");
        },
        confirm: function() {
            this.close();
            this.choice_consumer_func(this.picked);
        }
    }
}
