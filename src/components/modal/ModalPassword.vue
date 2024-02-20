<template>
	<AppModal>
		<template #header>
			<h2>{{ translate("PASSWORD.CHANGE") }}</h2>
		</template>
		<template #body>
            <Spinner v-if="showSpinner"></Spinner>
            <MultiFactorAuth
                    v-if="showMultiFactorAuth"
                    v-on:hide-confirm="showMultiFactorAuth = false"
                    :mfaMethods="mfaMethods"
                    :challenge="challenge"
                    :consumer_cancel_func="consumer_cancel_func"
                    :consumer_func="consumer_func">
            </MultiFactorAuth>
			<FormPassword v-model="existing" :placeholder="translate('PASSWORD.EXISTING')"/>

			<AppButton class="generate-password" type="primary" block accent @click.native="generatePassword()">
				{{ translate("PASSWORD.GENERATE") }}
			</AppButton>

			<FormPassword v-model="password" :placeholder="translate('PASSWORD.NEW')" :passwordIsVisible="showPasswords" firstOfTwo />

			<FormPassword v-model="password2" :placeholder="translate('PASSWORD.REENTER')" :passwordIsVisible="showPasswords"/>

		</template>
		<template #footer>

			 <AppButton  @click.native="updatePassword()" type="primary" block accent>{{ translate("PASSWORD.CHANGE") }}</AppButton>

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
const i18n = require("../../i18n/index.js");

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
    mixins:[UriDecoder, i18n],
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
            this.$toast.error(this.translate("PASSWORD.FIELDS"),{timeout:false, position: 'bottom-left' })
        } else {
            if (this.password == this.password2) {
                let that = this;
                this.showSpinner = true;
                let handleMfa = function(mfaReq) {
                        let future = peergos.shared.util.Futures.incomplete();
                        let mfaMethods = mfaReq.methods.toArray([]);
                        that.challenge = mfaReq.challenge;
                        that.mfaMethods = mfaMethods;
                        that.consumer_func = (credentialId, resp) => {
                            that.showMultiFactorAuth = false;
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
                    that.$toast.info(that.translate("PASSWORD.CHANGED"))
                    that.showSpinner = false;
                }).exceptionally(function(throwable) {
                    if (throwable.getMessage().startsWith('Invalid+TOTP+code')) {
                        that.$toast.error(that.translate("PASSWORDS.MFA"), {timeout:false})
                    } else {
                        that.$toast.error(that.uriDecode(throwable.getMessage()), {timeout:false})
                    }
                    that.showSpinner = false;
                    console.log(throwable.getMessage())
                });
            } else {
                this.$toast.error(this.translate("PASSWORDS.MATCH"),{timeout:false})
            }
        }
    },
    },
};
</script>
<style>

</style>
