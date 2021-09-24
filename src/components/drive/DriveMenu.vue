<template>
	<transition name="drop">
		<nav
			class="drive-menu"
			:class="{'mobile' : isMobile}"
			tabindex="0"
			@focusout="$emit('closeMenu')"
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
.drive-menu {
	display: block;
	position: absolute;
	z-index: 100;
	width: 250px;
	color: var(--color);
	background-color: var(--bg);
	box-shadow: 0 6px 16px rgba(0, 0, 0, 0.15);
	border-radius: 4px;
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

.drive-menu.mobile{
	position: sticky;
	bottom:0px;
	width:100%;
}
.drive-menu.mobile ul li{
	padding: 16px var(--app-margin);
}
</style>