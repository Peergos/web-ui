<template>
	<component
		:is="tag"
		:disabled="disabled"
		class="app-button"
		:class="{
			round: round,
			block: block,
			icon: icon,
			outline: outline,
			accent: accent,
			[`${size}`]: size,
			[`${type}`]: type,
		}"
	>
		<slot></slot><AppIcon v-if="icon" :icon="icon"/>
	</component>
</template>

<script>
const AppIcon = require("AppIcon.vue");
module.exports = {
	components: {
	    AppIcon,
	},
	props: {
		tag: {
			type: String,
			default: "button",
		},
		round: {
			type: Boolean,
			default: false,
		},
		icon: {
			type: String,
			default: null,
		},
		block: {
			type: Boolean,
			default: false,
		},
		disabled: {
			type: Boolean,
			default: false,
		},
		outline: {
			type: Boolean,
			default: false,
		},
		accent:{
			type: Boolean,
			default: false,
		},
		type: {
			type: String,
			default: "default",
		},
		size: {
			type: String,
			default: "",
		},
	},
	methods: {
		// handleClick(event) {
		// 	this.$emit("click", event);
		// },
	},
};
</script>

<style>
.app-button {
	display: inline-block;

	margin: 0;
	padding: 8px;

	font-size: var(--text);
	font-family: var(--font-stack);
	font-weight: var(--bold);
	text-align: left;

	color: currentColor;
	background-color: transparent;
	border: 2px solid transparent;
	border-radius: 2px;

	cursor: pointer;

	transition: all 0.3s;
}


.app-button.round {
	border-radius: 64px;
}

.app-button.block {
	width: 100%;
	display: block;
	text-align: center;
}

.app-button.outline {
	background-color: transparent;
	color: currentColor;
	border: 2px solid currentColor;
}

.app-button.icon {
	padding: 4px;
}

.app-button svg {
	width: 24px;
	height: 24px;
}

/* Sizes */

.app-button.small {
	height: 32px;
	padding: 4px;
	font-size: var(--text-small);
}

.app-button.small.icon {
	padding: 0;
}

.app-button:hover {
	color: var(--color-hover) !important;
}
.app-button.accent{
	color: var(--bg) !important;
	background-color: var(--green-500) !important;
}
.app-button.accent:hover {
	color: var(--bg) !important;
	background-color: var(--green-200) !important;
}
.app-button.accent:focus{
	outline:none;
	background-color: var(--color-hover);
}

/* Types */

.app-button.primary {
	line-height: 32px;
	padding: 6px 16px;
	text-align: center;

}

@media (max-width: 1024px) {
	.app-button {
		transition: none;
	}
}
</style>
