<template>
	<transition mode="out-in">
		<div class="tab" v-if="isActive">
			<slot></slot>
		</div>
	</transition>
</template>

<script>
export default {
	props: {
		title: {
			type: String,
			default: "Tab",
		},
	},
	data() {
		return {
			isActive: false,
		};
	},
};
</script>

<style></style>
