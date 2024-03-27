<template>
	<transition name="modal" appear>
		<div class="app-prompt app-modal__overlay" @click="closePrompt()">

			<div class="app-prompt__container" @click.stop>
				<header class="prompt__header">
					<AppButton class="close" icon="close" @click.native="closePrompt()"/>
					<h3>{{message}}</h3>
				</header>
				<div class="prompt__body">
					<input
						v-if="placeholder"
						id="prompt-input"
						ref="prompt"
						v-model="prompt_result"
						type="text"
						:placeholder="placeholder"
						:maxlength="maxLength"
						@keyup.enter="getPrompt(this.prompt_result)"
						autofocus
					>
					</input>
				</div>
				<footer class="prompt__footer">
					<AppButton outline @click.native="closePrompt()">
						{{ translate("PROMPT.CANCEL") }}
					</AppButton>

					<AppButton
						id='prompt-button-id'
						type="primary"
						accent
						@click.native="getPrompt(this.prompt_result)"
					>
					{{action}}
					</AppButton>
				</footer>
			</div>
		</div>
	</transition>
</template>

<script>
const AppButton = require("../AppButton.vue");
const i18n = require("../../i18n/index.js");

module.exports = {
    components: {
        AppButton,
    },
    mixins:[i18n],
	data() {
		return {
			prompt_result: '',
		}
	},
	props: {
		message: {
			type: String,
			default: ''
		},
		placeholder: {
			type: String,
			default: null
		},
		value:{
			type: String,
			default: ''
		},
		max_input_size:{
			type: Number,
			default: 255
		},
		consumer_func: {
			type: Function
		},
		action:{
			type: String,
		}


	},
	computed: {
		maxLength() {
			return (this.max_input_size == null || this.max_input_size == '') ? 255 : this.max_input_size;
		}
	},

	mounted() {
		this.prompt_result = this.value;

		if(this.placeholder !== null){
			this.$refs.prompt.focus()
		}
	},

	methods: {
		closePrompt() {
			this.consumer_func(null);
			this.$emit("hide-prompt");
		},

		getPrompt() {
			this.consumer_func(this.prompt_result);
			this.$emit("hide-prompt");
		}
	}
}

</script>

<style>
.app-prompt.app-modal__overlay{
	display:flex;
	align-items: center;
	justify-content: center;
}
.app-prompt__container{
	width: 400px;
	padding: 16px;
	border-radius: 4px;
	color: var(--color);
	background-color:var(--bg);
	box-shadow: 0 6px 16px rgba(0,0,0,0.15);
}
.prompt__header h3{
	border-top:0;
	font-weight: var(--regular);
}
.prompt__body{
	margin: var(--app-margin) 0;
}
.prompt__footer{
	display: flex;
	justify-content: flex-end;
}
.prompt__footer button{
	margin-left: 16px;
}


</style>