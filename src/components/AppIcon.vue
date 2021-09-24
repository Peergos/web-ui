<template>
	<svg class="icon" :class="{ 'icon--flip': flip }" :width="width" :height="height">
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
		width:{
			type: Number,
			default: 32,
		},
		height:{
			type: Number,
			default: 32,
		}
	},
};
</script>

<style>
svg.icon {
	display: inline-block;
	fill: currentColor;
	vertical-align: middle;
}

svg.icon .icon--flip {
	transform: scaleX(-1);
}
</style>