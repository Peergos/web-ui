<template>
<transition name="modal">
<div class="modal-mask" @click="close">
  <div style="height:30%"></div>
  <div class="modal-container" @click.stop>

    <div class="modal-header">
      <h3 id="confirm-header-id">WebAuthn Setup</h3>
    </div>

    <div class="modal-body">
        <center>
            Name:&nbsp;<input
                type="text"
                autofocus
                name="webAuthName"
                v-model="webAuthName"
                placeholder=""
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
            webAuthName: '',
        }
    },
    props: ['consumer_func'],
    computed: {
        ...Vuex.mapState([
            'context'
        ]),
    },
    created: function() {
    },
    methods: {
        hexToBytes: function(hex) {
            let res = new Uint8Array(hex.length/2);
            for (var i=0; i < hex.length/2; i++)
                res[i] = parseInt(hex.substring(2*i, 2*(i+1)), 16);
            return res;
        },
        close: function() {
            this.$emit("hide-webauth");
        },
        confirm: function() {
            let name = this.webAuthName.trim();
            if (name.length == 0) {
                this.$toast.error('Please enter a name', {timeout:false});
            } else {
                this.register();
            }
        },
        register: function() {
            let that = this;
            that.context.network.account.registerSecurityKeyStart(that.context.username, that.context.signer).thenApply(challenge => {
                let enc = new TextEncoder();
                let userId = new Uint8Array(that.context.username.length);
                enc.encodeInto(that.context.username, userId);
                let data = {
                    publicKey: {
                        challenge: challenge,
                        rp: { name: "Peergos" },
                        user: {
                            id: userId,
                            name: that.context.username,
                            displayName: that.context.username,
                        },
                        timeout: 60000,
                        pubKeyCredParams: [
                            {type: "public-key", alg: -8},
                            {type: "public-key", alg: -7},
                            {type: "public-key", alg: -257}
                        ]
                    }
                };
                navigator.credentials.create(data).then(credential => {
                    let keyName = that.context.username;
                    let rawAttestation = convertToByteArray(new Int8Array(credential.response.attestationObject));
                    let resp = peergos.client.JsUtil.generateWebAuthnResponse(rawAttestation);
                    that.context.network.account.registerSecurityKeyComplete(that.context.username, keyName, resp, that.context.signer).thenApply(done => {
                        //let res = await fetch(\"/registerComplete\", {'method':'POST','body':JSON.stringify({
                        //      'attestationObject':toHexString(credential.response.attestationObject),
                        //      'clientDataJSON': toHexString(credential.response.clientDataJSON)
                        //   })
                        //}).then(response=>response.json());
                        //document.getElementById(\"register\").textContent = res.status;
                        //}
                        console.log('done:' + done);
                        that.close();
                        that.consumer_func({key:'abcde'});
                    });
                });
            });
        }
    }
}
</script>
<style>
</style>