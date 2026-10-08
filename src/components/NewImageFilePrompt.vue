<template>
	<transition name="modal" appear>
		<div class="pg-dialog__mask" @click="closePrompt()">
			<div class="pg-dialog pg-dialog--prompt" role="dialog" aria-modal="true" aria-label="Enter an image file name" @click.stop>
				<header class="pg-dialog__head">
					<h3 class="pg-dialog__title">Enter an image file name</h3>
					<DialogClose @close="closePrompt()"/>
				</header>
				<div class="pg-dialog__body new-image__body">
					<input
						id="prompt-input"
						ref="prompt"
						class="pg-input"
						v-model="prompt_result"
						type="text"
						:placeholder="placeholder"
						:maxlength="max_input_size"
						@keyup.enter="getPrompt()"
					>
					<div class="new-image__formats" role="radiogroup" aria-label="Format">
						<label class="pg-switch">
							<input type="radio" name="image-format" value="jpg" v-model="format">
							<span class="pg-switch__track" aria-hidden="true"></span>
							<span>JPG</span>
						</label>
						<label class="pg-switch">
							<input type="radio" name="image-format" value="png" v-model="format">
							<span class="pg-switch__track" aria-hidden="true"></span>
							<span>PNG</span>
						</label>
					</div>
				</div>
				<footer class="pg-dialog__foot">
					<div class="pg-dialog__actions">
						<span class="pg-dialog__spacer"></span>
						<button type="button" class="pg-btn" @click="closePrompt()">{{ translate("PROMPT.CANCEL") }}</button>
						<button type="button" id="prompt-button-id" class="pg-btn pg-btn--primary" :disabled="! canSubmit" @click="getPrompt()">{{ translate("PROMPT.OK") }}</button>
					</div>
				</footer>
			</div>
		</div>
	</transition>
</template>

<script>
const DialogClose = require("./dialog/DialogClose.vue");
const i18n = require("../i18n/index.js");

module.exports = {
	components: {
		DialogClose,
	},
	mixins:[i18n],
	data() {
		return {
			prompt_result: '',
			placeholder: 'File name',
			max_input_size: 200,
			format: 'jpg',
		}
	},
	props: {
		consumer_func: {
			type: Function
		}
	},
	computed: {
		canSubmit() {
			return this.prompt_result.trim().length > 0;
		}
	},

	mounted() {
		this.$refs.prompt.focus()
	},

	methods: {
		closePrompt() {
			this.consumer_func(null);
			this.$emit("hide-prompt");
		},

		getPrompt() {
			if (! this.canSubmit)
				return;
			this.consumer_func(this.prompt_result + '.' + this.format);
			this.$emit("hide-prompt");
		}
	}
}

</script>

<style>
.new-image__body {
	display: flex;
	flex-direction: column;
	gap: 14px;
}

.new-image__formats {
	display: flex;
	flex-wrap: wrap;
	gap: 10px;
}

/* a page-wide rule hides every radio outright, which also takes it out of the tab order */
.new-image__formats input[type="radio"] {
	display: inline;
	visibility: visible;
}
</style>
