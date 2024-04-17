<template>
	<transition name="modal" appear>
		<div class="task-prompt task-modal__overlay" @click="close()">

			<div class="task__container" @click.stop>
				<header class="task__header">
					<AppButton class="close" icon="close" @click.native="close()"/>
					<h3>{{select_message}}</h3>
				</header>
				<div class="task__body">
				    <div>
                        <select v-model="selected" @change="onChange($event)" class="form-select" style="min-width: 125px; margin: 0;">
                            <option v-for="option in options" v-bind:value="option.value" v-bind:disabled="option.disabled">
                                {{ option.text }}
                            </option>
                        </select>
                    </div>
                    <div>
                        <input v-if="showNameInput" id="create-input" v-model="select_result" type="text"
                               v-bind:placeholder="select_placeholder" maxlength="25" v-on:keyup.enter="setResult" autofocus></input>
                    </div>
				</div>
				<footer v-if="showOKButton" class="task__footer">
					<AppButton
						id='prompt-button-id'
						type="primary"
						accent
						@click.native="setResult()"
					>
					OK
					</AppButton>
				</footer>
			</div>
		</div>
	</transition>
</template>

<script>
const AppButton = require("../AppButton.vue");

module.exports = {
    components: {
        AppButton,
    },
    data: function() {
        return {
            selected: '',
            select_result: '',
            options: [],
            newEntryToken: "@@@new@@@",
            showNameInput: true,
            showOKButton: true,
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
                this.showNameInput = true;
                this.showOKButton = true;
                document.getElementById("create-input").focus();
            } else {
                this.showNameInput = false;
                this.showOKButton = false;
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
.task-prompt.task-modal__overlay{
    position: fixed;
    margin-top: 100px;
    left: 50%;
    margin-left: -180px;
}
.task__container{
	width: 400px;
	padding: 16px;
	border-radius: 4px;
	color: var(--color);
	background-color:var(--bg);
	box-shadow: 0 6px 16px rgba(0,0,0,0.15);
}
@media (max-width: 400px) {
    .task-prompt.task-modal__overlay{
        margin-left: -175px;
    }
    .task__container{
        width: 350px;
    }
}

.task__header h3{
	border-top:0;
	font-weight: var(--regular);
}
.task__body{
	margin: var(--app-margin) 0;
}
.task__footer{
	display: flex;
	justify-content: flex-end;
}
.task__footer button{
	margin-left: 16px;
}

.form-select{
	width:100%;
	margin: 8px 0;
	padding: 0 16px;

	font-size: var(--text);
	line-height: 48px;
	border-radius: 4px;

	-webkit-appearance:none;
    -moz-appearance:none;
    appearance: none;

	outline: none;
	box-shadow: none;

	border: 2px solid var(--green-500);
	color: var(--color);
    background-color: var(--bg);
}
</style>