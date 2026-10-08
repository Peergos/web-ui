<template>
	<div class="app-slider">
		<transition name="fade" mode="out-in">
			<figure :key="current" class="slide">
				<div v-if="slides[current].image" class="slide__frame">
					<img :src="slides[current].image" :alt="slides[current].title" class="slide__image"/>
				</div>
				<figcaption class="slide__text">
					<h4 class="slide__title">{{ slides[current].title }}</h4>
					<p class="slide__description">{{ slides[current].description }}</p>
				</figcaption>
			</figure>
		</transition>
		<div class="slider__controls">
			<span class="slider__pagination">{{ current + 1 }} / {{ slidesLength }}</span>
			<button type="button" class="pg-btn pg-btn--primary" aria-label="Next slide" @click="slide(1)">
				Next
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
			</button>
		</div>
	</div>
</template>

<script>
module.exports = {
	props: {
		slides: {
			type: Array,
			default: () => [],
		},
	},
	data() {
		return {
			current: 0,
		};
	},
	computed: {
		slidesLength() {
			return this.slides.length;
		}
	},
	methods: {
		slide(dir) {
			this.current = (this.current + (dir % this.slidesLength) + this.slidesLength) % this.slidesLength;
		},
	},
};
</script>

<style>
/* One slide at a time, in the flow of the dialog: the picture in a frame of fixed proportions
   and the words under it, so neither the dialog nor the controls jump as the slides change. */
.app-slider {
	display: flex;
	flex-direction: column;
	gap: 16px;
}

.app-slider .slide {
	display: flex;
	flex-direction: column;
	gap: 14px;
	margin: 0;
}

/* the pictures are screenshots on white, so they keep a white frame in either theme */
.app-slider .slide__frame {
	display: flex;
	align-items: center;
	justify-content: center;
	aspect-ratio: 16 / 10;
	padding: 8px;
	background-color: #ffffff;
	border: 1px solid var(--border-color);
	border-radius: var(--radius-control);
	overflow: hidden;
}

.app-slider .slide__image {
	display: block;
	max-width: 100%;
	max-height: 100%;
	object-fit: contain;
}

/* room for a title and three lines of description, the longest any slide has */
.app-slider .slide__text {
	display: flex;
	flex-direction: column;
	gap: 6px;
	min-height: 6.5em;
}

.app-slider .slide__title {
	margin: 0;
	font-size: 17px;
	font-weight: 600;
}

.app-slider .slide__description {
	margin: 0;
	color: var(--pg-muted);
}

.slider__controls {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
}

.slider__pagination {
	color: var(--pg-muted);
	font-size: var(--text-small);
	font-variant-numeric: tabular-nums;
}
</style>
