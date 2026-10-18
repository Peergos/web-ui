<template>
	<div class="pg-segmented" role="radiogroup" aria-label="Billing">
		<label :class="{ active: ! modelValue }"><input type="radio" name="billing" value="monthly" :checked="! modelValue" @change="$emit('update:modelValue', false)">Monthly</label>
		<label :class="{ active: modelValue }"><input type="radio" name="billing" value="yearly" :checked="modelValue" @change="$emit('update:modelValue', true)">Yearly</label>
	</div>
</template>

<script>
// Monthly or yearly, wherever a paid plan is chosen: v-model is true for yearly. The radio buttons are the choice, so
// a click and the arrow keys both make it.
module.exports = {
	emits: ['update:modelValue'],
	props: {
		modelValue: {
			type: Boolean,
			default: false
		},
	},
};
</script>
