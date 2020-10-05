module.exports = {
    template: require('create.html'),
    data: function() {
        return {
            create_result: '',
            selected: '',
            options: [
              { text: 'Please select', value: '', disabled: true }
            ]
        }
    },
    props: ['create_message', 'placeholder', 'items', 'messages', 'consumer_func'],
    created: function() {
        let that = this;
        if(this.items != null) {
            this.items.forEach(function(pair){
                let entry = { text: pair.text, value: pair.value };
                that.options.push(entry);
            });
	    }
        let newEntry = { text: 'create new...', value: '@@@new@@@' }
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
            } else {
                document.getElementById("name-input").style.display = 'none';
                document.getElementById("name-input-button").style.display = 'none';
                this.close();
                this.consumer_func(newVal);
            }
        },
        close: function () {
            this.$emit("hide-create");
        },

        setResult: function() {
	        var res = this.create_result.trim();
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
            this.create_result='';
            this.consumer_func(res);
        }
    }
}
