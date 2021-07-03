<template>
	<div class="layout">
		<AppSidebar v-if="view == 'filesystem'" />

		<AppButton
			class="toggle-button--mobile mobile"
			size="small"
			round
			@click="toggleSidebar"
		>
			<AppIcon icon="dots-menu" />
		</AppButton>
		<div v-if="isSecretLink">
			<h2>Peergos</h2>
			<center>
				<img
					src="images/logo.png"
					alt="Peergos logo"
					class="image"
				/>
			</center>
			<h2>Loading secret link...</h2>
		</div>

		<login
			v-if="view=='login'"
			:network="network"
			@signup="signup"
			@filesystem="filesystem"
		>
   		</login>
		<signup
			v-if="view=='signup'"
			@filesystem="filesystem"
			:initialUsername="data.username"
			:password1="data.password1"
			:token="data.token"
			:crypto="crypto"
			:network="network"
		>
		</signup>

		<main class="content" :class="{ 'sidebar-margin': isSidebarOpen }">

			<filesystem
				v-if="view=='filesystem'"
				:initContext="data.context"
				:newsignup="data.signup"
				:initPath="data.initPath"
				:initiateDownload="data.download"
				:openFile="data.open"
			>
			</filesystem>
		</main>
		<error
			v-if="showError"
			@hide-error="showError = false"
			:title="errorTitle"
			:body="errorBody"
		>
		</error>

	</div>
</template>

<script>
const AppSidebar = require("./sidebar/AppSidebar.vue");

var isLocalhost = window.location.hostname == "localhost";

module.exports = {
	components: {
		AppSidebar,
	},

	data() {
		return {
			view:"",
			network: null,
			isSecretLink: false,
			token: "",
			showError: false,
			errorTitle: "",
			errorBody: "",
			data: {
				context: null,
			},
		};
	},

	computed: {
		...Vuex.mapState([
			'isDark',
			'isSidebarOpen',
		]),
		...Vuex.mapGetters([
			'currentTheme',
		]),
		crypto() {
			return peergos.shared.Crypto.initJS();
		},
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
				}
				this.signup({ token: this.token, username: "" });
			} else if (props.secretLink) {
				// this is a secret link
				console.log("Navigating to secret link...");
				this.gotoSecretLink(props);
			} else this.login();
			this.checkIfDomainNeedsUnblocking();
		},
	},

	mounted() {
		let localTheme = localStorage.getItem("theme");
		document.documentElement.setAttribute("data-theme", localTheme);

		this.$store.commit("SET_THEME", localTheme == "dark-mode");
	},

	created() {
		this.updateNetwork();
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

		login(data) {
			this.view = "login";
			this.data = data;
		},
		signup(data) {
			this.view = "signup";
			this.data = data;
		},
		filesystem(data) {
			this.view = "filesystem";
			this.data = data;
		},
		updateNetwork() {
			var that = this;
			peergos.shared.NetworkAccess.buildJS(
				"QmVdFZgHnEgcedCS2G2ZNiEN59LuVrnRm7z3yXtEBv2XiF",
				!isLocalhost
			).thenApply(function (network) {
				that.network = network;
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
						that.errorTitle = "Unblock domain";
						that.errorBody =
							"Please unblock the following domain for Peergos to function correctly: " +
							domainOpt.get();
						that.showError = true;
					};

					req.send();
				}
			});
		},
		gotoSecretLink(props) {
			var that = this;
			this.isSecretLink = true;
			peergos.shared.user.UserContext.fromSecretLink(
				props.link,
				this.network,
				that.crypto
			)
			.thenApply(function (context) {
				that.data = {
					context: context,
					download: props.download,
					open: props.open,
					initPath: props.path,
				};
				that.view = "filesystem";
				that.isSecretLink = false;
			})
			.exceptionally(function (throwable) {
				that.errorTitle = "Secret link not found!";
				that.errorBody = "Url copy/paste error?";
				that.showSpinner = false;
				that.showError = true;
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
