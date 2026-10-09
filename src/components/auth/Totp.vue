<template>
	<transition name="modal" appear>
		<div class="pg-dialog__mask" @click="close()">
			<div class="pg-dialog pg-dialog--prompt" role="dialog" aria-modal="true" aria-label="Setup Authenticator App" @click.stop>
				<header class="pg-dialog__head">
					<h3 class="pg-dialog__title">Setup Authenticator App</h3>
					<DialogClose @close="close()"/>
				</header>
				<Spinner v-if="showSpinner"></Spinner>
				<Message v-if="showMessage"
					v-on:remove-message="showMessage = false;"
					:title="messageTitle"
					:message="manualCode">
				</Message>
				<div class="pg-dialog__body totp__body">
					<!-- a code on a white ground whatever the theme: a camera reads dark on light -->
					<div v-if="QRCodeURL.length > 0" class="totp__qrcode">
						<img v-bind:src="QRCodeURL" alt="QR code">
					</div>
					<button v-if="isReady" type="button" class="pg-btn pg-btn--quiet" @click="enterCodeManually()">Enter code manually</button>
					<label class="totp__field">
						<span>Verification code from app:</span>
						<input ref="totp" class="pg-input" type="text" name="totp" v-model="totp"
							autocomplete="one-time-code" :disabled="!isReady" v-on:keyup.enter="confirm">
					</label>
				</div>
				<footer class="pg-dialog__foot">
					<div class="pg-dialog__actions">
						<span class="pg-dialog__spacer"></span>
						<button type="button" class="pg-btn" @click="close()">Cancel</button>
						<button type="button" id='prompt-button-id' class="pg-btn pg-btn--primary" :disabled="!isReady" @click="confirm()">Confirm</button>
					</div>
				</footer>
			</div>
		</div>
	</transition>
</template>
<script>
const DialogClose = require("../dialog/DialogClose.vue");
const Spinner = require("../spinner/Spinner.vue");
const Message = require("../message/Message.vue");

module.exports = {
    components: {
        DialogClose,
        Message,
        Spinner,
    },
    data: function() {
        return {
            credentialId: '',
            totp: '',
            isReady: false,
            QRCodeURL: '',
            showSpinner: false,
            manualCode:'',
            messageTitle: 'Enter Code',
            showMessage: false,
        }
    },
    props: ['consumer_func'],
    computed: {
        ...Vuex.mapState([
            'context'
        ]),
    },
    created: function() {
        let that = this;
        this.showSpinner = true;
        this.context.network.account.addTotpFactor(this.context.username, this.context.signer).thenApply(totpKey => {
            that.credentialId = totpKey.credentialId;
            that.QRCodeURL = totpKey.getQRCode(that.context.username);
            let encoded = totpKey.encode();
            that.manualCode = encoded.substring(encoded.indexOf(':') + 1);
            that.showSpinner = false;
            that.isReady = true;
        }).exceptionally(function (addException) {
            that.$toast.error('Unable to add new authentication method', {timeout:false});
            console.log('Unable to add new authentication method: ' + addException);
            that.showSpinner = false;
        });
    },
    methods: {
        enterCodeManually: function() {
            this.showMessage = true;
        },
        close: function(success) {
            this.$emit("hide-totp");
            this.consumer_func(this.credentialId, success === true);
        },
        confirm: function() {
            let that = this;
            if (this.isReady) {
                this.showSpinner = true;
                let clientCode = this.totp.trim();
                that.context.network.account.enableTotpFactor(this.context.username, this.credentialId, clientCode, this.context.signer).thenApply(res => {
                    if (res === true || res === "true")
                        clearRootKeyCacheFully(() => {});
                    this.$toast('Authenticator App has been enabled');
                    that.showSpinner = false;
                    that.close(true);
                }).exceptionally(function (throwable) {
                    that.showSpinner = false;
                    if(throwable.detailMessage.startsWith('Invalid+TOTP+code+for+credId')) {
                        that.$toast.error('Incorrect code', {timeout:false});
                        console.log('Incorrect code: ' + throwable);
                    } else {
                        that.$toast.error('Unable to enable Authenticator app', {timeout:false});
                        console.log('Unable to enable Authenticator app. Error: ' + throwable);
                    }
                });
            }
        }
    }
}
</script>
<style>
.totp__body {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 12px;
}

.totp__body > * {
	flex: none;
}

.totp__qrcode {
	width: 100%;
	max-width: 280px;
	padding: 12px;
	background-color: #ffffff;
	border-radius: var(--radius-control);
}

.totp__qrcode img {
	display: block;
	width: 100%;
	height: auto;
}

.totp__field {
	display: flex;
	flex-direction: column;
	gap: 6px;
	width: 100%;
	margin: 0;
	font-size: var(--text-small);
	font-weight: var(--regular);
}
</style>
