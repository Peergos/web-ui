module.exports = {
    template: require('select-create.html'),
    data: function() {
        return {
            select_result: '',
            selected: '',
            options: []
        }
    },
    props: ['select_message', 'select_placeholder', 'select_items', 'messages', 'select_consumer_func'],
    created: function() {
        let that = this;
        that.options.push({ text: 'Please select', value: '', disabled: true });
        if(this.select_items != null && this.select_items.length > 0) {
            this.select_items.forEach(function(text){
                that.options.push({ text: text, value: text });
            });
	    }
        let newEntry = { text: 'Create new...', value: '@@@new@@@' }
        this.options.push(newEntry);
	    Vue.nextTick(function() {
            document.getElementById("create-input").focus();
        });
    },
    methods: {
        showMessage: function(title, body) {
            this.messages.push({
                title: title,
                body: body,
                show: true
            });
        },
        onChange: function (event) {
            let newVal = event.target.value;
            if(newVal == "@@@new@@@") {
                document.getElementById("name-input").style.display = '';
                document.getElementById("name-input-button").style.display = '';
                document.getElementById("create-input").focus();
            } else {
                document.getElementById("name-input").style.display = 'none';
                document.getElementById("name-input-button").style.display = 'none';
                this.close();
                this.select_consumer_func(newVal);
            }
        },
        close: function () {
            this.$emit("hide-select");
        },

        setResult: function() {
	        var res = this.select_result.trim();
            if (res === null)
                return;
            if (res == '')
                return;
            if (!res.match(/^[a-z\d\-_\s]+$/i)) {
                this.showMessage("Invalid name. Use only alphanumeric characters plus space, dash and underscore");
                this.close();
                return;
            }
            this.close();
            this.select_result='';
            this.options = [];
            this.select_consumer_func(res);
        }
    }
}