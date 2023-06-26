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
                        <th></th>
                        <th></th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr>
                        <td>Authenticator App</td>
                        <td></td>
                        <td v-if="totpKey.length == 0"></td>
                        <td v-if="totpKey.length == 1">
                            <button class="btn btn-info" @click="editAuthenticatorApp()"> Edit </button>
                        </td>
                        <td v-if="totpKey.length == 0" >
                            <button class="btn btn-success" @click="setupAuthenticatorApp()"> Add </button>
                        </td>
                        <td v-if="totpKey.length == 1">
                            <button class="btn btn-danger" @click="removeAuthenticatorApp()"> Remove</button>
                        </td>
                    </tr>
                    <tr v-for="(webAuthKey, index) in webAuthKeys">
                        <td>SecurityKey:&nbsp;{{ webAuthKey.name }}</td>
                        <td></td>
                        <td> <button class="btn btn-danger" @click="removeWebAuthKey(webAuthKey)">Remove</button>
                        </td>
                    </tr>
                    </tbody>
                </table>
                <button class="btn btn-success" @click="addWebAuthKey()">Add Security Key</button>
            </div>
		</template>
	</AppModal>
</template>

<script>
import AppButton from "../AppButton.vue";
import AppModal from "./AppModal.vue";
import Confirm from "../confirm/Confirm.vue";
import Spinner from "../spinner/Spinner.vue";
import Totp from "../auth/Totp.vue";
import WebAuth from "../auth/WebAuth.vue";

// import Vuex from "vuex"
import { mapState } from 'vuex'

export default {
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
            showWebAuthSetup: false,
        };
    },

    computed: {
	...mapState([
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
        editAuthenticatorApp() {
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
                }
                that.showSpinner = false;
            }).exceptionally(function(throwable) {
                that.$toast.error('Unable to delete authentication method', {timeout:false});
                console.log('Unable to delete authentication method: ' + throwable);
                that.showSpinner = false;
            });
        },
	    addWebAuthKey() {
	        if (this.webAuthKeys.length + this.totpKey.length >= 10) {
                that.$toast.error('Reached maximum number of Security Keys', {timeout:false});
	        } else {
                this.showWebAuthSetup = true;
            }
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
            this.confirm_message = 'Remove Security Key: ' + name;
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
            if (success && this.totpKey.length == 0) {
                this.totpKey.push({credentialId: credentialId});
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
