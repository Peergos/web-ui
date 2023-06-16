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
                        <th> Action </th>
                        <th></th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr>
                        <td>Authenticator App</td>
                        <td v-if="totpKey.length == 0" >
                            <button class="btn btn-success" @click="setupAuthenticatorApp()"> Add </button>
                        </td>
                        <td v-if="totpKey.length > 0">
                            <button class="btn btn-danger" @click="removeAuthenticatorApp()"> Remove</button>
                        </td>
                    </tr>
                    <tr v-for="(webAuthKey, index) in webAuthKeys">
                        <td>Web Auth: {{ webAuthKey.credentialId }}</td>
                        <td> <button class="btn btn-danger" @click="removeWebAuthKey(webAuthKey)">Remove</button>
                        </td>
                        <td></td>
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
            webAuthKeys: [
            ],
            showConfirm: false,
            confirm_message: "",
            confirm_body: "",
            confirm_consumer_cancel_func: () => {},
            confirm_consumer_func: () => {},
            showTOTPSetup: false,
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
                    that.totpKey.push({credentialId: method.credentialId});
                } else {
                    that.webAuthKeys.push({credentialId: method.credentialId});
                }
            }
            this.showSpinner = false;
        }).exceptionally(function(throwable) {
            console.log(throwable);
        });
    },
    methods: {
        setupAuthenticatorApp() {
            console.log('setupAuthenticatorApp');
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
            console.log('deleteAuthenticatorApp');
            let that = this;
            this.showSpinner = true;
            let credentialId = this.totpKey[0].credentialId;
            this.context.network.account.deleteSecondFactor(this.context.username, credentialId, this.context.signer).thenApply(res => {
                this.showSpinner = false;
            });
        },
	    addWebAuthKey() {
            console.log('addWebAuthKey');
            this.showWebAuthSetup = true;
        },
        removeWebAuthKey(webAuthKey) {
            let that = this;
            this.confirmRemoveWebAuthKey(webAuthKey.credentialId,
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
            console.log('deleteWebAuthKey credentialId:' + webAuthKey.credentialId);
            let that = this;
            this.showSpinner = true;
            let credentialId = webAuthKey.credentialId;
            this.context.network.account.deleteSecondFactor(this.context.username, credentialId, this.context.signer).thenApply(res => {
                let index = that.webAuthKeys.findIndex((v) => v.credentialId === webAuthKey.credentialId);
                if (index > -1) {
                    that.webAuthKeys.splice(index, 1);
                }
                that.showSpinner = false;
            });
        },
        confirmRemoveWebAuthKey(credentialId, replaceFunction, cancelFunction) {
            this.confirm_message = 'Remove Web Auth Key: ' + credentialId;
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
        totp_confirmed_func(credentialId) {
            console.log('totp_confirmed_func');
            this.totpKey.push({credentialId: credentialId});
        },
        webauth_confirmed_func(webAuth) {
            console.log('webauth_confirmed_func');
            this.webAuthKeys.push(webAuth);
        },
    },
};
</script>
<style>
</style>