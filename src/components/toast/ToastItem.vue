<template>
	<div
		:class="classes"
		:style="dragStyle"
		@click="onClick"
		@mouseenter="hovered = true"
		@mouseleave="hovered = false"
		@pointerdown="dragStart"
		@pointermove="dragMove"
		@pointerup="dragEnd"
		@pointercancel="dragEnd"
	>
		<template v-if="toast.icon">
			<svg v-if="toast.type == 'success'" class="Vue-Toastification__icon svg-inline--fa fa-check-circle fa-w-16" aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M504 256c0 136.967-111.033 248-248 248S8 392.967 8 256 119.033 8 256 8s248 111.033 248 248zM227.314 387.314l184-184c6.248-6.248 6.248-16.379 0-22.627l-22.627-22.627c-6.248-6.249-16.379-6.249-22.628 0L216 308.118l-70.059-70.059c-6.248-6.248-16.379-6.248-22.628 0l-22.627 22.627c-6.248 6.248-6.248 16.379 0 22.627l104 104c6.249 6.249 16.379 6.249 22.628.001z"></path></svg>
			<svg v-else-if="toast.type == 'error'" class="Vue-Toastification__icon svg-inline--fa fa-exclamation-triangle fa-w-18" aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512"><path fill="currentColor" d="M569.517 440.013C587.975 472.007 564.806 512 527.94 512H48.054c-36.937 0-59.999-40.055-41.577-71.987L246.423 23.985c18.467-32.009 64.72-31.951 83.154 0l239.94 416.028zM288 354c-25.405 0-46 20.595-46 46s20.595 46 46 46 46-20.595 46-46-20.595-46-46-46zm-43.673-165.346l7.418 136c.347 6.364 5.609 11.346 11.982 11.346h48.546c6.373 0 11.635-4.982 11.982-11.346l7.418-136c.375-6.874-5.098-12.654-11.982-12.654h-63.383c-6.884 0-12.356 5.78-11.981 12.654z"></path></svg>
			<svg v-else-if="toast.type == 'warning'" class="Vue-Toastification__icon svg-inline--fa fa-exclamation-circle fa-w-16" aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M504 256c0 136.997-111.043 248-248 248S8 392.997 8 256C8 119.083 119.043 8 256 8s248 111.083 248 248zm-248 50c-25.405 0-46 20.595-46 46s20.595 46 46 46 46-20.595 46-46-20.595-46-46-46zm-43.673-165.346l7.418 136c.347 6.364 5.609 11.346 11.982 11.346h48.546c6.373 0 11.635-4.982 11.982-11.346l7.418-136c.375-6.874-5.098-12.654-11.982-12.654h-63.383c-6.884 0-12.356 5.78-11.981 12.654z"></path></svg>
			<svg v-else class="Vue-Toastification__icon svg-inline--fa fa-info-circle fa-w-16" aria-hidden="true" focusable="false" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M256 8C119.043 8 8 119.083 8 256c0 136.997 111.043 248 248 248s248-111.003 248-248C504 119.083 392.957 8 256 8zm0 110c23.196 0 42 18.804 42 42s-18.804 42-42 42-42-18.804-42-42 18.804-42 42-42zm56 254c0 6.627-5.373 12-12 12h-88c-6.627 0-12-5.373-12-12v-24c0-6.627 5.373-12 12-12h12v-64h-12c-6.627 0-12-5.373-12-12v-24c0-6.627 5.373-12 12-12h64c6.627 0 12 5.373 12 12v100h12c6.627 0 12 5.373 12 12v24z"></path></svg>
		</template>
		<div v-if="isString" role="alert" class="Vue-Toastification__toast-body">{{ toast.content }}</div>
		<div v-else role="alert" class="Vue-Toastification__toast-component-body">
			<component
				:is="toast.content.component"
				:toast-id="toast.id"
				v-bind="toast.content.props"
				v-on="toast.content.listeners || {}"
				@close-toast="close"
			/>
		</div>
		<button
			v-if="toast.closeButton"
			type="button"
			aria-label="close"
			:class="['Vue-Toastification__close-button', {'show-on-hover': toast.showCloseButtonOnHover}]"
			@click.stop="close"
		>&times;</button>
	</div>
