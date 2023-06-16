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
                        <td>{{ option.type }}</td>
                        </td>
                        <td></td>
                    </tr>
                    </tbody>
                </table>
            </div>
        <input
            type="text"
            autofocus
            name="mfa"
            v-model="mfa"
            placeholder=""
            ref="totp"
            style="width:200px"
        />
        <br/>
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
            mfaCode: '',
            mfaOptions: [],
            preferredAuthMethod: 0,
        }
    },
    props: ['mfaMethods', 'consumer_cancel_func', 'consumer_func'],
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
                that.mfaOptions.push({type:'WebKey', credentialId: method.credentialId});
            }
        }
    },
    methods: {
        close: function() {
            this.$emit("hide-auth");
            let credentialId = this.mfaOptions[this.preferredAuthMethod].credentialId;
            this.consumer_cancel_func(credentialId);
        },
        confirm: function() {
            this.$emit("hide-auth");
            let credentialId = this.mfaOptions[this.preferredAuthMethod].credentialId;
            this.consumer_func(credentialId, this.mfaCode);
        }
    }
}
</script>
<style>
</style>