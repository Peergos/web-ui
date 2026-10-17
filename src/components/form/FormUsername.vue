<template>
	<input
		ref="field"
		class="pg-input"
		type="text"
		name="username"
		:autocomplete="autocomplete"
		:value="modelValue"
		:placeholder="placeholder"
		:aria-label="placeholder"
		@input="changed($event)"
	/>
</template>

<script>
// A Peergos username, as the sign-in, mirror and sign-up forms take it: in lower case however it is typed or
// pasted, with the focus on it when the form opens.
module.exports = {
	emits: ['update:modelValue'],
	props: {
		modelValue: {
			type: String,
			default: ''
		},
		placeholder: {
			type: String,
			default: ''
		},
		autocomplete: {
			type: String,
			default: null
		},
	},
	mounted() {
		this.$refs.field.focus();
	},
	methods: {
		// written back to the field as well: when it lowers to the value the form already has, nothing re-renders
		changed(event) {
			let lower = event.target.value.toLowerCase();
			if (event.target.value !== lower)
				event.target.value = lower;
			this.$emit('update:modelValue', lower);
		},
	},
};
</script>
