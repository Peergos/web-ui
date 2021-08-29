<template>
	<transition name="drop">
		<nav
			class="drive-menu"
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
	props: {
		position:{
			type: Object,
			default: () => ({
				x: 0,
				y: 0
			})
		},
	},
	computed: {
		menuPosition(){

			// console.log(`left: ${Math.round(this.position.x)}px; top: ${Math.round(this.position.y)}px;`)
			return `left: ${this.position.x}px; top: ${this.position.y}px;`
		}
	},
	methods:{
		// setMenu(top, left, menuId) {
		// 	if (this.isNotBackground) {
		// 		this.ignoreEvent = true;
		// 	}

		// 	var menu = document.getElementById(menuId);
		// 	if (menu != null) {
		// 		var largestHeight = window.innerHeight - menu.offsetHeight - 25;
		// 		var largestWidth = window.innerWidth - menu.offsetWidth - 25;

		// 		if (top > largestHeight) top = largestHeight;

		// 		if (left > largestWidth) left = largestWidth;

		// 		this.top = top + 'px';
		// 		this.left = left + 'px';
		// 	}
		// },
	}

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