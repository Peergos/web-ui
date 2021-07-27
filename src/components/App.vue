<template>
	<div class="layout">
		<!-- modals -->
		<component :is="currentModal"></component>

		<!-- navigation -->
		<AppSidebar v-if="userIsLoggedIn"/>

		<!-- mobile menu trigger -->
		<AppButton
			v-if="userIsLoggedIn"
			class="toggle-button--mobile mobile"
			size="small"
			round
			@click="toggleSidebar"
		>
			<AppIcon icon="dots-menu" />
		</AppButton>

		<!-- needs restyle -->
		<section v-if="isSecretLink">
			<AppIcon icon="logo-full" class="sprite-test"/>
			<h2>Loading secret link...</h2>
		</section>

		<section class="login-register" v-if="!userIsLoggedIn">
			<AppIcon icon="logo-full" class="sprite-test"/>

			<AppTabs>
				<AppTab title="Login">
					<Login/>
				</AppTab>
				<AppTab title="Signup">

					<Signup
						:token="token"
					/>

				</AppTab>
			</AppTabs>
			<p class="demo--warning" v-if="isDemo">
				<strong>WARNING:</strong> This is a demo server and all data will be occasionally cleared. If you want to create a <i>permanent</i> account, please go to our <a class="line" href="https://alpha.peergos.net?signup=true">alpha network</a>
			</p>
		</section>


		<!-- Main view container -->
		<main class="content" :class="{ 'sidebar-margin': isSidebarOpen }">

			<!-- App views (pages) ex-filesystem-->
			<transition name="fade" mode="out-in">

				<!-- :initContext="data.context" -->
				<component
					v-if="userIsLoggedIn"
					:is="currentView"
					:initPath="data.initPath"
					:initiateDownload="data.download"
					:openFile="data.open">
				</component>
			</transition >

			<!-- <filesystem
				v-if="view=='filesystem'"
				:initContext="data.context"
				:newsignup="data.signup"
				:initPath="data.initPath"
				:initiateDownload="data.download"
				:openFile="data.open"
			>
			</filesystem> -->
		</main>

	</div>
</template>

<script>
const AppSidebar = require("./sidebar/AppSidebar.vue");
const ModalSpace = require("./modal/ModalSpace.vue");
const AppTab = require("./tabs/AppTab.vue");
const AppTabs = require("./tabs/AppTabs.vue");

const Login = require("./Login.vue");
const Signup = require("./Signup.vue");

const Calendar = require("../views/Calendar.vue");
const Drive = require("../views/Drive.vue");
const NewsFeed = require("../views/NewsFeed.vue");
const Social = require("../views/Social.vue");
const Tasks = require("../views/Tasks.vue");


var isLocalhost = window.location.hostname == "localhost";

