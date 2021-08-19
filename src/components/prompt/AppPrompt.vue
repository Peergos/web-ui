<template>
	<transition name="modal" appear>
		<div class="app-prompt app-modal__overlay" @click="closePrompt()">

			<div class="app-prompt__container" @click.stop>
				<header class="prompt__header">
					<AppButton class="close" @click="closePrompt()">
						<AppIcon icon="close" />
					</AppButton>
					<h3>{{prompt_message}}</h3>
				</header>
				<div class="prompt__body">
					<input
						id="prompt-input"
						ref="prompt"
						v-model="prompt_result"
						type="text"
						v-bind:placeholder="placeholder"
						:maxlength="input_length"
						@:keyup.enter="getPrompt"
						autofocus
					>
					</input>
				</div>
				<footer class="prompt__footer">
					<AppButton outline @click="closePrompt()">
						Cancel
					</AppButton>

					<AppButton
						id='prompt-button-id'
						type="primary"
						@click="getPrompt(this.prompt_result)"
					>
					OK
					</AppButton>
				</footer>
			</div>
		</div>
	</transition>
</template>

<script>
module.exports = {
	data: function() {
		return {
			'prompt_result': '',
			input_length: 255
		}
	},
    props: ['prompt_message', 'placeholder', 'value', 'consumer_func', 'max_input_size'],

	mounted() {
		this.prompt_result = this.value;
		this.input_length = (this.max_input_size == null || this.max_input_size == '') ? 255 : this.max_input_size;
		this.$refs.prompt.focus()
	},

	methods: {
		closePrompt() {
			this.$emit("hide-prompt");
		},

		getPrompt() {
			var res = this.prompt_result;
			this.closePrompt();
			this.prompt_result = '';
			this.consumer_func(res);
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