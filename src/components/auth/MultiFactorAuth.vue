<template>
<transition name="modal">
<div class="modal-mask" @click="close">
  <div style="height:30%"></div>
  <div class="modal-container" @click.stop>
    <div class="modal-header">
      <h3 id="confirm-header-id">Multi Factor Authentication</h3>
    </div>
    <div class="modal-body">
        <Spinner v-if="showSpinner"></Spinner>
        <div class="table-responsive">
            <table class="table">
                <thead>
                <tr style="cursor:pointer;">
                    <th> Preferred Method </th>
                    <th> Type </th>
                    <th></th>
                </tr>
                </thead>
                <tbody>
                <tr v-for="(option, index) in mfaOptions">
                    <td>
                      <label class="checkbox__group">
                        <input type="radio" :id="index" :value="index" v-model="preferredAuthMethod">
                        <span class="checkmark"></span>
                      </label>
                    </td>
                    <td v-if="option.type == 'Authenticator App'">{{ option.type }} </td>
                    <td v-if="option.type == 'Authenticator App'">
                        <input
                            type="text"
                            autofocus
                            name="mfaCode"
                            v-model="mfaCode"
                            placeholder=""
                            style="width:200px"
                            v-on:keyup.enter="confirm"
                        />
                    </td>
                    <td v-if="option.type != 'Authenticator App'">{{ option.type }} &nbsp;:&nbsp;{{ option.name }}</td>
                    <td v-if="option.type != 'Authenticator App'">
                    </td>
                </tr>
                </tbody>
            </table>
        </div>
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
            mfaCode: '',
            mfaOptions: [],
            preferredAuthMethod: 0,
            showSpinner: false,
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
        for(var i=0; i < this.mfaMethods.length;i++) {
            let method = this.mfaMethods[i];
            if (method.type.toString() == peergos.shared.login.mfa.MultiFactorAuthMethod.Type.TOTP.toString()) {
                that.mfaOptions.push({type:'Authenticator App', credentialId: method.credentialId});
            } else {
                that.mfaOptions.push({type:'WebKey', credentialId: method.credentialId, name: method.name});
            }
        }
    },
    methods: {
        close: function() {
            let credentialId = this.mfaOptions[this.preferredAuthMethod].credentialId;
            this.consumer_cancel_func(credentialId);
        },
        confirm: function() {
            let credentialId = this.mfaOptions[this.preferredAuthMethod].credentialId;
            if (this.mfaOptions[this.preferredAuthMethod].type == 'Authenticator App') {
                let resp = peergos.client.JsUtil.generateAuthResponse(credentialId, this.mfaCode);
                this.consumer_func(credentialId, resp);
            } else {
                this.confirmWebAuth(this.mfaOptions[this.preferredAuthMethod]);
            }
        },
        confirmWebAuth: function(webAuthMethod) {
           let that = this;
           let data = {
              publicKey: {
                 challenge: that.challenge,
                 allowCredentials: [{
                    type: "public-key",
                    id: webAuthMethod.credentialId
                 }],
                 timeout: 60000,
                 userVerification: "preferred",
              }
           };
           navigator.credentials.get(data).then(credential => {
                let authenticatorData = convertToByteArray(new Int8Array(credential.response.authenticatorData));
                let clientDataJson = convertToByteArray(new Int8Array(credential.response.clientDataJSON));
                let signature = convertToByteArray(new Int8Array(credential.response.signature));
                let resp = peergos.client.JsUtil.generateWebAuthnResponse(webAuthMethod.credentialId, authenticatorData, clientDataJson, signature);
                that.consumer_func(webAuthMethod.credentialId, resp);
           });
        }
    }
}
</script>
<style>
</style>