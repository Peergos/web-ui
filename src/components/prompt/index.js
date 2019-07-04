module.exports = {
    template: require('prompt.html'),
    data: function() {
        return {'prompt_result': ''}
    },
    props: ['prompt_message', 'placeholder', 'value', 'consumer_func'],
    created: function() {
	Vue.nextTick(function() {
            document.getElementById("prompt-input").focus();
        });
    },
    methods: {
        close: function () {
            this.$emit("hide-prompt");
        },

        getPrompt: function(prompt_result) {
            this.close();
            this.prompt_result='';
            this.consumer_func(prompt_result);
        }
    }
}
