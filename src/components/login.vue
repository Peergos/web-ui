<template>
	<div class="app-login">
		<div>
			<input
				type="text"
				autofocus
				name="username"
				v-model="username"
				placeholder="Username"
			/>
			<div class="password__wrapper">
				<input
					:type="passwordIsVisible ? 'text' : 'password'"
					name="password"
					class="password"
					v-model="password"
					placeholder="Password"
					v-on:keyup.enter="login()"
				/>

				<AppButton class="eye" @click="togglePassword()">
					<AppIcon v-show="passwordIsVisible" icon="eye-open"/>
					<AppIcon v-show="!passwordIsVisible" icon="eye-closed"/>
				</AppButton>
			</div>

			<AppButton class="login" @click="login()" :icon="true">
				Sign in
				<AppIcon :width="24" :height="24" icon="arrow-right"/>
			</AppButton>
		</div>


		<div class="alert alert-danger" v-if="displayDemoWarning()">
			<p>
				<strong>WARNING:</strong>This is a demo server and all data will
				be occasionally cleared.
			</p>
			<p>
				If you want to create a <i>permanent</i> account, please go to
				our
				<a href="https://alpha.peergos.net?signup=true"
					>alpha network</a
				>
			</p>
		</div>
	</div>
</template>

<script>
var isDemo = window.location.hostname == "demo.peergos.net";
module.exports = {
	props: ["network"],

	data() {
		return {
			username: "",
			password: [],
			passwordIsVisible: false,
			token: "",
			demo: isDemo,
		};
	},
	computed: {
		crypto: function () {
			return peergos.shared.Crypto.initJS();
		},
	},

	methods: {
		togglePassword() {
			this.passwordIsVisible = !this.passwordIsVisible
		},
		showToast() {
			this.$toast.success("I'm a toast!")
    	},

		lowercaseUsername() {
			return this.username.toLocaleLowerCase();
		},

		displayDemoWarning() {
			if (this.demo == true) {
				if (this.isSecretLink == true) {
					return false;
				}
				return true;
			} else {
				return false;
			}
		},

		login() {
			const creationStart = Date.now();
			const that = this;

			return peergos.shared.user.UserContext.signIn(
				that.lowercaseUsername(),
				that.password,
				that.network,
				that.crypto,
				// { accept: (x) => (that.spinnerMessage = x) }
				 { accept: (x) => (that.$toast.error(x)) }

				)
				.thenApply(function (context) {
					console.log("Switching to Drive");
					console.log(context);

					that.$emit("filesystem", { context: context });
					console.log(
						"Signing in/up took " +
							(Date.now() - creationStart) +
							" mS from function call"
					);
					that.$emit("hide-login");
				})
				.exceptionally(function (throwable) {
					that.$toast.error(throwable.getMessage())
				});
		},
	},

};
</script>
<style>


.app-login input {
	width:100%;
	margin: 8px 0;
	padding: 0 16px;

	font-size: var(--text);
	text-transform: lowercase;
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
.app-login input:focus,
.app-login input:active,
.app-login input:focus-visible{
	outline:none;
	border: 2px solid var(--green-500)!important;
}
/* TODO: quick reset, we shopuld properly remove other styles */
.app-login input:-webkit-autofill,
.app-login input:-webkit-autofill:hover,
.app-login input:-webkit-autofill:focus,
.app-login input:-webkit-autofill:active,
.app-login input:focus,
.app-login input:active,
.app-login input:focus-visible{
	color:var(--color);
	font-size: var(--text);
	box-shadow:none;
	-webkit-text-fill-color: var(--color);
	-webkit-box-shadow:0 0 0 30px var(--bg-2) inset;
	border-color: var(--bg-2);
}

.app-login input[name="username"]{
	text-transform:lowercase;
}

.app-login .password__wrapper {
	margin: 16px 0;
	position: relative;
}
.app-login .password__wrapper input{
	padding-right: 50px;
}
.app-login .password__wrapper .eye{
	position: absolute;
	right:4px;
	top:14px;
}
.app-login .password__wrapper .eye:focus{
	outline:none;
	background-color: var(--bg-2);
}
.app-login .login{
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
</style>