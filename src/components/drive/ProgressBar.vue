
<template>
	<div class="app-progressbar">
		<div class="progress__head">
			<AppIcon v-if="transferKind().length > 0" class="progress__icon"
				:class="'progress__icon--' + transferKind()" :icon="transferKind()"/>
			<div class="progress__text">
				<p class="progress__title">{{ title }}</p>
				<p v-if="subtitle.length > 0" class="progress__subtitle">{{ subtitle }}</p>
			</div>
		</div>
		<div class="progress__row">
			<p v-if="stats.length > 0" class="app-progressbar__stats">{{ stats }}</p>
			<span class="progress__pct">{{ percentage }}%</span>
		</div>
		<div role="progressbar" class="pg-bar pg-bar--determinate progress__bar"
			:aria-valuenow="percentage" aria-valuemin="0" aria-valuemax="100">
			<span :style="{width: progress + '%'}"></span>
		</div>
		<div v-if="cancellable()" class="progress__actions">
			<button type="button" class="pg-btn pg-btn--quiet progress__cancel" @click="cancel">{{ translate("PROMPT.CANCEL") }}</button>
		</div>
	</div>
</template>

<script>
const AppIcon = require("../AppIcon.vue");
const i18n = require("../../i18n/index.js");
const transfers = require("../../mixins/transfers/index.js");
module.exports = {
	components: {
		AppIcon,
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
		},
		// 'upload' or 'download', which is also the glyph's name. A copy or a move
		// through this bar is neither and shows none.
		kind: {
			type: String,
			default: ''
		},
		// how many of the batch are through, for an upload that carries a count. A
		// download sends neither and is measured by its bytes alone.
		current: {
			type: Number,
			default: 0
		},
		total: {
			type: Number,
			default: 0
		}
	},

	computed:{
		progress(){
			// clamped: an upload reports the bytes it writes, and what goes up is larger
			// than the file it came from, so done passes max near the end
			let measured = Math.min(100, this.done / this.max * 100)
			if (this.total == 0)
				return measured
			// A batch's total is the size of its files alone, while what goes up carries
			// their padding and thumbnails too - a tenth as much again for a folder of
			// small ones, so the bytes run out before the files do. The count is exact:
			// a file still going cannot have contributed more than its whole share, which
			// is what the bar follows once the estimate has overrun.
			measured = Math.min(measured, (this.current + 1) / this.total * 100)
			// and the last of them is not done until it says so
			if (this.current < this.total)
				measured = Math.min(measured, 99)
			return measured
		},
		percentage(){
			// floor, so it reads 100% when it is done rather than just before
			return Math.floor(this.progress)
		}
	},
	methods: {
		// The prop is what a toast is raised with; every $toast.update that rebuilds props
		// without it would otherwise drop the glyph mid-transfer, so the registry answers
		// for those - it holds the kind for as long as the transfer is running.
		transferKind() {
			if (this.kind.length > 0)
				return this.kind;
			const transfer = this.toastId != null ? transfers.get(this.toastId) : null;
			return transfer != null ? transfer.kind : '';
		},

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
/* vue-toastification paints its default toast #1976d2 with white text, which is
   what the white-on-white bar in here assumed; on the app's own surface it was
   invisible. This is the same job as a sync pair's progress, so it takes the same
   parts: the 4px track, the --blue-accent fill, and the percentage. */
.Vue-Toastification__toast.progress-toast {
	min-height: 0;
	padding: 14px 16px;
	font-family: var(--font-stack);
	color: var(--color);
	background-color: var(--bg);
	border: 1px solid var(--border-color);
	border-radius: var(--radius-container);
	box-shadow: var(--pg-shadow-dialog);
}

.progress-toast .Vue-Toastification__toast-body {
	width: 100%;
	min-width: 0;
}

/* the same control every dialog closes with: a round 36px target in the corner, not
   the library's bare cross */
.progress-toast .Vue-Toastification__close-button{
	display: flex;
	align-items: center;
	justify-content: center;
	align-self: flex-start;
	flex: 0 0 auto;
	width: 36px;
	height: 36px;
	/* the title's line is shorter than this control: lift it so it reads as centred on
	   the first row rather than hanging below it, as .pg-dialog__close does */
	margin: -9px -8px 0 0;
	padding: 0;
	opacity: 1;
	font-size: 20px;
	font-weight: var(--regular);
	border: 0;
	border-radius: 50%;
	background-color: transparent;
	color: var(--pg-muted);
	transition: background-color .15s;
}

.progress-toast .Vue-Toastification__close-button:hover{
	background-color: var(--pg-surface-2);
	color: var(--color);
}

.progress-toast .Vue-Toastification__close-button:focus-visible{
	outline: 2px solid var(--green-500);
	outline-offset: 2px;
}

@media (pointer: coarse) {
	.progress-toast .Vue-Toastification__close-button{
		width: 44px;
		height: 44px;
	}
}

.app-progressbar{
	display: flex;
	flex-direction: column;
	gap: 8px;
	color: var(--color);
}

/* the glyph says which way the bytes are going before the words do */
.progress__head {
	display: flex;
	align-items: flex-start;
	gap: 10px;
	min-width: 0;
}

.progress__text {
	min-width: 0;
}

.progress__icon {
	flex: none;
	width: 20px;
	height: 20px;
	margin-top: 1px;
}

/* both take the tone the page uses for work in flight, which is what the bar beneath
   them is already saying; the arrow, not the colour, says which way the bytes go */
.progress__icon--upload,
.progress__icon--download {
	color: var(--pg-on-busy);
}

.progress__title {
	margin: 0;
	font-size: var(--text-small);
	font-weight: var(--bold);
	line-height: 1.3;
}

.progress__subtitle {
	margin: 0;
	font-size: 13px;
	line-height: 1.3;
	color: var(--pg-muted);
	overflow-wrap: anywhere;
}

.progress__row {
	display: flex;
	align-items: baseline;
	gap: 10px;
}

.app-progressbar__stats {
	flex: 1 1 auto;
	width: auto;
	min-width: 0;
	margin: 0;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
	font-size: 13px;
	color: var(--pg-muted);
}

.progress__pct {
	flex: none;
	font-size: 13px;
	color: var(--pg-muted);
	font-variant-numeric: tabular-nums;
}

/* the bar is .pg-bar, the one the sync page shows; only its width is this toast's */
.app-progressbar .progress__bar{
	width: 100%;
}

.app-progressbar .pg-bar > span{
	width: 0;
}

.app-progressbar .progress__actions{
	display: flex;
	justify-content: flex-end;
	margin-top: 2px;
}

/* .pg-btn--quiet in the design system, at the size a toast has room for */
.app-progressbar .progress__cancel{
	min-height: 32px;
	padding: 6px 12px;
	font-size: 13px;
}
</style>