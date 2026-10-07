<template>
	<transition mode="out-in">
		<div class="tab" v-if="isActive">
			<slot></slot>
		</div>
	</transition>
</template>

<script>
module.exports = {
	inject: ["registerTab", "unregisterTab"],
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
		this.registerTab(this);
	},
	beforeUnmount() {
		this.unregisterTab(this);
	},
};
</script>

<style></style>
