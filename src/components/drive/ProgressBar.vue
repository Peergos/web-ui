
<template>
	<div class="app-progressbar">
		<p>{{ title }}</p>
		<p v-if="subtitle.length > 0">{{ subtitle }}</p>
		<div role="progressbar" class="progress__bar">
			<div :style="{width: progress + '%'}"></div>
		</div>
		<!-- <AppButton class="progress__close" size="small" @click="closeMessage">Dismiss</AppButton> -->
	</div>
</template>

<script>
module.exports = {
	props: {
		title: {
			type: String,
			default: ''
		},
        subtitle: {
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
		closeMessage() {
			this.$emit('close-toast')
		}
	}
}

</script>

<style>
.app-progressbar{
	color: var(--color);
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
/* .app-progressbar .progress__close{
	position: absolute;
	bottom: 8px;
	right: 8px;
	background-color:rgba(255,255,255,0.4);
} */

</style>