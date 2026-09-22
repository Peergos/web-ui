
<template>
	<div class="app-dropdown"
		@focusout="close()"
		@keydown.esc="close()"
        tabindex="-1"
	>
		<AppButton
			:type="type"
			:accent="accent"
			:area-expanded="isActive"
			:icon="icon"
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
		};
	},
	methods: {
		// The trigger opens it, and nothing else does. Focus arriving here must not: a modal
		// opened from one of these items takes focus, and whatever the browser does with focus
		// when that modal closes - restoring it to the trigger, on a web view - would otherwise
		// reopen the menu behind it.
		toggle(){
			this.isActive = ! this.isActive;
		},
		// focus leaving the menu, or escape, puts it away
		close(){
			this.isActive = false;
		},
		// and choosing something in it closes it, then hands focus back out so the menu is
		// not left holding it
		closeMenu(){
			this.close();
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