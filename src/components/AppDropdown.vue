
<template>
	<div class="app-dropdown"
		@focusin="expanded(true)"
    	@focusout="expanded(false)"
	>
		<AppButton
			:type="type"
			:accent="accent"
			:area-expanded="isActive"
			:icon="icon"
			@click.native="expanded(true)"
		>
			<slot name="trigger"></slot>
		</AppButton>
		<transition name="drop">
			<div v-if="isActive"
				class="dropdown__content"
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
		expanded(value){
			// close on focus-out
			// https://codepen.io/autumnwoodberry/pen/NvjJWm
			this.isActive = value
		}

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

.app-dropdown .dropdown__content {

	position: absolute;
	top: calc(100% + 8px);
	left: 0;

	/* padding: 16px; */
	min-width: 200px;
	border-radius: 4px;
	color: var(--color);
	background-color:var(--bg);
	box-shadow: 0 6px 16px rgba(0,0,0,0.15);
}
.app-dropdown ul {
	list-style: none;
	padding-left: 0;
	margin: 0;
}
.app-dropdown li {
	padding: 8px  16px;
	cursor: pointer;
	font-size: var(--text-small);
	transition: background-color 0.5s;
}
.app-dropdown li:hover {
	background-color: var(--bg-2);
}
.app-dropdown li:hover a{
	color: var(--color);
	text-decoration: none;
}
.app-dropdown li.divider{
	border-top: 1px solid var(--border-color);
	height: 1px;
	padding: 0;
}

.drop-enter-active, .drop-leave-active  {
  transition: all 0.2s ease-out;
}

.drop-enter, .drop-leave-to {
	opacity: 0;
	transform: translateY(-10px)
}
</style>