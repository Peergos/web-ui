
<template>
	<div class="app-dropdown"
		@focusin="expanded(true)"
    	@focusout="expanded(false)"
		@keydown.esc="expanded(false)"
        tabindex="-1"
	>
		<AppButton
			:type="type"
			:accent="accent"
			:area-expanded="isActive"
			:icon="icon"
			@mousedown.native="remember()"
			@keydown.native="remember()"
			@click.native="toggle()"
		>
			<slot name="trigger"></slot>
		</AppButton>
		<transition name="drop">
			<div v-if="isActive"
				class="dropdown__content pg-menu"
                                @mousedown.prevent
                                @click="closeMenu"
			>
				<slot />
			</div>
		</transition>
	</div>
</template>

<script>
const AppButton = require("AppButton.vue");

module.exports = {
    components: {
        AppButton,
    },
	props: {
		icon: {
			type: String,
			default: "",
		},
		type: {
			type: String,
			default: "",
		},
		accent:{
			type: Boolean,
			default:false,
		}
	},
	data() {
		return {
			isActive: false,
			// whether the menu was already open when the pointer went down
			wasOpen: false,
		};
	},
	methods: {
		// focusin opens the menu before the click on the trigger arrives, so isActive
		// is already true by then. This runs before focus moves, so it catches the
		// state the click is actually toggling.
		remember(){
			this.wasOpen = this.isActive;
		},
		toggle(){
			// focus stays on the trigger, so focusin does not fire again and reopen it
			this.isActive = ! this.wasOpen;
			this.wasOpen = false;
		},
		expanded(value){
			// close on focus-out
			// https://codepen.io/autumnwoodberry/pen/NvjJWm
			this.isActive = value
	        },        
                closeMenu(){
                    this.isActive = false;
                    this.$el.blur();
                },

	},
};
</script>

<style>
.app-dropdown {
	position: relative;
	z-index:100;
	line-height: 32px;
	border-radius: 4px;
}

/* the surface is .pg-menu in 2_status-cards.css; this is only where it opens */
.app-dropdown .dropdown__content {
	position: absolute;
	top: calc(100% + 8px);
	left: 0;
	min-width: 220px;
}
.app-dropdown li:hover a{
	color: var(--color);
	text-decoration: none;
}

.drop-enter-active, .drop-leave-active  {
  transition: all 0.2s ease-out;
}

.drop-enter, .drop-leave-to {
	opacity: 0;
	transform: translateY(-10px)
}
</style>