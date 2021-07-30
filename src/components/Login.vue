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

		<AppButton class="login" @click="login()" :icon="true">
			Sign in
			<AppIcon :width="24" :height="24" icon="arrow-right"/>
		</AppButton>
	</div>
</template>

<script>
const FormPassword = require("./form/FormPassword.vue");

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
			'network'
		]),
	},
	mounted() {
		this.$refs.username.focus()
	},
	methods: {
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

					console.log("Switching to Drive");
					that.$store.commit("CURRENT_VIEW", 'Drive');
					that.$store.commit("SET_USER_CONTEXT", context);
					that.$store.commit('USER_LOGIN', true);
					// that.$emit("filesystem", { context: context });
					console.log("Signing in/up took " + (Date.now()-creationStart)+" mS from function call");
				})
				.exceptionally(function (throwable) {
					that.$toast.error(throwable.getMessage(), {timeout:false, id: 'login'})
				});
		},
	}

};
</script>
<style>
.login-register .tab{
	padding: calc(var(--app-margin) / 2);
}

.login-register input[type=text],
.login-register input[type=password] {
	width:100%;
	margin: 8px 0;
	padding: 0 16px;

	font-size: var(--text);
	/* text-transform: lowercase; */
	line-height: 48px;
	border-radius: 4px;

	-webkit-appearance:none;
    -moz-appearance:none;
    appearance: none;

	outline: none;
	box-shadow: none;

	border: 2px solid var(--green-500);
	color: var(--color);
    background-color: var(--bg) ;
}
.login-register input:focus,
.login-register input:active,
.login-register input:focus-visible{
	outline:none;
	border: 2px solid var(--green-500)!important;
}
/* TODO: quick reset, we shopuld properly remove other styles */
.login-register input:-webkit-autofill,
.login-register input:-webkit-autofill:hover,
.login-register input:-webkit-autofill:focus,
.login-register input:-webkit-autofill:active,
.login-register input:focus,
.login-register input:active,
.login-register input:focus-visible{
	color:var(--color);
	font-size: var(--text);
	box-shadow:none;
	-webkit-text-fill-color: var(--color);
	-webkit-box-shadow:0 0 0 30px var(--bg-2) inset;
	border-color: var(--bg-2);
}

.login-register input[name="username"]{
	text-transform:lowercase;
}


.login-register .login{
	width:100%;
	line-height: 48px;
	background-color: var(--green-500);
	text-align: center;
	color: var(--bg);
}

.app-login .login:hover{
	color: var(--bg);
	background-color: var(--green-200);
}

.app-login .login:focus{
	outline:none;
	background-color: var(--color-hover);
}

.app-login .demo--warning{
	text-align: left;
	margin-top: var(--app-margin);
}
</style>