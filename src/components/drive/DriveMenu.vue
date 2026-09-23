<template>
	<transition name="drop">
		<nav
			class="drive-menu pg-menu"
			:class="{'mobile' : isMobile}"
			tabindex="0"
			@focusout="$emit('closeMenu')"
			@keydown.esc="$emit('closeMenu')"
			:style="menuPosition"
		>
			<ul>
				<slot />
			</ul>
		</nav>
	</transition>
</template>

<script>
module.exports = {
	data() {
		return {
			menuHeight: 0,
		}
	},
	mounted() {
		this.measure()
	},
	updated() {
		this.measure()
	},
	methods: {
		// the height is only known once rendered, and items come and go with the selection
		measure() {
			const height = this.$el.offsetHeight
			if (height != this.menuHeight)
				this.menuHeight = height
		}
	},
	computed: {
		...Vuex.mapState([
			'driveMenuTarget',
			'windowWidth'
		]),
		isMobile(){
			return this.windowWidth < 1024
		},
		menuPosition(){
			if(!this.isMobile){

				const target = this.driveMenuTarget.getBoundingClientRect();

				let maxWidth = this.windowWidth - 290;
				let xPos = target.left
				let yPos = target.top + window.scrollY

				if(xPos >maxWidth){
					xPos = maxWidth
				}
				const margin = 8
				const maxBottom = window.scrollY + window.innerHeight - margin
				if (yPos + this.menuHeight > maxBottom) {
					yPos = Math.max(window.scrollY + margin, maxBottom - this.menuHeight)
				}
				return `left: ${xPos}px; top: ${yPos}px;`
			}
		}

	}
}
</script>

<style>
/* The surface is .pg-menu in 2_status-cards.css. What is particular to this menu
   is where it sits: placed against the button that opened it on a desktop, and a
   sheet across the bottom of the screen on a phone. */
.drive-menu {
	display: block;
	position: absolute;
	z-index: 100;
	width: 250px;
	max-height: calc(100vh - 16px);
	overflow-y: auto;
}

.drive-menu:focus-visible {
	outline: 2px solid var(--green-500);
	outline-offset: 2px;
}

.drive-menu.mobile {
	position: sticky;
	bottom: 0;
	width: 100%;
	max-height: 60vh;
	padding: 8px 8px 12px;
	border: 0;
	border-top: 1px solid var(--border-color);
	border-radius: var(--radius-container) var(--radius-container) 0 0;
	box-shadow: var(--pg-shadow-sheet);
}

/* a finger needs more than a mouse, as .pg-btn already allows for. The rule that
   draws a divider as a line is no taller than a line, so it stays out of this */
.drive-menu.mobile li:not(.divider) {
	min-height: 48px;
	padding: 12px 16px;
	font-size: 15px;
}
</style>
