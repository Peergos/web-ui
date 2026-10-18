<template>
	<ul class="pg-plans">
		<li class="pg-plan" v-for="plan in plans" :key="plan.name">
			<h3>{{ plan.name }} Account</h3>
			<ul>
				<li>{{ plan.gb }} GB {{ translate("SIGNUP.HYPER") }}</li>
				<li>{{ translate("SIGNUP.BUNDLED") }}</li>
				<li>&#x00A3;{{ planPrice(plan, annual) }}</li>
			</ul>
			<button type="button" class="pg-btn pg-btn--primary" @click="$emit('choose', plan.bytes)">Select {{ plan.name }}</button>
		</li>
		<slot></slot>
	</ul>
</template>

<script>
const i18n = require("../../i18n/index.js");
const plans = require("../../mixins/plans/index.js");

// The plans to choose from on the way in, by sign up or mirror: one of them chosen sends its size in bytes. Anything
// else to offer beside them goes in the slot, as a .pg-plan of its own.
module.exports = {
	emits: ['choose'],
	mixins: [i18n, plans],
	props: {
		annual: {
			type: Boolean,
			default: false
		},
	},
};
</script>
