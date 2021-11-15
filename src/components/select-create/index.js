module.exports = {
    template: require('select-create.html'),
    data: function() {
        return {
            selected: '',
            select_result: '',
            options: [],
            newEntryToken: "@@@new@@@"
        }
    },
    props: ['select_message', 'select_placeholder', 'select_items', 'messages', 'select_consumer_func'],
    created: function() {
        let that = this;
        this.options.push({ text: 'Create new / Open existing', value: this.newEntryToken });
        let itemsExist = this.select_items != null && this.select_items.length > 0;
        if(itemsExist) {
            this.select_items.forEach(function(text){
                that.options.push({ text: text, value: text });
            });
        }
	    Vue.nextTick(function() {
            that.handleSelection(that.newEntryToken);
            that.selected = that.newEntryToken;
            document.getElementById("create-input").focus();
        });
    },
    methods: {
        showMessage: function(message) {
            this.$toast.error(message, {timeout:false});
        },
        onChange: function (event) {
            let newVal = event.target.value;
            this.handleSelection(newVal);
        },
        handleSelection: function (newVal) {
            if(newVal == this.newEntryToken) {
                document.getElementById("name-input").style.display = '';
                document.getElementById("name-input-button").style.display = '';
                document.getElementById("create-input").focus();
            } else {
                document.getElementById("name-input").style.display = 'none';
                document.getElementById("name-input-button").style.display = 'none';
                this.select_consumer_func(newVal);
                this.close();
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
            if (!res.match(/^[a-z\d\-_\.\s]+$/i)) {
                this.showMessage("Invalid name. Use only alphanumeric characters plus space, dash, dot and underscore");
                return;
            }
            this.select_result='';
            this.options = [];
            this.select_consumer_func(res);
            this.close();
        }
    }
}
