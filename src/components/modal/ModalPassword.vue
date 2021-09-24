<template>
	<AppModal>
		<template #header>
			<h2>Change password</h2>
		</template>
		<template #body>
            <spinner v-if="showSpinner"></spinner>

			<FormPassword v-model="existing" />

			<AppButton class="generate-password" type="primary" block accent @click.native="generatePassword()">
				Generate password
			</AppButton>

			<FormPassword v-model="password" :passwordIsVisible="showPasswords" firstOfTwo />

			<FormPassword v-model="password2" :passwordIsVisible="showPasswords"/>

		</template>
		<template #footer>

			 <AppButton  @click.native="updatePassword()" type="primary" block accent>Change password</AppButton>

		</template>
	</AppModal>
</template>

<script>
const Bip39 = require('../../mixins/password/bip-0039-english.json');
const FormPassword = require("../form/FormPassword.vue");
module.exports = {
    components: {
	FormPassword,
    },
    
    data() {
        return {
        showSpinner: false,
	    existing: "",
	    password: "",
	    password2: "",
            showPasswords: false
        };
    },
    
    computed: {
	...Vuex.mapState([
	    'context'
	]),
    },
    
    methods: {
	generatePassword() {
	    let bytes = nacl.randomBytes(16);
	    let wordIndices = [];
	    for (var i=0; i < 7; i++)
		wordIndices[i] = bytes[2*i]*8 + (bytes[2*i + 1] & 7);
	    let password = wordIndices.map(j => Bip39[j]).join("-");
	    this.password = password;
            this.showPasswords = true;
        },
        
	updatePassword() {
            if(this.existing.length == 0 || this.password.length == 0 || this.password2.length == 0) {
		this.$toast.error('All fields must be populated!',{timeout:false, position: 'bottom-left' })
            } else {
                if (this.password == this.password2) {
                    let that = this;
                    this.showSpinner = true;
                    this.context.changePassword(this.existing, this.password).thenApply(function(newContext){
                        
			that.$store.commit("SET_CONTEXT", newContext);
			that.$store.commit("SET_MODAL", false);
			that.$toast.info('Password changed')
            that.showSpinner = false;
		    }).exceptionally(function(throwable) {
            that.showSpinner = false;
			// that.$toast.error(throwable.getMessage())
			console.log(throwable.getMessage())
             	    });
                    
		} else {
		    this.$toast.error('Passwords do not match',{timeout:false, position: 'bottom-left' })
                }
            }
        },
    },
};
</script>
<style>

</style>
