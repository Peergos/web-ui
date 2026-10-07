<template>
	<div class="password__wrapper">
		<input
			class="password"
		        name="password"
			autocomplete="current-password"
                        :placeholder="placeholder"
			:type="visible ? 'text' : 'password'"
			:value="modelValue"
    		@input="$emit('update:modelValue', $event.target.value)"
			@blur="validatePassword()"
		/>

		<AppButton class="eye"
			@click="togglePassword()"
			:icon="visible ? 'eye-open' : 'eye-closed'"
		/>

	</div>
</template>

<script>
const AppButton = require("../AppButton.vue");
const CommonPasswords = require('../../mixins/password/passwords.json');
const i18n = require("../../i18n/index.js");

module.exports = {
	components: {
	    AppButton,
	},
    emits: ['update:modelValue'],
    props: {
	modelValue:{
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
        passwordIsVisible:{
            type:Boolean,
            default:false
        },
    },
    data() {
	return {
	    passwordThreshold: 12,
	    passwordUpdate: false,
	    // a copy, as props can't be written to: the toggle flips this, and the parent can still reveal it
	    visible: this.passwordIsVisible
	}
    },
    watch: {
	passwordIsVisible(v) {
	    this.visible = v
	}
    },

    mixins:[i18n],
    methods: {
	togglePassword() {
	    this.visible = !this.visible
	},
        
	validatePassword() {
	    if (!this.firstOfTwo || this.modelValue == '')
		return
            
	    let passwd = this.modelValue
	    let index = CommonPasswords.indexOf(passwd);
	    let suffix = ["th", "st", "nd", "rd", "th", "th", "th", "th", "th", "th"][(index+1) % 10];
            
	    if (index != -1) {
		this.$toast.error(this.translate("PASSWORD.COMMON").replace("$PLACE", (index+1) + suffix),{ id: 'password', timeout:false });
		this.passwordUpdate = true
	    } else if (passwd.length < this.passwordThreshold) {
		this.$toast.error(this.translate("PASSWORD.SHORT").replace("$SIZE", this.passwordThreshold),{ id: 'password', timeout:false });
		this.passwordUpdate = true
	    }else{
		if (this.passwordUpdate)
		    this.$toast.error(this.translate("PASSWORD.GOOD"),{ id: 'password', timeout:4000 });
	    }
	}
    },
}
</script>

<style>
.password__wrapper {
	margin: 8px 0;
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
