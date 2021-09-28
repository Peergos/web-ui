<template>
	<div class="app-login">
		<input
			type="text"
			autofocus
			name="username"
			v-model="username"
			placeholder="Username"
			ref="username"
			@input="(val) => (username = username.toLowerCase())"
		/>

		<FormPassword v-model="password" @keyup.native.enter="login()"/>

		<AppButton class="login" @click.native="login()" type="primary" block accent  icon="arrow-right">
			Sign in
		</AppButton>
	</div>
</template>

<script>
const FormPassword = require("./form/FormPassword.vue");
const routerMixins = require("../mixins/router/index.js");
const UriDecoder = require('../mixins/uridecoder/index.js');

module.exports = {
	components: {
		FormPassword,
	},
	data() {
		return {
			username: '',
			password: [],
			passwordIsVisible: false,
			demo: true,
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
	mixins:[routerMixins, UriDecoder],

	mounted() {
		this.$refs.username.focus()
		// :)
		setTimeout(() => this.loginDEV(), 0);
	},
	methods: {
		...Vuex.mapActions([
			'updateSocial'
		]),
		loginDEV() {
		    // bypass login on DEV
			if (this.network == null) {
				setTimeout(() => this.loginDEV(), 100);
				return;
			}
		    if( window.location.hostname == "localhost"){
				var query = new URLSearchParams(window.location.search)
				this.username = query.get("username")
				if (this.username == null)
					return;
				this.password = query.get("password")
				this.login()
		    }
		},
		togglePassword() {
			this.passwordIsVisible = !this.passwordIsVisible
		},
		login() {
			const creationStart = Date.now();
			const that = this;

			return peergos.shared.user.UserContext.signIn(
				that.username,
				that.password,
				that.network,
				that.crypto,
				// { accept: (x) => (that.spinnerMessage = x) }
				 { accept: (x) => (that.$toast.info(x,{ id: 'login' })) }
				)
				.thenApply(function (context) {

					that.$toast.dismiss('login');

					that.$store.commit('SET_CONTEXT', context);

					that.$store.commit('CURRENT_VIEW', that.appFromUrl());

					that.$store.commit('USER_LOGIN', true);

					that.$emit("initApp")

					that.updateSocial()

					// that.$store.commit('CURRENT_MODAL', 'ModalTour');

					console.log("Signing in/up took " + (Date.now()-creationStart)+" mS from function call");
				})
				.exceptionally(function (throwable) {
					that.$toast.error(that.uriDecode(throwable.getMessage()), {timeout:false, id: 'login'})
				});
		},
		appFromUrl(){
			const props = this.getPropsFromUrl();
			const app = props == null ? null : props.app;
			console.log('login app:', app)
			const driveApps = [null, 'Gallery', 'pdf', 'editor', 'hex', 'todo', 'timeline' ]

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
