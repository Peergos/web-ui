<template>
	<transition name="modal" appear>
		<div class="app-prompt app-modal__overlay" @click="close()">

			<div class="app-prompt__container" @click.stop>
				<header class="prompt__header">
					<AppButton class="close" icon="close" @click.native="close()"/>
					<h3>Setup Authenticator App</h3>
				</header>
                <Spinner v-if="showSpinner"></Spinner>
                <div class="prompt__body">
                    <center v-if="QRCodeURL.length > 0">
                      <div class="auth-qrcode-container">
                            <img v-bind:src="QRCodeURL" alt="QR code" class="auth-qrcode"></img>
                      </div>
                    </center>
                    <center>
                        Password code:&nbsp;<input
                            type="text"
                            autofocus
                            name="totp"
                            v-model="totp"
                            placeholder=""
                            ref="totp"
                            :disabled="!isReady"
                            v-on:keyup.enter="confirm"
                            style="width:200px"
                        />
                    </center>
                </div>
				<footer class="prompt__footer">
					<AppButton outline @click.native="close()">
						Cancel
					</AppButton>

					<AppButton
						id='prompt-button-id'
						type="primary"
						accent
						@click.native="confirm()"
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
const Spinner = require("../spinner/Spinner.vue");

module.exports = {
    components: {
        AppButton,
        Spinner,
    },
    data: function() {
        return {
            credentialId: '',
            totp: '',
            isReady: false,
            QRCodeURL: '',
            showSpinner: false,
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
            if (!that.enableOnly) {
                that.QRCodeURL = totpKey.getQRCode(that.context.username);
            }
            that.showSpinner = false;
            that.isReady = true;
        }).exceptionally(function (addException) {
            that.$toast.error('Unable to add new authentication method', {timeout:false});
            console.log('Unable to add new authentication method: ' + addException);
            that.showSpinner = false;
        });
    },
    methods: {
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
.auth-qrcode-container {
    position: relative;
    width: 300px;
    height: 300px;
}
.auth-qrcode {
    position: absolute;
    left: 0;
    width: 100%;
    height: 100%;
}
</style>