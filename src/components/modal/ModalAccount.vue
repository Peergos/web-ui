<template>
	<AppModal>
		<template #header>
			<h2>Delete Account</h2>
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
			<p>If you choose to proceed you will lose access to your account and data!</p>
            <p>This action is not reversible</p>
            <p>You must enter your password to confirm you want to delete your account and all your data</p>

			<FormPassword v-model="password" />

			<div class="modal__warning account" v-if="warning">
				<p><AppIcon icon="warning"/> Are you absolutely sure you want to delete your account?</p>
				<AppButton @click.native="deleteAccount()" accent >Yes, delete everything</AppButton>
				<AppButton @click.native="warning=false">Nevermind</AppButton>
			</div>

		</template>
		<template #footer>

			 <AppButton @click.native="showWarning()" type="primary" block accent>Delete account</AppButton>

		</template>
	</AppModal>
</template>

<script>
import AppButton from "../AppButton.vue";
import AppModal from "./AppModal.vue";
import AppIcon from "../AppIcon.vue";
import FormPassword from "../form/FormPassword.vue";
import MultiFactorAuth from "../auth/MultiFactorAuth.vue";

export default {
	components: {
	    AppButton,
	    AppModal,
	    AppIcon,
		FormPassword,
		MultiFactorAuth,
	},
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
				this.$toast.error('Password must be populated!',{timeout:false, position: 'bottom-left' })
			} else {
				this.warning = true
			}
		},

		deleteAccount() {
            console.log("Deleting Account");
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
					that.$toast('Account Deleted!',{position: 'bottom-left' })
					that.$store.commit("SET_MODAL", false);
                	that.exit()
                } else {
					that.$toast(`Error Deleting Account: ${throwable.getMessage()}`,{position: 'bottom-left' })
                }
            }).exceptionally(function(throwable) {
                if (throwable.getMessage().startsWith('Invalid+TOTP+code')) {
                    that.$toast.error('Invalid Multi Factor Authenticator code', {timeout:false})
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
