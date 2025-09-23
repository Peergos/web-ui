<template>
	<div class="app-login" v-if="!autoLoggingIn">
		<input
			type="text"
			autofocus
			name="username"
			v-model="username"
			:placeholder="translate('LOGIN.USERNAME')"
			ref="username"
			@input="(val) => (username = username.toLowerCase())"
		/>
        <MultiFactorAuth
                v-if="showMultiFactorAuth"
                v-on:hide-confirm="showMultiFactorAuth = false"
                :mfaMethods="mfaMethods"
                :challenge="challenge"
                :consumer_cancel_func="consumer_cancel_func"
                :consumer_func="consumer_func">
        </MultiFactorAuth>
		<FormPassword v-model="password" :placeholder="translate('LOGIN.PASSWORD')" @keyup.native.enter="login()"/>

        <label class="checkbox__group">
            {{ translate('LOGIN.STAY') }}
            <input
                type="checkbox"
                name="stayLoggedIn"
                v-model="stayLoggedIn"
            />
            <span class="checkmark"></span>
        </label>

		<AppButton :disabled="isLoggingIn" class="login" @click.native="login()" type="primary" block accent  icon="arrow-right">
			{{ translate('LOGIN.BUTTON') }}
		</AppButton>
	</div>
</template>

<script>
const AppButton = require("AppButton.vue");
const FormPassword = require("./form/FormPassword.vue");
const MultiFactorAuth = require("./auth/MultiFactorAuth.vue");
const routerMixins = require("../mixins/router/index.js");
const UriDecoder = require('../mixins/uridecoder/index.js');
const i18n = require("../i18n/index.js");

module.exports = {
	components: {
    	AppButton,
		FormPassword,
		MultiFactorAuth,
	},
	data() {
		return {
			username: '',
            password: [],
			passwordIsVisible: false,
			demo: true,
            stayLoggedIn: false,
            isLoggingIn: false,
            autoLoggingIn: true,
            showMultiFactorAuth: false,
		};
	},
	computed: {
		...Vuex.mapState([
			'crypto',
			'network',
			'context'
		]),
		...Vuex.mapGetters([
			'isSecretLink',
		]),
	},
	mixins:[routerMixins, UriDecoder, i18n],

	mounted() {
                setTimeout(() => this.autoLogin(), 0);
                if (this.$refs.username != null)
                    this.$refs.username.focus()
	},
	methods: {
		...Vuex.mapActions([
			'updateSocial'
		]),
		autoLogin() {
		    // bypass login on DEV
			if (this.network == null) {
				setTimeout(() => this.autoLogin(), 100);
				return;
			}
			let devLogin = false;
		    if( window.location.hostname == "localhost"){
				var query = new URLSearchParams(window.location.search)
				this.username = query.get("username")
				if (this.username != null) {
				    this.password = query.get("password")
				    devLogin = true;
				    this.login()
				}
		    }
		    if (!devLogin) {
                const creationStart = Date.now();
                const that = this;
                getRootKeyEntryFromCacheProm().thenApply(function (rootKeyPair) {
                    if (rootKeyPair != null) {
                        let loginRoot = peergos.shared.crypto.symmetric.SymmetricKey.fromByteArray(rootKeyPair.rootKey);
                        directGetEntryDataFromCacheProm(rootKeyPair.username).thenApply(function (entryPoints) {
                            if (entryPoints == null) {
                                that.$toast.error("Legacy accounts can't stay logged in. Please change your password to upgrade your account", {timeout:false, id: 'login'});
                                that.autoLoggingIn = false;
                            } else {
                                that.isLoggingIn = true;
                                let entryData = peergos.shared.user.UserStaticData.fromByteArray(entryPoints);
                                peergos.shared.user.UserContext.restoreContext(rootKeyPair.username, loginRoot, entryData,
                                    that.network, that.crypto, { accept: (x) => (that.$toast.info(x,{ id: 'login' })) }
                                ).thenApply(function (context) {
                                      that.postLogin(creationStart, context);
                                })
                                .exceptionally(function (throwable) {
                                    that.isLoggingIn = false;
                                    that.autoLoggingIn = false;
                                    that.$toast.error(that.uriDecode(throwable.getMessage()), {timeout:false, id: 'login'})
                                });
                            }
                        });
                    } else {
                        that.autoLoggingIn = false;
                    }
                });
            }
		},
		togglePassword() {
			this.passwordIsVisible = !this.passwordIsVisible
		},
		login() {
		    if (this.isLoggingIn) {
		        return;
		    }
			const creationStart = Date.now();
			const that = this;
            this.isLoggingIn = true;

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
			peergos.shared.user.UserContext.signIn(
				that.username,
				that.password,
			        mfaReq => handleMfa(mfaReq),
                                that.stayLoggedIn,
                                false,
				that.network,
				that.crypto,
				// { accept: (x) => (that.spinnerMessage = x) }
				 { accept: (x) => (that.$toast.info(x,{ id: 'login', timeout:false })) }
				)
				.thenApply(function (context) {
                    that.postLogin(creationStart, context);
				})
				.exceptionally(function (throwable) {
                    that.isLoggingIn = false;
                    if (throwable.getMessage().startsWith('Invalid+TOTP+code')) {
                        that.$toast.error('Invalid Multi Factor Authenticator code', {timeout:false, id: 'login'})
                    } else {
					    that.$toast.error(that.uriDecode(throwable.getMessage()), {timeout:false, id: 'login'})
					}
				});
		},
		postLogin(creationStart, context) {
			const that = this;
			this.isLoggingIn = false;
            that.$toast.dismiss('login');

            that.$store.commit('SET_CONTEXT', context);

            that.$store.commit('CURRENT_VIEW', that.appFromUrl());

            that.$store.commit('USER_LOGIN', true);

            const props = this.getPropsFromUrl();
            if (props != null && props.path!= null)
               that.$store.commit('SET_PATH', props.path.split("/").filter(n => n.length > 0));
            if (props != null && props.download != null)
               that.$store.commit('SET_DOWNLOAD', props.download);
            if (props != null && props.open != null)
               that.$store.commit('SET_OPEN', props.open);

            that.$emit("initApp")

            // that.$store.commit('CURRENT_MODAL', 'ModalTour');

            console.log("Signing in/up took " + (Date.now()-creationStart)+" mS from function call");
            if (that.stayLoggedIn) {
                let rootKey = context.rootKey.toByteArray();
                setRootKeyIntoCacheProm(context.username, rootKey).thenApply(function (isSupported) {
                    if (isSupported) {
                        console.log("Offline support enabled");
                    } else {
                        console.log("Offline support not available");
                    }
                });
            }
		},
		appFromUrl(){
			const props = this.getPropsFromUrl();
			const app = props == null || props.app == null ? null : props.app;
			console.log('login app:', app)
			const driveApps = [null, 'Gallery', 'pdf', 'editor', 'hex', 'markdown', 'markup', 'timeline', 'htmlviewer']

			return driveApps.includes(app)
				? 'Drive'
				: app
		}
	}

};
</script>
<style>
.login-register .tab{
	padding: calc(var(--app-margin) / 2);
}

.login-register .login{
	margin-top: 8px;
}

.login-register input[name="username"]{
	text-transform:lowercase;
}

.app-login .demo--warning{
	text-align: left;
	margin-top: var(--app-margin);
}
</style>
