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
