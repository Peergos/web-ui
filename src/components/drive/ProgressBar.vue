
<template>
	<div class="app-progressbar">
		<p>{{ title }}</p>
		<p v-if="subtitle.length > 0">{{ subtitle }}</p>
		<p v-if="stats.length > 0" class="app-progressbar__stats">{{ stats }}</p>
		<div role="progressbar" class="progress__bar">
			<div :style="{width: progress + '%'}"></div>
		</div>
		<div v-if="cancellable()" class="progress__actions">
			<AppButton class="progress__cancel" size="small" @click.native="cancel">{{ translate("PROMPT.CANCEL") }}</AppButton>
		</div>
	</div>
</template>

<script>
const AppButton = require("../AppButton.vue");
const i18n = require("../../i18n/index.js");
const transfers = require("../../mixins/transfers/index.js");
module.exports = {
	components: {
		AppButton,
	},
	mixins: [i18n],
	props: {
		// set by vue-toastification on whatever it renders inside a toast
		toastId: {
			type: [String, Number],
			default: null
		},
		title: {
			type: String,
			default: ''
		},
        subtitle: {
            type: String,
            default: ''
        },
        stats: {
            type: String,
            default: ''
        },
		done: {
			type: Number,
			default: 0
		},
		max:{
			type: Number,
			default: 1
		}
	},

	computed:{
		progress(){
			return this.done / this.max * 100
		}
	},
	methods: {
		// a method rather than computed: the registry isn't reactive, and every progress update re-renders
		cancellable() {
			return this.toastId != null && transfers.get(this.toastId) != null;
		},
		closeMessage() {
			this.$emit('close-toast')
		},
		cancel() {
			const transfer = transfers.cancel(this.toastId);
			this.closeMessage();
			if (transfer == null)
				return;
			const message = transfer.kind == 'upload' ? "DRIVE.UPLOAD.CANCELLED" : "DRIVE.DOWNLOAD.CANCELLED";
			this.$toast(this.translate(message), {timeout: 4000});
		}
	}
}

</script>

<style>
.app-progressbar{
	color: var(--color);
}

.app-progressbar__stats {
	width: 18em;
	overflow: hidden;
	white-space: nowrap;
	font-size: 0.9em;
	opacity: 0.85;
}

.app-progressbar .progress__bar{
	height: 6px;
	width: 100%;
	border-radius: 3px;
	background-color:rgba(255,255,255,0.4);
	overflow: hidden;
}
.app-progressbar .progress__bar div{
	height: 6px;
	width: 0;
	transition: width 2s ease;
	background-color: white;
}
.progress-toast .Vue-Toastification__close-button{
	align-self: flex-start;
	opacity: 0.7;
}

.app-progressbar .progress__actions{
	display: flex;
	justify-content: flex-end;
	margin-top: 8px;
}
.app-progressbar .progress__cancel{
	background-color:rgba(255,255,255,0.4);
}

</style>