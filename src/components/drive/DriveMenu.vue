<template>
	<transition name="drop">
		<nav
			class="drive-menu"
			:class="{'mobile' : isMobile}"
			tabindex="0"
			@focusout="$emit('closeMenu')"
			:style="menuPosition"
		>
			<ul id="right-click-menu">
				<slot />
			</ul>
		</nav>
	</transition>
</template>

<script>
module.exports = {
	data() {
		return {
			isMobile: false
		}
	},
	computed: {
		...Vuex.mapState({
			position : 'driveMenuPosition',
		}),

		menuPosition(){
			if(!this.isMobile){
				let largestWidth = window.innerWidth - 290;
				let xPos = this.position.x
				let yPos = this.position.y + window.scrollY

				if(xPos >largestWidth){
					xPos = largestWidth
				}
				return `left: ${xPos}px; top: ${yPos}px;`
			}

		}
	},
}
</script>

<style>
.drive-menu {
	display: block;
	position: absolute;
	z-index: 100;
	width: 250px;
	color: var(--color);
	background-color: var(--bg);
	box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
	border-radius: 6px;
	overflow: hidden;
}

nav.drive-menu.mobile{
	position: sticky;
	bottom:0px;
	width:100%;
}
/* .drive-menu:focus {
} */

.drive-menu ul {
	list-style: none;
	margin: 0;
	padding: 0;
}

.drive-menu li {
	margin: 0;
	padding: 8px 16px;
	cursor: pointer;
}

.drive-menu li:hover {
	background-color: var(--bg-2);
}
</style>