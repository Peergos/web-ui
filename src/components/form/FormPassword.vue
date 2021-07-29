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
		},

	},
	data() {
		return {
			passwordIsVisible: true,
			passwordThreshold: 12,
			passwordUpdate: false
		}
	},

	methods: {
		togglePassword() {
			this.passwordIsVisible = !this.passwordIsVisible
		},

		validatePassword() {
			if (!this.firstOfTwo || this.value == '')
				return

			let passwd = this.value
			let index = CommonPasswords.indexOf(passwd);
			let suffix = ["th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th"][(index+1) % 10];

			if (index != -1) {
				this.$toast.error(`your password is the ${index+1} ${suffix} most common password!`,{ id: 'password', timeout:false });
				this.passwordUpdate = true
			} else if (passwd.length < this.passwordThreshold) {
				this.$toast.error(`passwords less than ${this.passwordThreshold} characters are considered unsafe.`,{ id: 'password', timeout:false });
				this.passwordUpdate = true
			}else{
				if (this.passwordUpdate)
					this.$toast.error(`That's a better password.`,{ id: 'password', timeout:4000 });
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
	background-color: var(--bg);
}
.password__wrapper .eye:focus{
	outline:none;
	background-color: var(--bg-2);
}
</style>