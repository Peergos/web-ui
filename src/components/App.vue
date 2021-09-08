<template>
	<div class="layout">
		<!-- modals -->
		<component v-if="showModal" :is="currentModal"></component>

		<!-- navigation -->
		<AppNavigation v-if="isLoggedIn"/>

		<!-- needs restyle -->
		<section v-if="isSecretLink">
			<AppIcon icon="logo-full" class="sprite-test"/>
			<h2>Loading secret link...</h2>
		</section>

		<section class="login-register" v-if="!isLoggedIn">
			<AppIcon icon="logo-full" class="sprite-test"/>

			<AppTabs ref="tabs">
				<AppTab title="Login">
					<Login @initApp="init()"/>
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
		<section class="content" :class="{ 'sidebar-margin': isSidebarOpen }">

			<!-- App views (pages) ex-filesystem-->
			<transition name="fade" mode="out-in">
				<component
					ref="appView"
					v-if="isLoggedIn"
					:is="currentView"
					:initPath="data.initPath"
					:globalPath="path"
					:initiateDownload="data.download"
					:openFile="data.open">
				</component>
			</transition >

		</section>

	</div>
</template>

<script>
const AppNavigation = require("./navigation/AppNavigation.vue");
const ModalSpace = require("./modal/ModalSpace.vue");
const ModalPassword = require("./modal/ModalPassword.vue");
const ModalAccount = require("./modal/ModalAccount.vue");
const ModalProfile = require("./modal/ModalProfile.vue");


const AppTab = require("./tabs/AppTab.vue");
const AppTabs = require("./tabs/AppTabs.vue");

const Login = require("./Login.vue");
const Signup = require("./Signup.vue");

const Calendar = require("../views/Calendar.vue");
const Drive = require("../views/Drive.vue");
const NewsFeed = require("../views/NewsFeed.vue");
const Social = require("../views/Social.vue");
const Tasks = require("../views/Tasks.vue");


const routerMixins = require("../mixins/router/index.js");



