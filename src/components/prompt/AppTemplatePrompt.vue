<template>
	<transition name="modal" appear>
		<div class="app-template-prompt app-modal__overlay" @click="closePrompt()">

			<div class="app-template-prompt__container" @click.stop>
				<header class="template-prompt__header">
					<AppButton class="close" icon="close" @click.native="closePrompt()"/>
					<h3>{{message}}</h3>
				</header>
				<div class="modal-body" style="padding: 15px;">
                        <div class="flex-thumbnail-container">
                            <div style="padding:20px;">
		                        <img id="profile-image" alt="Profile image" v-if="hasAppIcon()" style="width:128px; height:128px" v-bind:src="getAppIcon()"/>
	                        </div>
                            <div class="flex-image-button-container">
                                <div class="flex-container">
		                            <button class="btn btn-success flex-grow" @click="triggerUpload">Set Icon</button>
		                            <input type="file" id="uploadImageInput" @change="uploadImageFile" style="display:none;" accept="image/*" />
		                        </div>
                            </div>
                        </div>
                </div>
				<div v-if="maxLength > 0" class="template-prompt__body" style="margin: 20px;">
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
				<footer class="template-prompt__footer">
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
            document.getElementById('uploadImageInput').click()
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
.app-template-prompt.app-modal__overlay{
	display:flex;
	align-items: center;
	justify-content: center;
}
.app-template-prompt__container{
	width: 400px;
	padding: 16px;
	border-radius: 4px;
	color: var(--color);
	background-color:var(--bg);
	box-shadow: 0 6px 16px rgba(0,0,0,0.15);
}
.template-prompt__header h3{
	border-top:0;
	font-weight: var(--regular);
}
.template-prompt__body{
	margin: var(--app-margin) 0;
}
.template-prompt__footer{
	display: flex;
	justify-content: flex-end;
}
.template-prompt__footer button{
	margin-left: 16px;
}
.flex-thumbnail-container {
  display: flex;
  justify-content: center;
  align-items: center;
}

.flex-image-button-container {
  display: flex;
  flex-direction: column;
}
</style>