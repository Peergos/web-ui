<template>
	<svg class="icon" :class="{ 'icon--flip': flip }">
		<use :xlink:href="`#${icon}`" />
	</svg>
</template>

<script>
// export default {
module.exports = {
	name: "AppIcon",
	props: {
		icon: {
			type: String,
			required: true,
		},
		flip: {
			type: Boolean,
			default: false,
		},
	},
};
</script>

<style>
svg.icon {
	fill: currentColor;
	height: 32px;
	margin-bottom: 0.125em;
	vertical-align: middle;
	width: 32px;
}

svg.icon .icon--flip {
	transform: scaleX(-1);
}
</style>