module.exports = {
    template: require('prompt.html'),
    data: function() {
        return {'prompt_result': ''}
    },
    props: ['show', 'prompt_message', 'placeholder', 'consumer_func'],
    created: function() {
    },
    methods: {
        close: function () {
            this.show = false;
        },

        getPrompt: function(prompt_result) {
            console.log("getPrompt " + prompt_result + this.consumer_func)
                this.close();
            this.prompt_result='';
            this.consumer_func(prompt_result);
        }
    }
}
