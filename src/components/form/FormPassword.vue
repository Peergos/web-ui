<template>
	<div class="password__wrapper">
		<input
			class="password"
			name="password"
			:type="passwordIsVisible ? 'text' : 'password'"
			:value="value"
    		@input="$emit('input', $event.target.value)"
			@blur="validatePassword()"
		/>

		<AppButton class="eye" @click="togglePassword()">
			<AppIcon v-show="passwordIsVisible" icon="eye-open"/>
			<AppIcon v-show="!passwordIsVisible" icon="eye-closed"/>
		</AppButton>
	</div>
</template>

<script>
const CommonPasswords = require('../../mixins/password/passwords.json');

module.exports = {
	props: {
		value:{
			type: [String, Array],
		},
		placeholder: {
			type: String,
			default: 'Password'
		},
		firstOfTwo:{
			type:Boolean,
			default:false
		}

	},
	data() {
		return {
			passwordIsVisible: false,
			passwordThreshold: 12,
		}
	},

	methods: {
		togglePassword() {
			this.passwordIsVisible = !this.passwordIsVisible
		},

		validatePassword() {
			// console.log('validatePassword:', this.value)

			if (!this.firstOfTwo)
				return

			let passwd = this.value
			let index = CommonPasswords.indexOf(passwd);
			let suffix = ["th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th"][(index+1) % 10];

			if (index != -1) {
				this.$toast.warning(`your password is the ${index+1} ${suffix} most common password!`, {timeout:false})
			} else if (passwd.length < this.passwordThreshold) {
				this.$toast.warning(`passwords less than ${this.passwordThreshold} characters are considered unsafe.`)
			}
        }
	},
}
</script>

<style>
.password__wrapper {
	margin: 16px 0;
	position: relative;
}
.password__wrapper input{
	padding-right: 50px;
}
.password__wrapper .eye{
	position: absolute;
	right:4px;
	top:14px;
}
.password__wrapper .eye:focus{
	outline:none;
	background-color: var(--bg-2);
}
</style>