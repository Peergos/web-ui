<template>
<transition name="modal">
    <div class="modal-mask" @click="close">
        <div style="height:30%"></div>
        <div class="modal-container" @click.stop>

            <div class="modal-header">
                <h3>{{select_message}}</h3>
            </div>

            <div class="modal-body">
                <div class="container app-tabs">
                    <div style="display: flex;align-items: center; flex-wrap: wrap; flex-direction: column;">
                        <div style="margin: 10px; width: 100%;">
                            <select v-model="selected" @change="onChange($event)" class="form-control" style="min-width: 125px; margin: 0;">
                                <option v-for="option in options" v-bind:value="option.value" v-bind:disabled="option.disabled">
                                    {{ option.text }}
                                </option>
                            </select>
                        </div>
                        <div id="name-input" style="display: none; margin: 10px; width: 100%;">
                            <input id="create-input" v-model="select_result" type="text"
                                   v-bind:placeholder="select_placeholder" class="form-control" maxlength="25" v-on:keyup.enter="setResult" autofocus />
                        </div>
                        <div id="name-input-button" style="display: none; margin: 10px; width: 100%;">
                            <button id='create-new-button-id' class="btn btn-success" @click="setResult()" style="width: 100%;">OK</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</transition>
</template>

<script>
export default {
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
</script>
<style>
</style>
