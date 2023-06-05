<template>
	<transition name="modal" appear>
		<div class="app-prompt app-modal__overlay" @click="closePrompt()">

			<div class="app-prompt__container" @click.stop>
				<header class="prompt__header">
					<AppButton class="close" icon="close" @click.native="closePrompt()"/>
					<h3>{{message}}</h3>
				</header>
                <div class="prompt__body">
                    <span>
                        See <a class="help-link" href="https://book.peergos.org/features/apps.html" target="_blank" rel="noopener noreferrer">documentation</a> for instructions on building custom Apps
                    </span>
                </div>
				<div class="prompt__body">
					<span>
                        Name:
                    </span>
					<input
						id="prompt-input"
						ref="prompt"
						v-model="prompt_result"
						type="text"
						:placeholder="placeholder"
						:maxlength="maxLength"
						autofocus
					>
					</input>
				</div>
                <div class="prompt__body">
                    <span>
                        App Permissions:
                    </span>
                    <label class="checkbox__group">
                       Can store and read files in a folder private to the app
                        <input
                            type="checkbox"
                            name="STORE_APP_DATA"
                            v-model="STORE_APP_DATA"
                        />
                        <span class="checkmark"></span>
                    </label>
                    <label class="checkbox__group">
                       Can modify file chosen by user
                        <input
                            type="checkbox"
                            name="EDIT_CHOSEN_FILE"
                            v-model="EDIT_CHOSEN_FILE"
                        />
                        <span class="checkmark"></span>
                    </label>
                    <label class="checkbox__group">
                       Can read selected files of the associated types from folder chosen by user
                        <input
                            type="checkbox"
                            name="READ_CHOSEN_FOLDER"
                            v-model="READ_CHOSEN_FOLDER"
                        />
                        <span class="checkmark"></span>
                    </label>
                </div>
				<footer class="prompt__footer">
					<AppButton outline @click.native="closePrompt()">
						Cancel
					</AppButton>

					<AppButton
						id='prompt-button-id'
						type="primary"
						accent
						@click.native="getPrompt()"
					>
					{{action}}
					</AppButton>
				</footer>
			</div>
		</div>
	</transition>
</template>

<script>
const AppButton = require("../../AppButton.vue");

module.exports = {
    components: {
        AppButton,
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
.help-link:link {
    text-decoration: underline;
}

</style>