module.exports = {
    template: require('warning.html'),
    data: function() {
        return {'warning_result': ''}
    },
    props: ['show', 'warning_message', 'consumer_func'],
    created: function() {
    },
    methods: {
        close: function () {
            this.show = false;
        },

        getPrompt: function(prompt_result) {
            this.close();
            this.prompt_result='';
            this.consumer_func(prompt_result);
        }
    }
}
