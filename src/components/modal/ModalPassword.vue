<template>
	<AppModal>
		<template #header>
			<h2>Change password</h2>
		</template>
		<template #body>
            <Spinner v-if="showSpinner"></Spinner>
            <MultiFactorAuth
                    v-if="showMultiFactorAuth"
                    v-on:hide-confirm="showMultiFactorAuth = false"
                    :mfaMethods="mfaMethods"
                    :consumer_cancel_func="consumer_cancel_func"
                    :consumer_func="consumer_func">
            </MultiFactorAuth>
			<FormPassword v-model="existing" :placeholder="'Existing password'"/>

			<AppButton class="generate-password" type="primary" block accent @click.native="generatePassword()">
				Generate password
			</AppButton>

			<FormPassword v-model="password"  placeholder="New password" :passwordIsVisible="showPasswords" firstOfTwo />

			<FormPassword v-model="password2" placeholder="Re-enter new password" :passwordIsVisible="showPasswords"/>

		</template>
		<template #footer>

			 <AppButton  @click.native="updatePassword()" type="primary" block accent>Change password</AppButton>

		</template>
	</AppModal>
</template>

<script>
const AppButton = require("../AppButton.vue");
const AppModal = require("AppModal.vue");
const UriDecoder = require('../../mixins/uridecoder/index.js');
const Bip39 = require('../../mixins/password/bip-0039-english.json');
const FormPassword = require("../form/FormPassword.vue");
const MultiFactorAuth = require("../auth/MultiFactorAuth.vue");
const Spinner = require("../spinner/Spinner.vue");

module.exports = {
    components: {
        AppButton,
        AppModal,
	    FormPassword,
	    MultiFactorAuth,
        Spinner,
    },
    
    data() {
        return {
            showSpinner: false,
            existing: "",
            password: "",
            password2: "",
            showPasswords: false,
            showMultiFactorAuth: false,
        };
    },
    
    computed: {
	...Vuex.mapState([
	    'context'
	]),
    },
    mixins:[UriDecoder],
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
                let mfa = function(mfaReq) {
                    console.log('inside deleteAccount mfa');
                    return null;
                };
                let handleMfa = function(mfaReq) {
                        console.log('inside signIn mfa');
                        let future = peergos.shared.util.Futures.incomplete();
                        let mfaMethods = mfaReq.methods.toArray([]);
                        that.mfaMethods = mfaMethods;
                        that.consumer_func = (credentialId, authCode) => {
                            that.showMultiFactorAuth = false;
                            let resp = peergos.client.JsUtil.generateAuthResponse(credentialId, authCode);
                            future.complete(resp);
                        };
                        that.consumer_cancel_func = (credentialId) => {
                            that.showMultiFactorAuth = false;
                            let resp = peergos.client.JsUtil.generateAuthResponse(credentialId, '');
                            future.complete(resp);
                        }
                        that.showMultiFactorAuth = true;
                        return future;
                };
                this.context.changePassword(this.existing, this.password, mfaReq => handleMfa(mfaReq)).thenApply(function(newContext){
                    that.$store.commit("SET_CONTEXT", newContext);
                    that.$store.commit("SET_MODAL", false);
                    that.$toast.info('Password changed')
                    that.showSpinner = false;
                }).exceptionally(function(throwable) {
                    that.showSpinner = false;
                    that.$toast.error(that.uriDecode(throwable.getMessage()),{timeout:false})
                    console.log(throwable.getMessage())
                });
            } else {
                this.$toast.error('Passwords do not match',{timeout:false})
            }
        }
    },
    },
};
</script>
<style>

</style>
