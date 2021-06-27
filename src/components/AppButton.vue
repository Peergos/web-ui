<template>
	<component
		:is="tag"
		:disabled="disabled"
		@click="handleClick"
		class="app-button"
		:class="{
			round: round,
			block: block,
			icon: icon,
			outline: outline,
			[`${size}`]: size,
			[`${type}`]: type,
		}"
	>
		<slot></slot>
	</component>
</template>

<script>

// export default {
module.exports = {
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
			type: Boolean,
			default: false,
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
		handleClick(event) {
			this.$emit("click", event);
		},
	},
};
</script>

<style>
.app-button {
	display: inline-block;
	/* width: auto; */

	border: none;
	border-radius: 4px;

	background-color: transparent;

	margin: 0;
	padding: 8px;

	font-size: var(--text);
	font-family: var(--font-stack);
	font-weight: var(--bold);
	text-align: left;

	color: currentColor;
	cursor: pointer;

	transition: all 0.3s;
}

.app-button:hover {
	color: var(--color-hover);
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

.app-button.large {
	padding: 16px;
}

/* Types */

.app-button.primary {
	background-color: var(--green-accent);
	color: white;
}

.app-button.primary:hover {
	color: white;
	background-color: var(--green-500);
}

@media (max-width: 1024px) {
	.app-button {
		transition: none;
	}
}
</style>
