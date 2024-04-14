<template>
	<div class="layout">
		<!-- modals -->
		<component v-if="showModal" :is="currentModal"></component>

		<!-- navigation -->
		<AppNavigation v-if="isLoggedIn" />

		<!-- needs restyle -->
		<section v-if="isSecretLink && this.context == null">
		    <AppIcon icon="logo-full" class="sprite-test" />
                    <center>
			<h2>Loading file...</h2>
                    </center>
		</section>

		<section class="login-register" v-if="!isLoggedIn && !isSecretLink">
			<AppIcon icon="logo-full" class="sprite-test" />

			<AppTabs ref="tabs">
				<p class="demo--warning" v-if="isDemo">
				    <strong>WARNING:</strong> This is a demo server and all data
				    will be cleared periodically. If you want to create a
				    <i>permanent</i> account, please go 
				    <a class="line" href="https://peergos.net?signup=true">here</a>.
			        </p>
                                <AppTab :title="translate('APP.LOGIN')">
					<Login @initApp="init()" />
				</AppTab>
				<AppTab :title="translate('APP.SIGNUP')">
					<Signup :token="token" />
				</AppTab>
			</AppTabs>
			
		</section>

    	<ServerMessages v-if="context != null"/>

		<!-- Main view container -->
		<section class="content" :class="{ 'sidebar-margin': isSidebarOpen }" v-if="isLoggedIn || isSecretLink">
			<!-- App views (pages) ex-filesystem-->
			<transition name="fade" mode="out-in">
				<component
					ref="appView"
					v-if="isLoggedIn || isSecretLink"
					:is="currentView"
				/>
			</transition>
		</section>



	</div>
</template>

<script>
const AppIcon = require("AppIcon.vue");
const AppNavigation = require("./navigation/AppNavigation.vue");
const ModalAuthSettings = require("./modal/ModalAuthSettings.vue");
const ModalTour = require("./modal/ModalTour.vue");
const ModalHelp = require("./modal/ModalHelp.vue");
const ModalSpace = require("./modal/ModalSpace.vue");
const ModalPro = require("./modal/ModalPro.vue");
const ModalPassword = require("./modal/ModalPassword.vue");
const ModalAccount = require("./modal/ModalAccount.vue");
const ModalProfile = require("./modal/ModalProfile.vue");
const ModalFeedback = require("./modal/ModalFeedback.vue");

const AppTab = require("./tabs/AppTab.vue");
const AppTabs = require("./tabs/AppTabs.vue");

const Login = require("./Login.vue");
const Signup = require("./Signup.vue");

const Drive = require("../views/Drive.vue");
const NewsFeed = require("../views/NewsFeed.vue");
const Tasks = require("../views/Tasks.vue");
const Social = require("../views/Social.vue");
const Calendar = require("../views/Calendar.vue");
const Email = require("../views/Email.vue");
const Launcher = require("../views/Launcher.vue");

const ServerMessages = require("./ServerMessages.vue");

const routerMixins = require("../mixins/router/index.js");
const launcherMixin = require("../mixins/launcher/index.js");
const sandboxAppMixins = require("../mixins/sandbox/index.js");
const i18n = require("../i18n/index.js");

