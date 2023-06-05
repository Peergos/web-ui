<template>
	<div class="app-slider">
		<transition-group
			tag="div"
			:name="transitionName"
			class="slider__container"
		>
			<div
				v-if="show"
				:key="current"
				class="slide"
			>
				<img
					v-if="slides[current].image"
					:src="slides[current].image"
					:alt="slides[current].title"
					class="slide__image"
				/>
				<h2 class="slide__title">
					{{ slides[current].title }}
				</h2>
				<p class="slide__description">
					{{ slides[current].description }}
				</p>
			</div>
		</transition-group>
		<span class="slider__pagination">
			{{ current + 1 }} / {{ slidesLength }}
		</span>
		<!-- <AppButton
			class="slider__button button--prev"
			aria-label="Previous slide"
			@click.native="slide(-1)"
			icon="arrow-right"
		>
		</AppButton> -->
		<AppButton
			class="slider__button button--next"
			aria-label="Next slide"
			@click.native="slide(1)"
			icon="arrow-right"
			accent
		>
			next
		</AppButton>
	</div>
</template>

<script>
const AppButton = require("../AppButton.vue");

module.exports = {
    components: {
        AppButton,
    },
	props: {
		slides: {
			type: Array,
			default: () => [],
		},
	},
	data() {
		return {
			current: 0,
			direction: 1,
			transitionName: "fade",
			show: false,
		};
	},
	computed: {
		slidesLength() {
			return this.slides.length;
		}
	},
	methods: {
		slide(dir) {
			this.direction = dir;
			// dir === 1
			// 	? (this.transitionName = "slide-next")
			// 	: (this.transitionName = "slide-prev");
			this.current = (this.current + (dir % this.slidesLength) + this.slidesLength) % this.slidesLength;
		},
	},
	mounted() {
		this.show = true;
	},
};
</script>

<style>
.app-slider {
	position: relative;
}
.slider__container {
	min-width: 420px;
	min-height: 420px;
}
.app-slider .slide {
	position: absolute;
	top:0;
	left: 0;
	width: 100%;
	display: flex;
	flex-direction: column;

}

.app-slider .slide__image {
	width: 100%;
	height: auto;
}


.slider__button {
	transition: transform 0.3s ease-in-out;
	user-select: none;
}

.slider__button.button--next {
	position: absolute;
	right:0;
}

.slider__button--prev svg{
	transform: rotate(180deg);
}


.slider__pagination{
	line-height: 36px;
}

/* Next Slide */
.slide-next-enter-active,
.slide-next-leave-active {
	transition: transform 0.5s ease-in-out;
}
.slide-next-enter {
	transform: translate(100%);
}
.slide-next-leave-to {
	transform: translate(-100%);
}

/* Prev slide */
.slide-prev-enter-active,
.slide-prev-leave-active {
	transition: transform 0.5s ease-in-out;
}
.slide-prev-enter {
	transform: translate(-100%);
}
.slide-prev-leave-to {
	transform: translate(100%);
}

@media (max-width: 540px) {

	.slider__container {
		min-width: 320px;
		min-height: 420px;
	}
}

</style>
