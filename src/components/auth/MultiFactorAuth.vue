<template>
	<transition name="modal" appear>
		<div class="app-prompt app-modal__overlay" @click="close()">

			<div class="app-prompt__container" @click.stop>
				<header class="prompt__header">
					<AppButton class="close" icon="close" @click.native="close()"/>
					<h3>Multi Factor Authentication</h3>
				</header>
				<div v-if="isReady">
    				<div v-if="showChooser">
                                    <div class="mfa_buttons">
                                        <AppButton
					    v-if="hasTotp"
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
					    v-if="hasWebauthn"
					    id='prompt-webauthn-button-id'
					    type="primary"
					    accent
					    @click.native="confirmWebauthn()"
					    class="mfa_button"
					    style="margin:10px;"
					    >
					    Use security key
					</AppButton>
                                        <AppButton
					    v-if="hasBackupCodes"
					    id='prompt-backupcodes-button-id'
					    type="primary"
					    accent
					    @click.native="useBackupCode()"
					    class="mfa_button"
					    style="margin:10px;"
					    >
					    Use a backup code
					</AppButton>
                                    </div>
                                </div>
                    <div>
                        <center v-if="showCodeEntry">
                            {{ codeLabel }}&nbsp;<input
                                type="text"
                                autofocus
                                name="mfaCode"
                                v-model="mfaCode"
                                placeholder=""
                                style="width:200px"
                                v-on:keyup.enter="confirmCode"
                            />
                        </center>
                    </div>
                </div>
				<footer class="mfa_login">
				    <AppButton
                                        v-if="showCodeEntry"
					id='prompt-button-id'
					type="primary"
					accent
					@click.native="confirmCode()"
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
            hasBackupCodes: false,
            showChooser: false,
            showCodeEntry: false,
            codeLabel: '',
            codeCredentialId: null,
            totpCredentialId: null,
            backupCredentialId: null,
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
            let type = method.type == null ? '' : method.type.toString();
            if (type == peergos.shared.login.mfa.MultiFactorAuthMethod.Type.TOTP.toString()) {
                that.mfaOptions.push({type:'Authenticator App', credentialId: method.credentialId});
                this.hasTotp = true;
                this.totpCredentialId = method.credentialId;
            } else if (type == peergos.shared.login.mfa.MultiFactorAuthMethod.Type.BACKUP_CODES.toString()) {
                that.mfaOptions.push({type:'Backup Code', credentialId: method.credentialId});
                this.hasBackupCodes = true;
                this.backupCredentialId = method.credentialId;
            } else if (type == peergos.shared.login.mfa.MultiFactorAuthMethod.Type.WEBAUTHN.toString()) {
                that.mfaOptions.push({type:'WebKey', credentialId: new Uint8Array(method.credentialId), name: method.name});
                this.hasWebauthn = true;
                that.webauthnMethods.push({
                    type: "public-key",
                    id: new Uint8Array(method.credentialId)
                });
            }
        }
        this.isReady = true;
        let optionCount = (this.hasTotp ? 1 : 0) + (this.hasWebauthn ? 1 : 0) + (this.hasBackupCodes ? 1 : 0);
        if (optionCount > 1)
            this.showChooser = true;
        else if (this.hasWebauthn)
            this.confirmWebauthn();
        else if (this.hasTotp)
            this.useTotp();
        else if (this.hasBackupCodes)
            this.useBackupCode();
    },
    methods: {
        close: function() {
            let credentialId = this.codeCredentialId != null ? this.codeCredentialId : this.mfaOptions[0].credentialId;
            this.consumer_cancel_func(credentialId);
        },
        useTotp: function() {
            this.codeCredentialId = this.totpCredentialId;
            this.codeLabel = 'Verification code from app:';
            this.showChooser = false;
            this.showCodeEntry = true;
        },
        useBackupCode: function() {
            this.codeCredentialId = this.backupCredentialId;
            this.codeLabel = 'Backup code:';
            this.showChooser = false;
            this.showCodeEntry = true;
        },
        confirmCode: function() {
            let credentialId = this.codeCredentialId;
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