module.exports = {
	components: {
		AppSidebar,
		ModalSpace,
		Calendar,
		Drive,
		NewsFeed,
		Social,
		Tasks,
		AppTab,
		AppTabs,
		Login,
		Signup
	},

	data() {
		return {
			isSecretLink: false,
			token: '',
		};
	},

	computed: {
		...Vuex.mapState([
			'userIsLoggedIn',
			'isDark',
			'isSidebarOpen',
			'currentModal',
			'currentView',
			'crypto',
			'network',
			'userContext'
		]),
		...Vuex.mapGetters([
			'currentTheme',
		]),
		isDemo() {
			// return this.demo == true && this.isSecretLink === false;
			return window.location.hostname == "demo.peergos.net";
		}
	},

	watch: {
		network(newNetwork) {
			this.isFirefox =
				navigator.userAgent.toLowerCase().indexOf("firefox") > -1;
			this.isSafari =
				/constructor/i.test(window.HTMLElement) ||
				(function (p) {
					return p.toString() === "[object SafariRemoteNotification]";
				})(!window["safari"] || safari.pushNotification);
			var that = this;
			const href = window.location.href;
			var fragment = window.location.hash.substring(1);
			var props = {};
			try {
				props = fragmentToProps(fragment);
			} catch (e) {
				if (fragment.length > 0) {
					// support legacy secret links
					props.secretLink = true;

					var query = fragment.indexOf("?");
					if (query > 0) {
						if (fragment.indexOf("download=true") > 0)
							props.download = true;
						if (fragment.indexOf("open=true") > 0)
							props.open = true;
						fragment = fragment.substring(0, query);
					}
					props.link = fragment;
				}
			}
			if (href.includes("?signup=true")) {
				if (href.includes("token=")) {
					var urlParams = new URLSearchParams(window.location.search);
					this.token = urlParams.get("token");
					console.log(this.token, 'this.token 1')
				}
				// this.signup({ token: this.token, username: "" });
				console.log(this.token, 'this.token 2')
			} else if (props.secretLink) {
				// this is a secret link
				console.log("Navigating to secret link...");
				this.gotoSecretLink(props);
			} // else this.login();
			this.checkIfDomainNeedsUnblocking();
		},
	},

	created() {
		this.$store.commit('SET_CRYPTO', peergos.shared.Crypto.initJS() )
		this.updateNetwork();
	},

	mounted() {
		let localTheme = localStorage.getItem("theme");
		document.documentElement.setAttribute("data-theme", localTheme);

		this.$store.commit("SET_THEME", localTheme == "dark-mode");
	},

	methods: {
		toggleTheme() {
			this.$store.commit("TOGGLE_THEME");

			document.documentElement.setAttribute(
				"data-theme",
				this.currentTheme
			);
			localStorage.setItem("theme", this.currentTheme);
		},

		toggleSidebar() {
			this.$store.commit("TOGGLE_SIDEBAR");
		},

		// login(data) {
		// 	// this.currentView = "login";
		// 	// this.$store.commit("CURRENT_VIEW", 'login');
		// 	this.data = data;
		// },
		// signup(data) {
		// 	// this.currentView = "signup";
		// 	// this.$store.commit("CURRENT_VIEW", 'signup');
		// 	this.data = data;
		// },

		// filesystem(data) {
		// 	console.log(data)
		// 	// this.currentView = "Drive";
		// 	this.data = data;
		// },

		updateNetwork() {
			let that = this;
			peergos.shared.NetworkAccess.buildJS(
				"QmVdFZgHnEgcedCS2G2ZNiEN59LuVrnRm7z3yXtEBv2XiF",
				!isLocalhost
			).thenApply(function (network) {
				// that.network = network;
				that.$store.commit("SET_NETWORK", network);
			});
		},
		checkIfDomainNeedsUnblocking() {
			if (this.network == null) return;
			var that = this;
			this.network.otherDomain().thenApply(function (domainOpt) {
				if (domainOpt.isPresent()) {
					var req = new XMLHttpRequest();
					var url = domainOpt.get() + "notablock";
					req.open("GET", url);
					req.responseType = "arraybuffer";
					req.onload = function () {
						console.log("S3 test returned: " + req.status);
					};

					req.onerror = function (e) {
						that.$toast.error(
							'Please unblock the following domain for Peergos to function correctly: ' + domainOpt.get()
						)
					};

					req.send();
				}
			});
		},

		// still need to check this
		gotoSecretLink(props) {
			var that = this;
			this.isSecretLink = true;
			peergos.shared.user.UserContext.fromSecretLink(
				props.link,
				that.network,
				that.crypto
			)
			.thenApply(function (context) {
				that.data = {
					context: context,
					download: props.download,
					open: props.open,
					initPath: props.path,
				};
				// that.currentView = "filesystem";
				this.$store.commit("CURRENT_VIEW", 'filesystem');
				that.isSecretLink = false;
			})
			.exceptionally(function (throwable) {
				that.$toast.error('Secret link not found! Url copy/paste error?')
			});
		},
	},
};
</script>

<style>
#app {
	position: relative;
	top: 0;
	min-height: 100vh;
	text-align: center;
}


.icon.sprite-test{
	display: block;
	width:200px;
	height: 48px;
	margin: var(--app-margin) auto;
}


.toggle-button--mobile {
	background-color: var(--bg-2) !important;
	position: fixed;
	top: 16px;
	right: 16px;
	opacity: 1;
}
.toggle-button--mobile svg {
	width: 24px;
	height: 24px;
}

section.login-register{
	min-height: 100vh;
	padding: var(--app-margin);
	background-color: var(--bg-2);
}

section.login-register .demo--warning{
	padding: 0 var(--app-margin) var(--app-margin);
	max-width:400px;
	margin: 0 auto;
	color: var(--color);
	background-color: var(--bg);
	text-align: left;
}

main.content{
	position: absolute;
	right:0;
	top:100px;
	width: calc(100% - 96px);
}

main.content.sidebar-margin {
	/* margin-left: 256px; */
	width: calc(100% - 240px);
}
</style>
