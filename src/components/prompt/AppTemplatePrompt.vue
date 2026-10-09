<template>
	<transition name="modal" appear>
		<div class="pg-dialog__mask" @click="closePrompt()">
			<div class="pg-dialog pg-dialog--prompt" role="dialog" aria-modal="true" :aria-label="message" @click.stop>
				<header class="pg-dialog__head">
					<h3 class="pg-dialog__title">{{message}}</h3>
					<DialogClose @close="closePrompt()"/>
				</header>
				<div class="pg-dialog__body app-template__body">
					<div class="app-template__icon">
						<img v-if="hasAppIcon()" alt="App icon" v-bind:src="getAppIcon()"/>
						<button type="button" class="pg-btn" @click="triggerUpload">Set Icon</button>
						<input type="file" ref="iconInput" @change="uploadImageFile" style="display:none;" accept="image/*" />
					</div>
					<input
						v-if="placeholder && maxLength > 0"
						id="prompt-input"
						ref="prompt"
						class="pg-input"
						v-model="prompt_result"
						type="text"
						:placeholder="placeholder"
						:maxlength="maxLength"
						@keyup.enter="getPrompt()"
					>
				</div>
				<footer class="pg-dialog__foot">
					<div class="pg-dialog__actions">
						<span class="pg-dialog__spacer"></span>
						<button type="button" class="pg-btn" @click="closePrompt()">{{ translate("PROMPT.CANCEL") }}</button>
						<button type="button" id='prompt-button-id' class="pg-btn pg-btn--primary" @click="getPrompt()">{{action}}</button>
					</div>
				</footer>
			</div>
		</div>
	</transition>
</template>

<script>
const DialogClose = require("../dialog/DialogClose.vue");
const i18n = require("../../i18n/index.js");

module.exports = {
    components: {
        DialogClose,
    },
    mixins:[i18n],
	data() {
		return {
			prompt_result: '',
			base64Image:'',
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
		},
        appIconBase64Image:{
            type: String,
        },
	},
	computed: {
		maxLength() {
		    if (this.max_input_size == -1) {
		        return -1;
		    }
			return (this.max_input_size == '') ? 32 : this.max_input_size;
		}
	},

	mounted() {
		this.prompt_result = this.value;
        this.base64Image = this.appIconBase64Image;
		if(this.placeholder !== null && this.maxLength > 0){
			this.$refs.prompt.focus()
		}
	},

	methods: {
		closePrompt() {
			this.consumer_func(null, null);
			this.$emit("hide-prompt");
		},

		getPrompt() {
			this.consumer_func(this.prompt_result, this.base64Image);
			this.$emit("hide-prompt");
		},
        getAppIcon: function() {
            return this.base64Image;
        },
        hasAppIcon: function() {
            return this.base64Image.length > 0;
        },
        triggerUpload: function() {
            this.$refs.iconInput.click()
        },
        uploadImageFile: function(evt) {
            let files = evt.target.files || evt.dataTransfer.files;
            let file = files[0];
            let that = this;
            let filereader = new FileReader();
            filereader.file_name = file.name;
            let thumbnailWidth = 64;
            let thumbnailHeight = 64;
            filereader.onload = function(){
                let canvas = document.createElement("canvas");
                canvas.width = thumbnailWidth;
                canvas.height = thumbnailHeight;
                let context = canvas.getContext("2d");
                let image = new Image();
                image.onload = function() {
                    try {
                        context.drawImage(image, 0, 0, thumbnailWidth, thumbnailHeight);
                    } catch (ex) {
                        console.log("Unable to create icon. Maybe blocked by browser addon?");
                    }
                    that.base64Image = canvas.toDataURL();
                };
                image.onerror = function() {
                    that.showMessage(true, that.translate("PROFILE.ERROR.IMAGE"));
                };
                image.src = this.result;
            };
            filereader.readAsDataURL(file);
        },
	}
}

</script>

<style>
.app-template__body {
	display: flex;
	flex-direction: column;
	gap: 14px;
}

.app-template__icon {
	display: flex;
	align-items: center;
	gap: 16px;
}

.app-template__icon img {
	width: 64px;
	height: 64px;
	border-radius: var(--radius-control);
}
</style>
