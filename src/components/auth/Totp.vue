<template>
<transition name="modal">
<div class="modal-mask" @click="close">
  <div style="height:30%"></div>
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
            totpUid: '',
            totp: '',
            isReady: false,
            QRCodeURL: ''
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

        /*
        this.context.network.account.addTotpFactor(this.context.username, this.context.signer).thenApply(totpKey => {
            that.context.network.account.getSecondAuthMethods(that.context.username, that.context.signer).thenApply(mfaMethods => {
                let totpMethod = mfaMethods.toArray([]).filter(method => method.type.toString() == MultiFactorAuthMethod.Type.TOTP.toString())[0];

                //let algorithm = peergos.shared.login.mfa.TotpKey.ALGORITHM;
                //let totp = new TimeBasedOneTimePasswordGenerator(Duration.ofSeconds(30L), 6, algorithm);
                let key = new SecretKeySpec(totpKey.key, algorithm);

                let now = java.time.Instant.now();
                //let clientCode = totp.generateOneTimePasswordString(key, now);
                that.context.network.account.enableTotpFactor(that.context.username, totpMethod.uid, clientCode).thenApply((res) => {
                    that.totpUid = totpMethod.uid;
                });
        });*/
        //todo replace code
        this.context.generateFingerPrint(this.context.username).thenApply(fingerprint => {
            that.QRCodeURL = fingerprint.right.getBase64Thumbnail();
            that.isReady = true; //todo move
        });
    },
    methods: {
        close: function() {
            this.$emit("hide-totp");
        },
        confirm: function() {
            this.close();
            this.consumer_func(this.totpUid);
        }
    }
}
</script>
<style>
</style>