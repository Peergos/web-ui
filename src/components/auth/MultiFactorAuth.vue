<template>
	<transition name="modal" appear>
		<div class="pg-dialog__mask" @click="close()">
			<div class="pg-dialog pg-dialog--prompt" role="dialog" aria-modal="true" aria-label="Multi Factor Authentication" @click.stop>
				<header class="pg-dialog__head">
					<h3 class="pg-dialog__title">Multi Factor Authentication</h3>
					<DialogClose @close="close()"/>
				</header>
				<div v-if="isReady" class="pg-dialog__body">
					<div v-if="showChooser" class="mfa__choices">
						<button v-if="hasTotp" type="button" id='prompt-totpbutton-id' class="pg-btn" @click="useTotp()">Use authenticator app</button>
						<button v-if="hasWebauthn" type="button" id='prompt-webauthn-button-id' class="pg-btn" @click="confirmWebauthn()">Use security key</button>
						<button v-if="hasBackupCodes" type="button" id='prompt-backupcodes-button-id' class="pg-btn" @click="useBackupCode()">Use a backup code</button>
					</div>
					<label v-if="showCodeEntry" class="mfa__field">
						<span>{{ codeLabel }}</span>
						<input ref="code" class="pg-input" type="text" name="mfaCode" v-model="mfaCode"
							autocomplete="one-time-code" v-on:keyup.enter="confirmCode">
					</label>
					<p v-if="!showChooser && !showCodeEntry" class="pg-note">Waiting for your security key</p>
				</div>
				<footer v-if="showCodeEntry" class="pg-dialog__foot">
					<div class="pg-dialog__actions">
						<span class="pg-dialog__spacer"></span>
						<button type="button" id='prompt-button-id' class="pg-btn pg-btn--primary" @click="confirmCode()">Confirm</button>
					</div>
				</footer>
			</div>
		</div>
	</transition>
</template>
<script>
const DialogClose = require("../dialog/DialogClose.vue");
module.exports = {
    components: {
        DialogClose,
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
            this.focusCode();
        },
        useBackupCode: function() {
            this.codeCredentialId = this.backupCredentialId;
            this.codeLabel = 'Backup code:';
            this.showChooser = false;
            this.showCodeEntry = true;
            this.focusCode();
        },
        // the field appears in place of the choices, so the keyboard has to be brought to it
        focusCode: function() {
            this.$nextTick(() => {
                if (this.$refs.code)
                    this.$refs.code.focus();
            });
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
.mfa__choices {
	display: flex;
	flex-direction: column;
	gap: 10px;
}

.mfa__field {
	display: flex;
	flex-direction: column;
	gap: 6px;
	margin: 0;
	font-size: var(--text-small);
	font-weight: var(--regular);
}
</style>
