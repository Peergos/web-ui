<template>
	<div class="app-login pg-auth" v-if="!autoLoggingIn">
		<FormUsername v-model="username" :placeholder="translate('LOGIN.USERNAME')" autocomplete="username" @keyup.enter="login()"/>
		<MultiFactorAuth
			v-if="showMultiFactorAuth"
			v-on:hide-confirm="showMultiFactorAuth = false"
			:mfaMethods="mfaMethods"
			:challenge="challenge"
			:consumer_cancel_func="consumer_cancel_func"
			:consumer_func="consumer_func">
		</MultiFactorAuth>
		<FormPassword v-model="password" :placeholder="translate('LOGIN.PASSWORD')" @keyup.enter="login()"/>

		<label class="pg-check">
			<input type="checkbox" name="stayLoggedIn" v-model="stayLoggedIn"/>
			<span>{{ translate('LOGIN.STAY') }}</span>
		</label>

		<p class="pg-auth__hint" v-if="network == null && !networkLoading && isLocalhost">
			{{ translate(networkRetrying ? 'LOGIN.SERVER.RETRYING' : 'LOGIN.SERVER.CONFIGURE_FIRST') }}
		</p>
		<button type="button" class="pg-btn pg-btn--primary" :disabled="isLoggingIn || network == null" @click="login()">
			{{ translate('LOGIN.BUTTON') }}
		</button>
	</div>
</template>

<script>
const FormPassword = require("./form/FormPassword.vue");
const FormUsername = require("./form/FormUsername.vue");
const MultiFactorAuth = require("./auth/MultiFactorAuth.vue");
const routerMixins = require("../mixins/router/index.js");
const UriDecoder = require('../mixins/uridecoder/index.js');
const loopback = require("../mixins/loopback/index.js");
const i18n = require("../i18n/index.js");

module.exports = {
	components: {
		FormPassword,
		FormUsername,
		MultiFactorAuth,
	},
	data() {
		return {
			username: '',
            password: '',
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
			'networkLoading',
			'networkRetrying',
			'context'
		]),
		...Vuex.mapGetters([
			'isSecretLink',
		]),
		isLocalhost() {
			return loopback.isLoopbackHost(window.location.hostname);
		},
	},
	watch: {
		network(newNetwork) {
			if (newNetwork != null) {
				setTimeout(() => this.autoLogin(), 0);
			}
		},
	},
	mixins:[routerMixins, UriDecoder, i18n],

	mounted() {
                setTimeout(() => this.autoLogin(), 0);
	},
	methods: {
		...Vuex.mapActions([
			'updateSocial'
		]),
		autoLogin() {
		    // bypass login on DEV
			if (this.network == null) {
				this.autoLoggingIn = false;
				return;
			}
			let devLogin = false;
		    if (loopback.isLoopbackHost(window.location.hostname)) {
				var query = new URLSearchParams(window.location.search)
				let queryUsername = query.get("username")
				if (queryUsername != null) {
				    this.username = queryUsername
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
                                that.$toast.error("Couldn't stay logged in - please sign in again", {timeout:false, id: 'login'});
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
		login() {
		    if (this.isLoggingIn) {
		        return;
		    }
		    if (this.network == null) {
		        this.$toast.error(this.translate("LOGIN.SERVER.NETWORK"), {timeout:false, id: 'login'});
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
            context.ensureCurrentHost();
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
.login-register input[name="username"] {
	text-transform: lowercase;
}
</style>