</template>

<script>
const toasts = require("./index.js");

const DRAG_REMOVE_FRACTION = 0.6;

module.exports = {
	props: {
		toast: Object,
	},
	data() {
		return {
			hovered: false,
			focused: document.hasFocus(),
			timer: null,
			remaining: 0,
			startedAt: 0,
			dragging: false,
			dragFrom: 0,
			dragX: 0,
			dragged: false,
		};
	},
	computed: {
		isString() {
			return typeof this.toast.content === "string";
		},
		classes() {
			let res = ["Vue-Toastification__toast", "Vue-Toastification__toast--" + this.toast.type, this.toast.position];
			return res.concat(this.toast.toastClassName || []);
		},
		paused() {
			return (this.toast.pauseOnHover && this.hovered) || (this.toast.pauseOnFocusLoss && ! this.focused);
		},
		dragStyle() {
			if (this.dragging)
				return {
					transform: "translateX(" + this.dragX + "px)",
					opacity: 1 - Math.min(1, Math.abs(this.dragX) / (this.$el.offsetWidth * DRAG_REMOVE_FRACTION)),
				};
			if (this.dragged)
				return {transition: "transform 0.2s, opacity 0.2s", transform: "translateX(0)", opacity: 1};
			return {};
		},
	},
	watch: {
		// a new object on every update, so an update that sets a timeout starts it again
		toast(next, prev) {
			if (next.timeout !== prev.timeout || next.updated !== prev.updated)
				this.startTimer();
		},
		paused(isPaused) {
			if (isPaused)
				this.pauseTimer();
			else
				this.resumeTimer();
		},
	},
	mounted() {
		window.addEventListener("blur", this.onBlur);
		window.addEventListener("focus", this.onFocus);
		this.startTimer();
	},
	beforeDestroy() {
		this.cleanUp();
	},
	beforeUnmount() {
		this.cleanUp();
	},
	methods: {
		cleanUp() {
			window.removeEventListener("blur", this.onBlur);
			window.removeEventListener("focus", this.onFocus);
			this.clearTimer();
		},
		onBlur() {
			this.focused = false;
		},
		onFocus() {
			this.focused = true;
		},
		close() {
			toasts.toast.dismiss(this.toast.id);
		},
		clearTimer() {
			if (this.timer != null)
				clearTimeout(this.timer);
			this.timer = null;
		},
		startTimer() {
			this.clearTimer();
			if (! this.toast.timeout)
				return;
			this.remaining = this.toast.timeout;
			if (! this.paused)
				this.resumeTimer();
		},
		pauseTimer() {
			if (this.timer == null)
				return;
			this.clearTimer();
			this.remaining -= Date.now() - this.startedAt;
		},
		resumeTimer() {
			if (! this.toast.timeout || this.timer != null)
				return;
			this.startedAt = Date.now();
			this.timer = setTimeout(this.close, Math.max(0, this.remaining));
		},
		onClick() {
			if (this.toast.closeOnClick && ! this.dragged)
				this.close();
		},
		dragStart(e) {
			if (! this.toast.draggable || e.button !== 0)
				return;
			this.dragging = true;
			this.dragged = false;
			this.dragFrom = e.clientX;
			this.dragX = 0;
		},
		dragMove(e) {
			if (! this.dragging)
				return;
			this.dragX = e.clientX - this.dragFrom;
			if (Math.abs(this.dragX) > 3 && ! this.dragged) {
				this.dragged = true;
				this.$el.setPointerCapture(e.pointerId);
			}
		},
		dragEnd() {
			if (! this.dragging)
				return;
			this.dragging = false;
			if (Math.abs(this.dragX) > this.$el.offsetWidth * DRAG_REMOVE_FRACTION)
				this.close();
			// the click that ends a drag should not also close the toast
			let wasDragged = this.dragged;
			setTimeout(() => { if (wasDragged) this.dragged = false; }, 250);
		},
	},
};
</script>