module.exports = {
	components: {
		AppNavigation,
		ModalSpace,
		ModalPassword,
		ModalAccount,
		ModalProfile,
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
			// isSecretLink: false,
			token: '',
			data: {},
			onUpdateCompletion: [], // methods to invoke when current dir is next refreshed
		};
	},

	computed: {
		...Vuex.mapState([
			'isLoggedIn',
			'isDark',
			'isSidebarOpen',
			'showModal',
			'currentModal',
			'currentView',
			'crypto',
			'network',
			'context',
			'path'
		]),
		...Vuex.mapGetters([
			'isSecretLink',
			'getPath'
		]),
		isDemo() {
			return window.location.hostname == "demo.peergos.net" && this.isSecretLink === false
		},
		isLocalhost(){
			return window.location.hostname == "localhost"
		}
	},

	mixins:[routerMixins],


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

				this.$refs.tabs.selectTab(1)

				if (href.includes("token=")) {
					var urlParams = new URLSearchParams(window.location.search);
					this.token = urlParams.get("token");
				}
				// this.signup({ token: this.token, username: "" });
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



		window.addEventListener('hashchange', this.onUrlChange, false );

	},

	mounted() {
		let localTheme = localStorage.getItem("theme");
		document.documentElement.setAttribute("data-theme", localTheme);
		this.$store.commit("SET_THEME", localTheme == "dark-mode");

	},

	methods: {
		...Vuex.mapActions([
			'updateQuota',
			'updateUsage'
		]),

		init() {
			const that = this;
			if (this.context != null && this.context.username == null) {
				// from a secret link
				// this.context.getEntryPath().thenApply(function (linkPath) {
				// 	var path = that.initPath == null ? null : decodeURIComponent(that.initPath);
				// 	if (path != null && (path.startsWith(linkPath) || linkPath.startsWith(path))) {
				// 		that.changePath(path);
				// 	} else {
				// 		that.changePath(linkPath);
				// 		that.context.getByPath(that.getPath())
				// 			.thenApply(function (file) {
				// 				file.get().getChildren(that.context.crypto.hasher, that.context.network).thenApply(function (children) {
				// 					var arr = children.toArray();
				// 					if (arr.length == 1) {
				// 						if (that.initiateDownload) {
				// 							that.downloadFile(arr[0]);
				// 						} else if (that.openFile) {
				// 							var open = () => {
				// 								that.updateFiles(arr[0].getFileProperties().name);
				// 							};
				// 							that.onUpdateCompletion.push(open);
				// 						}
				// 					}
				// 				})
				// 			});
				// 	}
				// });
			} else {

				this.updateUsage();
				this.updateQuota();

				this.context.getPaymentProperties(false).thenApply(function (paymentProps) {
					// console.log(paymentProps,'paymentProps')
					that.$store.commit("SET_PAYMENT_PROPERTIES", paymentProps);
					// if (paymentProps.isPaid()) {
					// 	console.log('isPaid')
					// 	that.$store.commit("SET_PAYMENT_PROPERTIES", paymentProps);
					// }
					// else
					// 	that.userContext.getPendingSpaceRequests().thenApply(reqs => {
					// 		if (reqs.toArray([]).length > 0)
					// 			that.isAdmin = true;
					// });
				});
			}
			// this.showPendingServerMessages();
		},

		onUrlChange() {
			const props = this.getPropsFromUrl();

			// console.log('onUrlChange appURL:', props.app)
			// console.log('onUrlChange pathURL: ', props.path)
			// console.log('onUrlChange pathStore (prev?): ', this.getPath)
			// console.log('onUrlChange filenameURL: ', props.filename)

			const app = props == null ? null : props.app;
			const path = props == null ? null : props.path;
			const filename = props == null ? null : props.filename;
			const differentPath = path != null && path != this.getPath;

			if (differentPath){
				//  console.log('onUrlChange differentPath so we do: ', path.split("/").filter(x => x.length > 0))
				this.$store.commit('SET_PATH', path.split("/").filter(x => x.length > 0))
			}

			const that = this;

			if (app == "Drive") {
				this.$store.commit("CURRENT_VIEW", 'Drive');
				// this.showGallery = false;
				this.$refs.appView.showGallery = false;
				// this.showPdfViewer = false;
				// this.showCodeEditor = false;
				// this.showTextViewer = false;
				// this.showHexViewer = false;
				// this.showTimeline = false;
				// this.showSearch = false;
				// this.showTodoBoardViewer = false;
				// this.showCalendarViewer = false;


				this.onUpdateCompletion.push(() => {
					// that.openInApp(filename, app);
					that.$refs.appView.openInApp(filename, app);
				});
			} else if (app == "Calendar") {
				this.$store.commit("CURRENT_VIEW", 'Calendar');
			} else if (app == "Newsfeed") {
				this.$store.commit("CURRENT_VIEW", 'Newsfeed');
			} else if (app == "Social") {
				this.$store.commit("CURRENT_VIEW", 'Social');
			} if (app == "Tasks") {
				this.$store.commit("CURRENT_VIEW", 'Tasks');
			} else {
				this.$store.commit("CURRENT_VIEW", 'Drive');
				// console.log('onUrlChange / Gallery case: ', filename, app)
				this.$refs.appView.openInApp(filename, app)
			}



		},

		// getPropsFromUrl() {
		// 	try {
		// 		return this.decryptProps(fragmentToProps(window.location.hash.substring(1)));
		// 	} catch (e) {
		// 		return null;
		// 	}
		// },
		// decryptProps(props) {
		// 	if (this.isSecretLink)
		// 		return path;

		// 	return fragmentToProps(this.context.decryptURL(props.ciphertext, props.nonce));
		// },

		// encryptProps(props) {
		// 	var both = this.context.encryptURL(props)
		// 	const nonce = both.base64Nonce;
		// 	const ciphertext = both.base64Ciphertext;
		// 	return { nonce: nonce, ciphertext: ciphertext };
		// },






		updateNetwork() {
			let that = this;
			peergos.shared.NetworkAccess.buildJS(
				"QmVdFZgHnEgcedCS2G2ZNiEN59LuVrnRm7z3yXtEBv2XiF",
				!that.isLocalhost
			).thenApply(function (network) {
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
						that.$toast.error('Please unblock the following domain for Peergos to function correctly: ' + domainOpt.get())
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
				that.$store.commit("CURRENT_VIEW", 'Drive');
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
}


.icon.sprite-test{
	display: block;
	width:200px;
	height: 48px;
	margin: var(--app-margin) auto;
}

/*
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
} */

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

section.content{
	position: relative;
	right:0;
	top:0;
	padding-left:72px;
	/* width: calc(100% - 96px); */
	min-height: 100vh;
}

section.content.sidebar-margin {
	padding-left: 240px;
	/* width: calc(100% - 240px); */
}

@media screen and (max-width:1024px) {
	section.content{
		padding-left: 0;
	}

}
</style>
