<template>
	<transition name="modal" appear>
		<div class="app-prompt app-modal__overlay" @click="close()">

			<div class="app-prompt__container" @click.stop>
				<header class="prompt__header">
					<AppButton class="close" icon="close" @click.native="close()"/>
					<h3>Multi Factor Authentication</h3>
				</header>
				<div v-if="isReady">
    				<div v-if="mfaOptions.length > 1">
                        <div class="prompt__body">
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
                                        <td v-if="option.type != 'Authenticator App'">{{ option.type }} &nbsp;:&nbsp;{{ option.name }}</td>
                                    </tr>
                                    </tbody>
                                </table>
                            </div>
                            <center v-if="isSelectedMethodTotp">
                                Password code:&nbsp;<input
                                    type="text"
                                    autofocus
                                    name="mfaCode"
                                    v-model="mfaCode"
                                    placeholder=""
                                    style="width:200px"
                                    v-on:keyup.enter="confirm"
                                />
                            </center>
                        </div>
                    </div>
                    <div v-if="mfaOptions.length == 1 && mfaOptions[preferredAuthMethod].type == 'Authenticator App'">
                        <center v-if="isSelectedMethodTotp">
                            Password code:&nbsp;<input
                                type="text"
                                autofocus
                                name="mfaCode"
                                v-model="mfaCode"
                                placeholder=""
                                style="width:200px"
                                v-on:keyup.enter="confirm"
                            />
                        </center>
                    </div>
                    <div v-if="mfaOptions.length == 1 && mfaOptions[preferredAuthMethod].type == 'WebKey'">
                        Using Web Auth Key
                    </div>
                </div>
				<footer class="prompt__footer">
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
module.exports = {
    components: {
        AppButton,
    },
    data: function() {
        return {
            mfaCode: '',
            mfaOptions: [],
            preferredAuthMethod: 0,
            isReady: false,
        }
    },
    props: ['mfaMethods', 'challenge', 'consumer_cancel_func', 'consumer_func'],
    computed: {
        ...Vuex.mapState([
            'context'
        ]),
        isSelectedMethodTotp: function() {
            if (this.mfaOptions.length == 0) {
                return false;
            }
            try {
                return this.mfaOptions[this.preferredAuthMethod].type == 'Authenticator App';
            } catch (err) {
                return false;
            }
        },
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
        this.isReady = true;
        if (this.mfaOptions.length == 1 && this.mfaOptions[0].type == 'WebKey') {
            this.confirm();
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
           }).catch(getCredentialsException => {
                that.$toast.error('Unable to get credentials', {timeout:false});
                console.log('Unable to get credentials: ' + getCredentialsException);
           });
        }
    }
}
</script>
<style>
</style>