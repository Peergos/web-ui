<template>
	<AppModal :title="translate('DELETE.ACCOUNT')">
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
			<label class="app-modal__field">
				<span>{{ translate("DELETE.ACCOUNT.WHY") }}</span>
				<textarea class="pg-input" v-model="feedback" :placeholder="translate('FEEDBACK.BETTER')"></textarea>
			</label>
			<label class="pg-switch app-modal__switch">
				<input type="checkbox" v-model="allowEmailFollowup">
				<span class="pg-switch__track" aria-hidden="true"></span>
				<span>{{ translate("PAID.CANCEL.FOLLOWUP") }}</span>
			</label>
			<FormPassword v-model="password" />
			<div class="pg-callout app-modal__confirm" v-if="warning">
				<p>{{ translate("DELETE.ACCOUNT.CONFIRM") }}</p>
				<div class="app-modal__confirm-actions">
					<button type="button" class="pg-btn" @click="warning=false">{{ translate("DELETE.ACCOUNT.CANCEL") }}</button>
					<button type="button" class="pg-btn pg-btn--danger" @click="deleteAccount()">{{ translate("DELETE.ACCOUNT.YES") }}</button>
				</div>
			</div>
		</template>
		<template #footer>
			<button type="button" class="pg-btn pg-btn--danger" @click="showWarning()">{{ translate("DELETE.ACCOUNT") }}</button>
		</template>
	</AppModal>
</template>

<script>
const AppModal = require("AppModal.vue");
const FormPassword = require("../form/FormPassword.vue");
const MultiFactorAuth = require("../auth/MultiFactorAuth.vue");
const UriDecoder = require('../../mixins/uridecoder/index.js');
const Feedback = require("../../mixins/feedback/index.js");
const i18n = require("../../i18n/index.js");

module.exports = {
	components: {
	    AppModal,
		FormPassword,
		MultiFactorAuth,
	},
        mixins:[UriDecoder, Feedback, i18n],
	data() {
		return {
			password: "",
			warning: false,
            showMultiFactorAuth: false,
            feedback: "",
            allowEmailFollowup: false,
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
            if (this.feedback.length > 0 || this.allowEmailFollowup)
                this.sendUserFeedback(this.context, this.feedback, this.allowEmailFollowup);
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
