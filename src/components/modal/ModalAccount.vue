<template>
	<AppModal>
		<template #header>
			<h2>{{ translate("DELETE.ACCOUNT") }}</h2>
		</template>
		<template #body>
            <MultiFactorAuth
                    v-if="showMultiFactorAuth"
                    v-on:hide-confirm="showMultiFactorAuth = false"
                    :mfaMethods="mfaMethods"
                    :challenge="challenge"
                    :consumer_cancel_func="consumer_cancel_func"
                    :consumer_func="consumer_func">
            </MultiFactorAuth>
			<p>{{ translate("DELETE.ACCOUNT.TEXT1") }}</p>
            <p>{{ translate("DELETE.ACCOUNT.TEXT2") }}</p>
            <p>{{ translate("DELETE.ACCOUNT.TEXT3") }}</p>

			<FormPassword v-model="password" />

			<div class="modal__warning account" v-if="warning">
				<p><AppIcon icon="warning"/>{{ translate("DELETE.ACCOUNT.CONFIRM") }}</p>
				<AppButton @click.native="deleteAccount()" accent >{{ translate("DELETE.ACCOUNT.YES") }}</AppButton>
				<AppButton @click.native="warning=false">{{ translate("DELETE.ACCOUNT.CANCEL") }}</AppButton>
			</div>

		</template>
		<template #footer>

			 <AppButton @click.native="showWarning()" type="primary" block accent>{{ translate("DELETE.ACCOUNT") }}</AppButton>

		</template>
	</AppModal>
</template>

<script>
const AppButton = require("../AppButton.vue");
const AppModal = require("AppModal.vue");
const AppIcon = require("../AppIcon.vue");
const FormPassword = require("../form/FormPassword.vue");
const MultiFactorAuth = require("../auth/MultiFactorAuth.vue");
const UriDecoder = require('../../mixins/uridecoder/index.js');
const i18n = require("../../i18n/index.js");

module.exports = {
	components: {
	    AppButton,
	    AppModal,
	    AppIcon,
		FormPassword,
		MultiFactorAuth,
	},
        mixins:[UriDecoder, i18n],
	data() {
		return {
			password: "",
			warning: false,
            showMultiFactorAuth: false,
		};
	},
	computed: {
		...Vuex.mapState([
			'context'
		]),
    },

	methods: {
		showWarning() {
			if(this.password.length == 0) {
				this.$toast.error(that.translate("DELETE.ACCOUNT.PASS"),{timeout:false, position: 'bottom-left' })
			} else {
				this.warning = true
			}
		},

		deleteAccount() {
            var that = this;
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
            this.context.deleteAccount(this.password, mfaReq => handleMfa(mfaReq)).thenApply(function(result){
                if (result) {
					that.$toast(that.translate("DELETE.ACCOUNT.DONE"),{position: 'bottom-left' })
					that.$store.commit("SET_MODAL", false);
                	that.exit()
                } else {
					that.$toast(that.translate("DELETE.ACCOUNT.ERROR")+`: ${throwable.getMessage()}`,{position: 'bottom-left' })
                }
            }).exceptionally(function(throwable) {
                if (throwable.getMessage().startsWith('Invalid+TOTP+code')) {
                    that.$toast.error(that.translate("DELETE.ACCOUNT.MFA"), {timeout:false})
                } else {
                    that.$toast.error(that.uriDecode(throwable.getMessage()), {timeout:false})
                }
                console.log(throwable.getMessage())
            });
        },
		exit(){

			setTimeout(()=>{
				window.location.fragment = "";
				window.location.reload();
			 }, 3000);
		}
	},

};
</script>
<style>
.modal__warning {
	background-color: var(--bg-2);
	border-radius: 4px;
	padding: 16px;
}
.modal__warning.account p {
	margin-bottom: var(--app-margin);
}
</style>
