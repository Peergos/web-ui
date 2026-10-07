<template>
	<div class="toaster">
		<transition-group
			v-for="pos in positions"
			:key="pos"
			tag="div"
			:class="['Vue-Toastification__container', pos]"
			enter-active-class="Vue-Toastification__bounce-enter-active"
			leave-active-class="Vue-Toastification__bounce-leave-active"
			move-class="Vue-Toastification__bounce-move"
			@before-enter="beforeTransition"
			@before-leave="beforeTransition"
			@leave="leave"
			@after-enter="cleanUp"
			@after-leave="cleanUp"
		>
			<ToastItem v-for="t in visible(pos)" :key="t.id" :toast="t"/>
		</transition-group>
	</div>
</template>

<script>
const toasts = require("./index.js");
const ToastItem = require("./ToastItem.vue");

const DURATION = 750;

module.exports = {
	components: {
	    ToastItem,
	},
	data() {
		return {
			positions: toasts.POSITIONS,
		};
	},
	methods: {
		visible(pos) {
			return toasts.visible(pos);
		},
		beforeTransition(el) {
			el.style.animationDuration = DURATION + "ms";
			el.style.animationFillMode = "both";
		},
		// out of the flow while it leaves, so the ones below move up smoothly
		leave(el, done) {
			el.style.left = el.offsetLeft + "px";
			el.style.top = el.offsetTop + "px";
			el.style.width = getComputedStyle(el).width;
			el.style.position = "absolute";
			setTimeout(done, DURATION);
		},
		cleanUp(el) {
			el.style.animationFillMode = "";
			el.style.animationDuration = "";
		},
	},
};
</script>
