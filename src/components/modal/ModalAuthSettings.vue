<template>
	<AppModal>
		<template #header>
			<h2>Two-factor Authentication</h2>
		</template>
		<template #body>
            <Spinner v-if="showSpinner"></Spinner>
            <Confirm
                    v-if="showConfirm"
                    v-on:hide-confirm="showConfirm = false"
                    :confirm_message='confirm_message'
                    :confirm_body="confirm_body"
                    :consumer_cancel_func="confirm_consumer_cancel_func"
                    :consumer_func="confirm_consumer_func">
            </Confirm>
            <Totp
                    v-if="showTOTPSetup"
                    v-on:hide-totp="showTOTPSetup = false"
                    :enableTotpOnly="enableTotpOnly"
                    :consumer_func="totp_confirmed_func">
            </Totp>
            <WebAuth
                    v-if="showWebAuthSetup"
                    v-on:hide-webauth="showWebAuthSetup = false"
                    :consumer_func="webauth_confirmed_func">
            </WebAuth>
            <div class="table-responsive">
                <table class="table">
                    <thead>
                    <tr style="cursor:pointer;">
                        <th> Type </th>
                        <th></th>
                        <th></th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr>
                        <td>Authenticator App</td>
                        <td></td>
                        <td v-if="totpKey.length == 0" >
                            <button class="btn btn-success" @click="setupAuthenticatorApp()"> Add </button>
                        </td>
                        <td v-if="totpKey.length == 1 && !totpKey[0].enabled">
                            <button class="btn btn-info" @click="enableAuthenticatorApp()"> Enable</button>
                        </td>
                        <td v-if="totpKey.length == 1">
                            <button class="btn btn-danger" @click="removeAuthenticatorApp()"> Remove</button>
                        </td>
                    </tr>
                    <tr v-for="(webAuthKey, index) in webAuthKeys">
                        <td>{{ webAuthKey.name }}</td>
                        <td></td>
                        <td> <button class="btn btn-danger" @click="removeWebAuthKey(webAuthKey)">Remove</button>
                        </td>
                    </tr>
                    </tbody>
                </table>
                <button class="btn btn-success" @click="addWebAuthKey()">Add Web Auth Key</button>
            </div>
		</template>
	</AppModal>
</template>

<script>
const AppButton = require("../AppButton.vue");
const AppModal = require("AppModal.vue");
const Confirm = require("../confirm/Confirm.vue");
const Spinner = require("../spinner/Spinner.vue");
const Totp = require("../auth/Totp.vue");
const WebAuth = require("../auth/WebAuth.vue");

module.exports = {
    components: {
        AppButton,
        AppModal,
        Confirm,
        Spinner,
        Totp,
        WebAuth,
    },
    data() {
        return {
            showSpinner: false,
            totpKey: [],
            webAuthKeys: [],
            showConfirm: false,
            confirm_message: "",
            confirm_body: "",
            confirm_consumer_cancel_func: () => {},
            confirm_consumer_func: () => {},
            showTOTPSetup: false,
            enableTotpOnly: false,
            showWebAuthSetup: false,
        };
    },
    
    computed: {
	...Vuex.mapState([
	    'context'
	]),
    },
    mixins:[],
    created: function() {
        let that = this;
        this.showSpinner = true;
        this.context.network.account.getSecondAuthMethods(this.context.username, this.context.signer).thenApply(mfaMethods => {
            let methods = mfaMethods.toArray([]);
            for(var i=0; i < methods.length;i++) {
                let method = methods[i];
                if (method.type.toString() == peergos.shared.login.mfa.MultiFactorAuthMethod.Type.TOTP.toString()) {
                    that.totpKey.push({credentialId: method.credentialId, enabled: method.enabled});
                } else {
                    that.webAuthKeys.push({credentialId: method.credentialId, name: method.name});
                }
            }
            that.showSpinner = false;
        }).exceptionally(function(throwable) {
            that.$toast.error('Unable to retrieve authentication methods', {timeout:false});
            console.log('Unable to retrieve authentication methods: ' + throwable);
            that.showSpinner = false;
        });
    },
    methods: {
        setupAuthenticatorApp() {
            this.showTOTPSetup = true;
        },
        enableAuthenticatorApp() {
            this.enableTotpOnly = true;
            this.showTOTPSetup = true;
        },
        removeAuthenticatorApp() {
            let that = this;
            this.confirmRemoveAuthenticatorApp(
                () => {
                    that.showConfirm = false;
                    that.deleteAuthenticatorApp();
                },
                () => {
                    that.showConfirm = false;
                    that.showSpinner = false;
                }
            );
        },
        deleteAuthenticatorApp() {
            let that = this;
            this.showSpinner = true;
            let credentialId = this.totpKey[0].credentialId;
            this.context.network.account.deleteSecondFactor(this.context.username, credentialId, this.context.signer).thenApply(res => {
                if (res) {
                    that.totpKey = [];
                    that.enableTotpOnly = false;
                }
                that.showSpinner = false;
            }).exceptionally(function(throwable) {
                that.$toast.error('Unable to delete authentication method', {timeout:false});
                console.log('Unable to delete authentication method: ' + throwable);
                that.showSpinner = false;
            });
        },
	    addWebAuthKey() {
            this.showWebAuthSetup = true;
        },
        removeWebAuthKey(webAuthKey) {
            let that = this;
            this.confirmRemoveWebAuthKey(webAuthKey.name,
                () => {
                    that.showConfirm = false;
                    that.deleteWebAuthKey(webAuthKey);
                },
                () => {
                    that.showConfirm = false;
                    that.showSpinner = false;
                }
            );
        },
        deleteWebAuthKey(webAuthKey) {
            let that = this;
            this.showSpinner = true;
            let credentialId = webAuthKey.credentialId;
            this.context.network.account.deleteSecondFactor(this.context.username, credentialId, this.context.signer).thenApply(res => {
                let index = that.webAuthKeys.findIndex((v) => v.credentialId === webAuthKey.credentialId);
                if (index > -1) {
                    that.webAuthKeys.splice(index, 1);
                }
                that.showSpinner = false;
            }).exceptionally(function(throwable) {
                that.$toast.error('Unable to delete web authentication method', {timeout:false});
                console.log('Unable to delete web authentication method: ' + throwable);
                that.showSpinner = false;
            });
        },
        confirmRemoveWebAuthKey(name, replaceFunction, cancelFunction) {
            this.confirm_message = 'Remove Web Auth Key: ' + name;
            this.confirm_body = "Are you sure you want to remove this key?";
            this.confirm_consumer_cancel_func = cancelFunction;
            this.confirm_consumer_func = replaceFunction;
            this.showConfirm = true;
        },
        confirmRemoveAuthenticatorApp(replaceFunction, cancelFunction) {
            this.confirm_message = 'Remove Authenticator App';
            this.confirm_body = "Are you sure you want to remove Authenticator App?";
            this.confirm_consumer_cancel_func = cancelFunction;
            this.confirm_consumer_func = replaceFunction;
            this.showConfirm = true;
        },
        totp_confirmed_func(credentialId, success) {
            if (this.totpKey.length == 0) {
                this.totpKey.push({credentialId: credentialId, enabled: success});
            } else {
                let existingTotp = this.totpKey[0];
                existingTotp.enabled = success;
            }
        },
        webauth_confirmed_func(credentialId, name, success) {
            if (success) {
                this.webAuthKeys.push({credentialId: credentialId, name: name});
            }
        },
    },
};
</script>
<style>
</style>