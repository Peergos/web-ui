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
	created() {
		this.$parent.tabs.push(this);
	},
};
</script>

<style></style>
