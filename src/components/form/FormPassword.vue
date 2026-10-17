<template>
	<div class="password__wrapper">
		<input
			class="password"
		        name="password"
			:autocomplete="autocomplete"
                        :placeholder="placeholder"
			:type="visible ? 'text' : 'password'"
			:value="modelValue"
    		@input="$emit('update:modelValue', $event.target.value)"
			@blur="validatePassword()"
		/>

		<AppButton class="eye"
			:aria-label="translate('PASSWORD.SHOW')"
			:aria-pressed="visible ? 'true' : 'false'"
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
        // new-password where an account is being made, so a password manager offers to save it rather than to fill
        // in one it has
        autocomplete:{
            type:String,
            default:'current-password'
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

/* in a dialog, and on the way in, the field matches the other fields there, with the eye inside
   its right edge */
.pg-dialog .password__wrapper,
.pg-auth .password__wrapper {
	margin: 0;
}
.pg-dialog .password__wrapper input,
.pg-auth .password__wrapper input {
	width: 100%;
	height: 44px;
	margin: 0;
	padding: 0 48px 0 12px;
	border: 1px solid var(--pg-track);
	border-radius: var(--radius-field);
	background-color: var(--pg-surface-2);
	color: var(--color);
	font-family: inherit;
	font-size: 15px;
}
.pg-dialog .password__wrapper input:focus,
.pg-auth .password__wrapper input:focus {
	outline: none;
	border-color: var(--green-500);
	box-shadow: 0 0 0 3px var(--pg-tint-ok);
}
/* a saved password the browser filled in keeps the field's colour, as input.pg-input does */
.pg-dialog .password__wrapper input:-webkit-autofill,
.pg-auth .password__wrapper input:-webkit-autofill {
	background-clip: padding-box;
	box-shadow: 0 0 0 30px var(--pg-surface-2) inset;
	caret-color: var(--color);
}
.pg-dialog .password__wrapper input:-webkit-autofill:focus,
.pg-auth .password__wrapper input:-webkit-autofill:focus {
	box-shadow: 0 0 0 30px var(--pg-surface-2) inset, 0 0 0 3px var(--pg-tint-ok);
}
.pg-dialog .password__wrapper .eye,
.pg-auth .password__wrapper .eye {
	top: 50%;
	right: 4px;
	transform: translateY(-50%);
	background-color: transparent;
}
</style>
