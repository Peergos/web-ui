<template>
	<transition name="modal" appear>
		<div class="pg-dialog__mask" @click="closePrompt()">
			<div class="pg-dialog pg-dialog--prompt" role="dialog" aria-modal="true" :aria-label="message" @click.stop>
				<header class="pg-dialog__head">
					<h3 class="pg-dialog__title">{{message}}</h3>
					<DialogClose @close="closePrompt()"/>
				</header>
				<div class="pg-dialog__body new-app__body">
					<p class="pg-note">
						See <a class="help-link" href="https://book.peergos.org/features/apps.html" target="_blank" rel="noopener noreferrer">documentation</a> for instructions on building custom Apps
					</p>
					<label class="new-app__field">
						<span>Name:</span>
						<input
							id="prompt-input"
							ref="prompt"
							class="pg-input"
							v-model="prompt_result"
							type="text"
							:placeholder="placeholder"
							:maxlength="maxLength"
						>
					</label>
					<div class="new-app__permissions">
						<span class="new-app__label">App Permissions:</span>
						<label class="pg-switch">
							<input type="checkbox" name="STORE_APP_DATA" v-model="STORE_APP_DATA">
							<span class="pg-switch__track" aria-hidden="true"></span>
							<span>Can store and read files in a folder private to the app</span>
						</label>
						<label class="pg-switch">
							<input type="checkbox" name="EDIT_CHOSEN_FILE" v-model="EDIT_CHOSEN_FILE">
							<span class="pg-switch__track" aria-hidden="true"></span>
							<span>Can modify file chosen by user</span>
						</label>
						<label class="pg-switch">
							<input type="checkbox" name="READ_CHOSEN_FOLDER" v-model="READ_CHOSEN_FOLDER">
							<span class="pg-switch__track" aria-hidden="true"></span>
							<span>Can read selected files of the associated types from folder chosen by user</span>
						</label>
					</div>
				</div>
				<footer class="pg-dialog__foot">
					<div class="pg-dialog__actions">
						<span class="pg-dialog__spacer"></span>
						<button type="button" class="pg-btn" @click="closePrompt()">Cancel</button>
						<button type="button" id='prompt-button-id' class="pg-btn pg-btn--primary" @click="getPrompt()">{{action}}</button>
					</div>
				</footer>
			</div>
		</div>
	</transition>
</template>

<script>
const DialogClose = require("../../dialog/DialogClose.vue");

module.exports = {
    components: {
        DialogClose,
    },
	data() {
		return {
			prompt_result: '',
			STORE_APP_DATA: false,
			EDIT_CHOSEN_FILE: false,
			READ_CHOSEN_FOLDER: false
		}
	},
	props: {
		message: {
			type: String,
			default: 'Create new App'
		},
		placeholder: {
			type: String,
			default: 'App name'
		},
		value:{
			type: String,
			default: ''
		},
		max_input_size:{
			type: Number,
			default: 25
		},
		consumer_func: {
			type: Function
		},
		action:{
			type: String,
			default: 'Create'
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
			this.$emit("hide-prompt");
		},
        validateAppName: function(displayName) {
            if (displayName === '')
                return false;
            if (displayName.includes('.') || displayName.includes('..'))
                return false;
            if (!displayName.match(/^[a-z\d\-_\s]+$/i)) {
                return false;
            }
            return true;
        },
		getPrompt() {
		    let appName = this.prompt_result.trim();
            if (appName === '') {
                this.$toast.error('Invalid App name',{timeout:false});
                return;
            }
            if (!this.validateAppName(appName)) {
                this.$toast.error('App name invalid. Use only alphanumeric characters plus dash and underscore');
                return;
            }
            if (this.EDIT_CHOSEN_FILE && this.READ_CHOSEN_FOLDER) {
                this.$toast.error('Invalid permission selection. Cannot select both modify file and read folder!',{timeout:false});
                return;
            }
            let permissions = [];
            if (this.STORE_APP_DATA) {
                permissions.push('STORE_APP_DATA');
            }
            if (this.EDIT_CHOSEN_FILE) {
                permissions.push('EDIT_CHOSEN_FILE');
            }
            if (this.READ_CHOSEN_FOLDER) {
                permissions.push('READ_CHOSEN_FOLDER');
            }
			this.consumer_func(appName, permissions);
			this.closePrompt();
		}
	}
}

</script>

<style>
.new-app__body {
	display: flex;
	flex-direction: column;
	gap: 14px;
}

.new-app__field {
	display: flex;
	flex-direction: column;
	gap: 6px;
	margin: 0;
	font-size: var(--text-small);
	font-weight: var(--regular);
}

/* each permission on a line of its own, wrapping inside its pill rather than running off */
.new-app__permissions {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 10px;
}

/* these labels run to two lines on a phone, where a pill turns into a capsule */
.new-app__permissions .pg-switch {
	max-width: 100%;
	border-radius: var(--radius-control);
}

.new-app__label {
	font-size: var(--text-small);
}
</style>
