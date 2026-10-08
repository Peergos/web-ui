<template>
	<transition name="modal" appear>
		<div class="app-modal pg-dialog__mask" @click="closeModal()">
			<div class="pg-dialog app-modal__dialog" :class="{'app-modal__dialog--wide': wide}" role="dialog" aria-modal="true" :aria-label="title" @click.stop>
				<header class="pg-dialog__head">
					<h3 class="pg-dialog__title">{{ title }}</h3>
					<DialogClose @close="closeModal()"/>
				</header>
				<div class="pg-dialog__body app-modal__body">
					<slot name="body"></slot>
				</div>
				<footer v-if="$slots.footer" class="pg-dialog__foot">
					<div class="pg-dialog__actions">
						<span class="pg-dialog__spacer"></span>
						<slot name="footer"></slot>
					</div>
				</footer>
			</div>
		</div>
	</transition>
</template>

<script>
const DialogClose = require("../dialog/DialogClose.vue");

module.exports = {
	components: {
	    DialogClose,
	},
	name: 'AppModal',
	props: {
		title: {
			type: String,
			default: ''
		},
		// for a modal whose content is laid out across the width, such as plans side by side
		wide: {
			type: Boolean,
			default: false
		},
	},
	methods: {
		closeModal() {
			this.$store.commit("SET_MODAL", false);
		}
	},
}
</script>

<style>
/* The account and settings modals, on the surface every other dialog uses: one column of
   parts with the same gap between each, the actions along the foot. */
.app-modal__dialog {
	width: 520px;
}

.app-modal__dialog--wide {
	width: 760px;
}

.app-modal__body {
	display: flex;
	flex-direction: column;
	gap: 14px;
}

.app-modal__body > * {
	flex: none;
}

/* a label over its field, as the sync and mount dialogs set theirs */
.app-modal__field {
	display: flex;
	flex-direction: column;
	gap: 6px;
	margin: 0;
	font-size: var(--text-small);
	font-weight: var(--regular);
}

.app-modal__body textarea.pg-input {
	min-height: 120px;
	padding: 10px 12px;
	resize: vertical;
	font-size: 15px;
	line-height: 1.4;
	background-color: var(--pg-surface-2);
	border: 1px solid var(--border-color);
	box-shadow: none;
}

/* a switch sizes to its label rather than stretching across the dialog */
.app-modal__switch {
	align-self: flex-start;
	max-width: 100%;
}

/* a second, explicit yes before something that cannot be undone */
.app-modal__confirm p {
	margin: 0;
}

.app-modal__confirm-actions {
	display: flex;
	flex-wrap: wrap;
	justify-content: flex-end;
	gap: 8px;
	margin-top: 8px;
}

/* the prompt-style dialogs not yet moved to the dialog surface still sit on this overlay */
.app-modal__overlay{
	position: fixed;
	z-index: 400;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background-color: rgba(0, 0, 0, .4);
	overflow-y: auto;
	overflow-x: hidden;

	display: flex;
	align-items: center;
	justify-content: center;
}
</style>
