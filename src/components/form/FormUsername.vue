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
		// Written back to the field as well, since when it lowers to the value the form already has nothing re-renders,
		// and with the caret put back where it was: setting the value moves it to the end, so a capital typed in the
		// middle of a name would send the rest of the typing there.
		changed(event) {
			let field = event.target, lower = field.value.toLowerCase();
			if (field.value !== lower) {
				let start = field.selectionStart, end = field.selectionEnd;
				field.value = lower;
				field.setSelectionRange(start, end);
			}
			this.$emit('update:modelValue', lower);
		},
	},
};
</script>
