<template>
	<transition name="modal" appear>
		<div class="app-prompt app-modal__overlay" @click="close()">

			<div class="app-prompt__container" @click.stop>
				<header class="prompt__header">
					<AppButton class="close" icon="close" @click.native="close()"/>
					<h3>Multi Factor Authentication</h3>
				</header>
				<div v-if="isReady">
    				<div v-if="hasTotp && hasWebauthn && !showTotp">
                                    <div class="mfa_buttons">
                                        <AppButton
					    id='prompt-totpbutton-id'
					    type="primary"
					    accent
					    @click.native="useTotp()"
                                            class="mfa_button"
                                            style="margin:10px;"
					    >
					    Use authenticator app
					</AppButton>
                                        <AppButton
					    id='prompt-webauthn-button-id'
					    type="primary"
					    accent
					    @click.native="confirmWebauthn()"
					    class="mfa_button"
					    style="margin:10px;"
					    >
					    Use security key
					</AppButton>
                                    </div>
                                </div>
                    <div>
                        <center v-if="showTotp">
                            Verification code from app:&nbsp;<input
                                type="text"
                                autofocus
                                name="mfaCode"
                                v-model="mfaCode"
                                placeholder=""
                                style="width:200px"
                                v-on:keyup.enter="confirmTotp"
                            />
                        </center>
                    </div>
                </div>
				<footer class="mfa_login">
				    <AppButton
                                        v-if="showTotp"
					id='prompt-button-id'
					type="primary"
					accent
					@click.native="confirmTotp()"
					>
					Confirm
				    </AppButton>
				</footer>
			</div>
		</div>
	</transition>
</template>
<script>
const AppButton = require("../AppButton.vue");
module.exports = {
    components: {
        AppButton,
    },
    data: function() {
        return {
            mfaCode: '',
            mfaOptions: [],
            webauthnMethods: [],
            hasTotp: false,
            hasWebauthn: false,
            showTotp: false,
            totpIndex: 0,
            isReady: false,
        }
    },
    props: ['mfaMethods', 'challenge', 'consumer_cancel_func', 'consumer_func'],
    computed: {
        ...Vuex.mapState([
            'context'
        ]),
    },
    created: function() {
        let that = this;
        for (var i=0; i < this.mfaMethods.length;i++) {
            let method = this.mfaMethods[i];
            if (method.type.toString() == peergos.shared.login.mfa.MultiFactorAuthMethod.Type.TOTP.toString()) {
                that.mfaOptions.push({type:'Authenticator App', credentialId: method.credentialId});
                this.hasTotp = true;
                this.totpIndex = i;
            } else {
                that.mfaOptions.push({type:'WebKey', credentialId: new Uint8Array(method.credentialId), name: method.name});
                this.hasWebauthn = true;
                that.webauthnMethods.push({
                    type: "public-key",
                    id: new Uint8Array(method.credentialId)
                });
            }
        }
        this.isReady = true;
        if (this.hasWebauthn && ! this.hasTotp) {
            this.confirmWebauthn();
        }
        if (! this.hasWebauthn && this.hasTotp)
            this.showTotp= true;
    },
    methods: {
        close: function() {
            let credentialId = this.mfaOptions[this.totpIndex].credentialId;
            this.consumer_cancel_func(credentialId);
        },
        useTotp: function() {
            this.showTotp = true;
        },
        confirmTotp: function() {
            let credentialId = this.mfaOptions[this.totpIndex].credentialId;
            let resp = peergos.client.JsUtil.generateAuthResponse(credentialId, this.mfaCode);
            this.consumer_func(credentialId, resp);
        },
        confirmWebauthn: function() {
           let that = this;
           let allow = [];
           this.webauthnMethods.forEach(value => allow.push({type:value.type, id:value.id}))
           let data = {
              publicKey: {
                 challenge: new Uint8Array(this.challenge),
                 allowCredentials: allow,
                 timeout: 60000,
                 userVerification: "preferred",
              }
           };
            navigator.credentials.get(data).then(credential => {
                let credentialId = convertToByteArray(new Int8Array(credential.rawId))
                let authenticatorData = convertToByteArray(new Int8Array(credential.response.authenticatorData));
                let clientDataJson = convertToByteArray(new Int8Array(credential.response.clientDataJSON));
                let signature = convertToByteArray(new Int8Array(credential.response.signature));
                let resp = peergos.client.JsUtil.generateWebAuthnResponse(credentialId, authenticatorData, clientDataJson, signature);
                that.consumer_func(credentialId, resp);
           }).catch(getCredentialsException => {
                that.$toast.error('Unable to get credentials', {timeout:false});
                console.log('Unable to get credentials: ' + getCredentialsException);
           });
        }
    }
}
</script>
<style>
.mfa_login {
   display: flex;
   justify-content: center;
}

.mfa_buttons {
   display: flex;
   justify-content: center;
   flex-direction: column;
   align-items: center;
}

.mfa_button {
  width:60%
}
</style>
