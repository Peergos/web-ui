<template>
	<transition name="drop">
		<nav
			class="app-grid-menu"
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
			'launcherMenuTarget',
			'windowWidth'
		]),
		isMobile(){
			return this.windowWidth < 1024
		},
		focus() {
		    console.log('focusing');
		},
		menuPosition(){
			if(!this.isMobile){

				const target = this.launcherMenuTarget.getBoundingClientRect();

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
.app-grid-menu {
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
/* .app-grid-menu:focus {
} */

.app-grid-menu ul {
	list-style: none;
	margin: 0;
	padding: 0;
}

.app-grid-menu li {
	margin: 0;
	padding: 8px 16px;
	cursor: pointer;
}

.app-grid-menu li:hover {
	background-color: var(--bg-2);
}

.app-grid-menu.mobile{
	position: sticky;
	bottom:0px;
	width:100%;
}
.app-grid-menu.mobile ul li{
	padding: 16px var(--app-margin);
}
</style>