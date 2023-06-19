<template>
<transition name="modal">
<div class="modal-mask" @click="close">
  <div class="modal-container" @click.stop>
    <div class="modal-header">
      <h3 id="confirm-header-id">Setup Authenticator App</h3>
    </div>
    <div class="modal-body">
        <center v-if="QRCodeURL.length > 0">
    	  <div class="qrcode-container">
                <img v-bind:src="QRCodeURL" alt="QR code" class="qrcode"></img>
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
    <div class="modal-footer">
      <button class="btn btn-success btn-lg" @click="confirm()">
        Confirm
      </button>
    </div>
  </div>
</div>
</transition>
</template>
<script>
module.exports = {
    data: function() {
        return {
            credentialId: '',
            totp: '',
            isReady: false,
            QRCodeURL: '',
        }
    },
    props: ['enableTotpOnly', 'consumer_func'],
    computed: {
        ...Vuex.mapState([
            'context'
        ]),
    },
    created: function() {
        let that = this;
        if (this.enableTotpOnly) {
            that.context.network.account.getSecondAuthMethods(that.context.username, that.context.signer).thenApply(mfaMethods => {
                let totpMethod = mfaMethods.toArray([]).filter(method => method.type.toString() == peergos.shared.login.mfa.MultiFactorAuthMethod.Type.TOTP.toString())[0];
                that.credentialId = totpMethod.credentialId;
                that.isReady = true;
            });
        } else {
            this.context.network.account.addTotpFactor(this.context.username, this.context.signer).thenApply(totpKey => {
                that.context.network.account.getSecondAuthMethods(that.context.username, that.context.signer).thenApply(mfaMethods => {
                    let totpMethod = mfaMethods.toArray([]).filter(method => method.type.toString() == peergos.shared.login.mfa.MultiFactorAuthMethod.Type.TOTP.toString())[0];
                    that.credentialId = totpMethod.credentialId;
                    if (!that.enableOnly) {
                        that.QRCodeURL = totpKey.getQRCode(that.context.username);
                    }
                    that.isReady = true;
                });
            });
        }
    },
    methods: {
        close: function(success) {
            this.$emit("hide-totp");
            this.consumer_func(this.credentialId, success === true);
        },
        confirm: function() {
            let that = this;
            if (this.isReady) {
                let clientCode = this.totp.trim();
                that.context.network.account.enableTotpFactor(this.context.username, this.credentialId, clientCode, this.context.signer).thenApply(res => {
                    if (res) {
                        this.$toast('Authenticator App has been enabled');
                        that.close(true);
                    } else {
                        that.$toast.error('Incorrect code', {timeout:false});
                    }
                }).exceptionally(function (throwable) {
                    if(throwable.detailMessage.startsWith('Invalid+TOTP+code+for+credId')) {
                        that.$toast.error('Unable to enable Authenticator app', {timeout:false});
                        console.log('Unable to enable Authenticator app. Error: ' + throwable);
                    } else {
                        that.$toast.error('Unknown error', {timeout:false});
                        console.log('Unknown error: ' + throwable);
                    }
                });
            }
        }
    }
}
</script>
<style>
</style>