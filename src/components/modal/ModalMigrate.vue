<template>
	<AppModal>
		<template #header>
			<h2>{{ translate("MIGRATE.TITLE") }}</h2>
		</template>
		<template #body>
            <MultiFactorAuth
                    v-if="showMultiFactorAuth"
                    v-on:hide-confirm="showMultiFactorAuth = false"
                    :mfaMethods="mfaMethods"
                    :challenge="challenge"
                    :consumer_cancel_func="consumer_cancel_func"
                    :consumer_func="consumer_func">
            </MultiFactorAuth>
			<p>{{ translate("MIGRATE.ACCOUNT.TEXT1") }}</p>
                        <p v-if="false">Migration ID: <button class="fa fa-clipboard" style="padding: 6px 12px; background-color:var(--bg);" @click="copyIdToClipboard($event)">&nbsp;{{ translate("MIGRATE.ID.COPY") }}</button> {{ migrationid }}</p>
                        <p v-if="!isHome">Mirror status: {{ mirrorStatus }}</p>

                        <p v-if="isHome">{{ translate("MIGRATE.HOME") }}</p>
			<FormPassword v-if="!isHome" v-model="password" />

			<div class="modal__warning account" v-if="warning">
				<p><AppIcon icon="warning"/>{{ translate("MIGRATE.ACCOUNT.CONFIRM") }}</p>
				<AppButton @click.native="migrateAccount()" accent >{{ translate("MIGRATE.ACCOUNT.YES") }}</AppButton>
				<AppButton @click.native="warning=false">{{ translate("MIGRATE.ACCOUNT.CANCEL") }}</AppButton>
			</div>

		</template>
		<template #footer>
                         <AppButton v-if="!isHome" @click.native="mirrorHere()" type="primary" block accent>{{ translate("MIGRATE.MIRROR") }}</AppButton>
                         <br/>
                         <AppButton v-if="!isHome" @click.native="mirrorLoginHere()" type="primary" block accent>{{ translate("MIGRATE.MIRROR.LOGIN") }}</AppButton>
                         <br/>
			 <AppButton v-if="!isHome" @click.native="showWarning()" type="primary" block accent>{{ translate("MIGRATE.ACCOUNT") }}</AppButton>

		</template>
	</AppModal>
</template>

<script>
const AppButton = require("../AppButton.vue");
const AppModal = require("AppModal.vue");
const AppIcon = require("../AppIcon.vue");
const FormPassword = require("../form/FormPassword.vue");
const MultiFactorAuth = require("../auth/MultiFactorAuth.vue");
const UriDecoder = require('../../mixins/uridecoder/index.js');
const i18n = require("../../i18n/index.js");

module.exports = {
	components: {
	    AppButton,
	    AppModal,
	    AppIcon,
		FormPassword,
		MultiFactorAuth,
	},
        mixins:[UriDecoder, i18n],
	data() {
		return {
			password: "",
			warning: false,
                        showMultiFactorAuth: false,
                        isHome: true,
                        migrationid:"",
                        localUsage:0,
                        homeUsage:0
		};
	},
	computed: {
		...Vuex.mapState([
			'context'
		]),
                mirrorStatus() {
                    if (this.homeUsage == 0)
                        return "N/A";
                    return (this.localUsage * 100 / this.homeUsage).toPrecision(3) + "%";
                }
        },
        mounted() {
                var that = this;
                this.context.isHome().thenApply(res => that.isHome = res);
                this.context.getMigrationId().thenApply(res => that.migrationid = res);
                this.context.getSpaceUsage(false).thenApply(usage => that.homeUsage = usage.value_0);
                this.context.getSpaceUsage(true).thenApply(usage => that.localUsage = usage.value_0);
        },

	methods: {
		showWarning() {
		    if(this.password.length == 0) {
			this.$toast.error(this.translate("MIGRATE.ACCOUNT.PASS"),{timeout:false, position: 'bottom-left' })
		    } else {
			this.warning = true
		    }
		},
                copyIdToClipboard: function (clickEvent) {
                    navigator.clipboard.writeText(this.migrationid).then(function() {}, function() {
                        console.error("Unable to write to clipboard.");
                    });
                },

                mirrorHere() {
                    var that = this;
                    this.context.mirrorOnThisServer(java.util.Optional.empty(), progress => {}).thenApply(function(result){
		        that.$toast(that.translate("MIGRATE.MIRROR.DONE"),{position: 'bottom-left' })
                    }).exceptionally(function(throwable) {
                        that.$toast.error(that.uriDecode(throwable.getMessage()), {timeout:false})
                        console.log(throwable.getMessage())
                    });
                },

                mirrorLoginHere() {
                    var that = this;
                    let handleMfa = function(mfaReq) {
                        let future = peergos.shared.util.Futures.incomplete();
                        let mfaMethods = mfaReq.methods.toArray([]);
                        that.challenge = mfaReq.challenge;
                        that.mfaMethods = mfaMethods;
                        that.consumer_func = (credentialId, resp) => {
                            that.showMultiFactorAuth = false;
                            future.complete(resp);
                        };
                        that.consumer_cancel_func = (credentialId) => {
                            that.showMultiFactorAuth = false;
                            let resp = peergos.client.JsUtil.generateAuthResponse(credentialId, '');
                            future.complete(resp);
                        }
                        that.showMultiFactorAuth = true;
                        return future;
                    };
                    this.context.mirrorLoginData(this.password, mfaReq => handleMfa(mfaReq), progress => {}).thenApply(function(result){
		        that.$toast(that.translate("MIGRATE.MIRROR.LOGIN.DONE"),{position: 'bottom-left' })
                    }).exceptionally(function(throwable) {
                        that.$toast.error(that.uriDecode(throwable.getMessage()), {timeout:false})
                        console.log(throwable.getMessage())
                    });
                },

		migrateAccount() {
                    var that = this;
                    let handleMfa = function(mfaReq) {
                        let future = peergos.shared.util.Futures.incomplete();
                        let mfaMethods = mfaReq.methods.toArray([]);
                        that.challenge = mfaReq.challenge;
                        that.mfaMethods = mfaMethods;
                        that.consumer_func = (credentialId, resp) => {
                            that.showMultiFactorAuth = false;
                            future.complete(resp);
                        };
                        that.consumer_cancel_func = (credentialId) => {
                            that.showMultiFactorAuth = false;
                            let resp = peergos.client.JsUtil.generateAuthResponse(credentialId, '');
                            future.complete(resp);
                        }
                        that.showMultiFactorAuth = true;
                        return future;
                    };
                    this.context.migrateToThisServer(this.password, mfaReq => handleMfa(mfaReq)).thenApply(function(result){
		        that.$toast(that.translate("MIGRATE.ACCOUNT.DONE"),{position: 'bottom-left' })
		        that.$store.commit("SET_MODAL", false);
                    }).exceptionally(function(throwable) {
                        if (throwable.getMessage().startsWith('Invalid+TOTP+code')) {
                            that.$toast.error(that.translate("MIGRATE.ACCOUNT.MFA"), {timeout:false})
                        } else {
                            that.$toast.error(that.uriDecode(throwable.getMessage()), {timeout:false})
                        }
                    console.log(throwable.getMessage())
                });
            },
	},
};
</script>
<style>
.modal__warning {
	background-color: var(--bg-2);
	border-radius: 4px;
	padding: 16px;
}
.modal__warning.account p {
	margin-bottom: var(--app-margin);
}
</style>