module.exports = {
	components: {
	    AppIcon,
		AppNavigation,
		ModalAuthSettings,
		ModalTour,
		ModalHelp,
		// TODO: lazy load dynamic components
		// ModalTour: () => import("~/components/modal/ModalTour"),
		ModalSpace,
		ModalPro,
		ModalPassword,
		ModalAccount,
		ModalProfile,
		ModalFeedback,
		ServerMessages,
		Drive,
		NewsFeed,
		Tasks,
		Social,
		Calendar,
		Email,
		Launcher,
		AppTab,
		AppTabs,
		Login,
		Signup
	},

	data() {
		return {
			token: "",
		};
	},

	computed: {
	    ...Vuex.mapState([
		"isLoggedIn",
		"isDark",
		"isSidebarOpen",
		"showModal",
		"currentModal",
		"currentView",
		"crypto",
		"network",
		"context"
	    ]),
	    ...Vuex.mapGetters(["isSecretLink", "getPath"]),
	    isDemo() {
		return (
		    window.location.hostname == "peergos-demo.net" &&
			this.isSecretLink === false
		);
	    },
	    isLocalhost() {
		return window.location.hostname == "localhost";
	    },
            isSecretLink() {
                return this.getSecretLinkProps().secretLink == true;
            }
	},

	mixins: [routerMixins, sandboxAppMixins, launcherMixin, i18n],

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
		var props = this.getSecretLinkProps();
		if (href.includes("?signup=true")) {
		    this.$refs.tabs.selectTab(1);

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
	this.$store.commit("SET_CRYPTO", peergos.shared.Crypto.initJS());
	this.updateNetwork();

	window.addEventListener("hashchange", this.onUrlChange, false);
    },

    mounted() {
	let localTheme = localStorage.getItem("theme");
	document.documentElement.setAttribute("data-theme", localTheme);
	this.$store.commit("SET_THEME", localTheme == "dark-mode");
    },

    methods: {
        ...Vuex.mapActions([
	    'updateQuota',
	    'updateUsage',
	    'updatePayment'
	]),

	init() {
	    const that = this;
	    if (this.context != null && this.context.username == null) {
		// App.vue from a secret link
	    } else {
            peergos.shared.user.App.init(this.context, "launcher").thenApply(launcher => {
                that.loadShortcutsFile(launcher).thenApply(shortcutsMap => {
                    that.$store.commit("SET_SHORTCUTS", shortcutsMap);
                    that.updateUsage();
                    that.updateQuota();
                    that.updatePayment();
                    that.initSandboxedApps();
                })
            });
	    }
	},
        getSecretLinkProps() {
            var fragment = window.location.hash.substring(1);
	    var props = {};
	    if (fragment.length == 0) {
	        return props;
	    }
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
            return props;
        },

	onUrlChange() {
	    const props = this.getPropsFromUrl();

	    const app = props == null ? null : props.app;
	    const path = props == null ? null : props.path;
	    const args = props == null ? null : props.args;
	    const differentPath = this.canonical(path) != this.canonical(this.getPath);

	    if (differentPath && path != null) {
		console.log('onUrlChange differentPath so we do: ', path.split("/").filter(x => x.length > 0))
		this.$store.commit(
		    "SET_PATH",
		    path.split("/").filter((x) => x.length > 0)
		);
	    }

            const that = this;
            const sidebarApps = ["Drive", "NewsFeed", "Tasks", "Social", "Calendar", "Email", "Launcher"]
            const inDrive = this.currentView == "Drive";
	    if (app === "Drive") {
                if (inDrive) {
                    this.$refs.appView.closeApps()
                } else 
		    this.$store.commit("CURRENT_VIEW", app);
	    } else if (sidebarApps.includes(app)) {
		this.$store.commit("CURRENT_VIEW", app);
	    } else {
                // Drive sub-apps
                if (inDrive) {
                    if (differentPath) {
                        // TODO: find a cleaner way to do this
                        this.$refs.appView._data.onUpdateCompletion.push(() => {
		            that.$refs.appView.openInApp(args, app);
		        });
                    } else
                        that.$refs.appView.openInApp(args, app);
                } else {
		    this.$store.commit("CURRENT_VIEW", "Drive");
                    // TODO: find a cleaner way to do this
                    this.$refs.appView._data.onUpdateCompletion.push(() => {
		        that.$refs.appView.openInApp(args, app);
		    });
                }
	    }
	},

	updateNetwork() {
	    let that = this;
	    peergos.shared.NetworkAccess.buildJS(
		!that.isLocalhost,
		0, true
	    ).thenApply(function (network) {
		that.$store.commit("SET_NETWORK", network);
	    }).exceptionally(function (throwable) {
		    that.$toast.error(
			"Error connecting to network: " + throwable.getMessage()
		    );
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
			    "Please unblock the following domain for Peergos to function correctly: " +
				domainOpt.get()
			);
		    };

		    req.send();
		}
	    });
	},

	// still need to check this
	gotoSecretLink(props) {
	    var that = this;
            this.$store.commit("SET_IS_SECRET_LINK", true);
	    peergos.shared.user.UserContext.fromSecretLink(
		props.link,
		that.network,
		that.crypto
	    )
		.thenApply(function (context) {
		    that.$store.commit("SET_CONTEXT", context);
		    that.$store.commit("SET_DOWNLOAD", props.download);
		    that.$store.commit("SET_OPEN", props.open);
		    that.$store.commit("SET_INIT_PATH", props.path);
                    that.$store.commit("CURRENT_VIEW", "Drive");
		})
		.exceptionally(function (throwable) {
		    that.$toast.error(
			"Secret link not found! Url copy/paste error?"
		    );
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

.icon.sprite-test {
	display: block;
	width: 200px;
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

section.login-register {
	min-height: 100vh;
	padding: var(--app-margin);
	background-color: var(--bg-2);
}

section.login-register .demo--warning {
	padding-top: var(--app-margin);
	max-width: 400px;
	margin: 0 auto;
	color: red;
	background-color: var(--bg);
	text-align: left;
}

section.login-register .demo--warning a {
	color: cornflowerblue;
}

section.content {
	position: relative;
	right: 0;
	top: 0;
	padding-left: 72px;
	/* width: calc(100% - 96px); */
	min-height: 100vh;
}

section.content.sidebar-margin {
	padding-left: 240px;
	/* width: calc(100% - 240px); */
}

@media screen and (max-width: 1024px) {
	section.content {
		padding-left: 0;
	}
}
</style>
