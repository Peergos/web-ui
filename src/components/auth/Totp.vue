<template>
<transition name="modal">
<div class="modal-mask" @click="close">
  <div class="modal-container" @click.stop>
    <div class="modal-header">
      <h3 id="confirm-header-id">Scan QR Code with Authenticator App</h3>
    </div>
    <div class="modal-body">
        <center>
    	  <div class="qrcode-container">
                <img v-if="QRCodeURL.length > 0" v-bind:src="QRCodeURL" alt="QR code" class="qrcode"></img>
    	  </div>
        </center>
        <center>
        <input
            type="text"
            autofocus
            name="totp"
            v-model="totp"
            placeholder=""
            ref="totp"
            :disabled="!isReady"
            style="width:200px"
        />
        </center>
    </div>
    <div class="modal-footer">
      <button class="btn btn-success btn-lg" @click="confirm()" style="margin:10%;">
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
    props: ['consumer_func'],
    computed: {
        ...Vuex.mapState([
            'context'
        ]),
    },
    created: function() {
        let that = this;
        this.context.network.account.addTotpFactor(this.context.username, this.context.signer).thenApply(totpKey => {
            that.context.network.account.getSecondAuthMethods(that.context.username, that.context.signer).thenApply(mfaMethods => {
                let totpMethod = mfaMethods.toArray([]).filter(method => method.type.toString() == peergos.shared.login.mfa.MultiFactorAuthMethod.Type.TOTP.toString())[0];
                that.credentialId = totpMethod.credentialId;
                that.QRCodeURL = totpKey.getQRCode(that.context.username);
                that.isReady = true;
            });
        });
    },
    methods: {
        close: function() {
            this.$emit("hide-totp");
        },
        confirm: function() {
            let that = this;
            if (this.isReady) {
                let clientCode = this.totp.trim();
                that.context.network.account.enableTotpFactor(this.context.username, this.credentialId, clientCode, this.context.signer).thenApply(res => {
                    if (res) {
                        that.close();
                        that.consumer_func(that.credentialId);
                    } else {
                        that.$toast.error('Incorrect code', {timeout:false});
                    }
                });
            }
        }
    }
}
</script>
<style>
</style>