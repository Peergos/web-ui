// TODO: split store in modules (UI, Settings, Storage, Drive,...)

const helpers = require("../mixins/storage/index.js");

module.exports = new Vuex.Store({
	state: {
		windowWidth: null,
		currentView: null,
		isDark: false,
		isSidebarOpen: false,
		showModal: false,
		currentModal: 'AppModal', // 'ModalSpace'

		quotaBytes: 0,
		usageBytes: 0,
		isSecretLink: false,

		crypto: null,
		network: null,
		context: null,
		download: null,
		open: null,
		initPath: null,

		paymentProperties: null,

		isLoggedIn: false,
		isAdmin: false,

		driveMenuTarget: null,
		path: [],

		// urlProps: null
	},

	getters: {
		currentTheme: (state) => {
			return state.isDark ? "dark-mode" : "";
		},
		isMobile:(state) => {
			return state.windowWidth < 1024;
		},
		quota: (state) => {
			if (state.quotaBytes == 0)
				return "N/A";

			return helpers.convertBytesToHumanReadable(state.quotaBytes.toString());
		},
		usage: (state) => {
			if (state.usageBytes == 0)
				return "N/A";

			return helpers.convertBytesToHumanReadable(state.usageBytes.toString());
		},
		isSecretLink: (state) => {
			return state.context != null && state.context.username == null
		},
		getPath: (state) => {
			return '/' + state.path.join('/') + (state.path.length > 0 ? "/" : "");
		}

	},

	// Sync
	mutations: {
		// UI
		SET_WINDOW_WIDTH(state, payload) {
			state.windowWidth = payload;
		},
		SET_VIEW(state, payload) {
			state.view = payload;
		},
		SET_THEME(state, payload) {
			state.isDark = payload;
		},
		TOGGLE_THEME(state) {
			state.isDark = !state.isDark;
		},
		SET_SIDEBAR(state, payload) {
			state.isSidebarOpen = payload;
		},
		TOGGLE_SIDEBAR(state) {
			state.isSidebarOpen = !state.isSidebarOpen;
		},
		SET_MODAL(state, payload) {
			state.showModal = payload;
		},
		CURRENT_MODAL(state, payload) {
			state.currentModal = payload;
			state.showModal = true;
		},
		CURRENT_VIEW(state, payload) {
			state.currentView = payload;
		},

		// Settings
		SET_CRYPTO(state, payload) {
			state.crypto = payload;
		},
		SET_NETWORK(state, payload) {
			state.network = payload;
		},
		SET_CONTEXT(state, payload) {
			state.context = payload;
		},
		SET_DOWNLOAD(state, payload) {
			state.download = payload;
		},
		SET_OPEN(state, payload) {
			state.open = payload;
		},
		SET_INIT_PATH(state, payload) {
			state.initPath = payload;
		},
		SET_PAYMENT_PROPERTIES(state, payload) {
			state.paymentProperties = payload;
		},

		// Storage
		SET_QUOTA(state, payload) {
			state.quotaBytes = payload;
		},
		SET_USAGE(state, payload) {
			state.usageBytes = payload;
		},

		// User
		USER_LOGIN(state, payload) {
			state.isLoggedIn = payload;
		},
		USER_ADMIN(state, payload) {
			state.isAdmin = payload;
		},

		//Drive
		// SET_DRIVE_MENU_POSITION(state, payload) {
		// 	state.driveMenuPosition = payload;
		// },
		SET_DRIVE_MENU_TARGET(state, payload) {
			state.driveMenuTarget = payload;
		},
		SET_PATH(state, payload) {
			state.path = payload;
		},
		// SET_URL_PROPS(state, payload) {
		// 	state.urlProps = payload;
		// },

	},

	// Async
	actions: {
		updateQuota({ commit, state }) {
			if (state.isSecretLink)
				return;
			return state.context.getQuota().thenApply(q => {
				commit('SET_QUOTA', q)
			});
		},

		updateUsage({ commit, state }) {
			if (state.isSecretLink)
				return;

			return state.context.getSpaceUsage().thenApply(u => {
				commit("SET_USAGE", u);
			});
		},

		// async getPropsFromUrl({ commit, state }) {

		// 	function decryptProps(props) {
		// 		if (state.isSecretLink)
		// 			return state.path;

		// 		return fragmentToProps(state.context.decryptURL(props.ciphertext, props.nonce));
		// 	}

		// 	const propsFromUrl = await decryptProps(fragmentToProps(window.location.hash.substring(1)))
		// 	commit('SET_URL_PROPS', propsFromUrl)

		// },

		// updateHistory({ commit, state }, { app, path, filename }) {
		// 	console.log('store:updateHistory:', app, path, filename)

		// 	if (state.isSecretLink)
		// 		return;

		// 	// const currentProps = this.getPropsFromUrl();
		// 	const pathFromUrl = state.urlProps == null ? null : state.urlProps.path;
		// 	const appFromUrl = state.urlProps == null ? null :  state.urlProps.app;

		// 	if (path == pathFromUrl && app == appFromUrl)
		// 		return;

		// 	var rawProps = propsToFragment({ app: app, path: path, filename: filename });

		// 	function encryptProps(props) {
		// 		var both = state.context.encryptURL(props)
		// 		const nonce = both.base64Nonce;
		// 		const ciphertext = both.base64Ciphertext;
		// 		return { nonce: nonce, ciphertext: ciphertext };
		// 	}

		// 	var props = encryptProps(rawProps);

		// 	window.location.hash = "#" + propsToFragment(props);
		// },

	}

});
