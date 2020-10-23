module.exports = {
    template: require('prompt.html'),
    data: function() {
        return {'prompt_result': '',
                input_length: 255
        }
    },
    props: ['prompt_message', 'placeholder', 'value', 'consumer_func', 'max_input_size'],
    created: function() {
        this.prompt_result = this.value;
        this.input_length = (this.max_input_size == null || this.max_input_size == '') ? 255 : this.max_input_size;
        Vue.nextTick(function() {
                document.getElementById("prompt-input").focus();
        });
    },
    methods: {
        close: function () {
            this.$emit("hide-prompt");
        },

        getPrompt: function() {
	    var res = this.prompt_result;
            this.close();
            this.prompt_result='';
            this.consumer_func(res);
        }
    }
}
