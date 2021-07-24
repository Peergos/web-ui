module.exports = new Vuex.Store({
	state: {
		userIsLoggedIn: false,
		currentView: null,
		isDark: false,
		isSidebarOpen: false,
		showModal: false,
		currentModal: 'AppModal', // 'ModalSpace'
		quotaBytes: 0,
		usageBytes: 0,
		// isSecretLink: false,

		crypto: null,
		network: null,
		userContext:null,
	},

	getters: {
		currentTheme: (state) => {
			return state.isDark ? "dark-mode" : "";
		},
		// currentView:(state) => {
		// 	return state.currentView;
		// }
	},

	mutations: {
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
		USER_LOGIN(state, payload) {
			state.userIsLoggedIn = payload;
		},

		CURRENT_VIEW(state, payload) {
			state.currentView = payload;
		},

		// settings
		SET_CRYPTO(state, payload) {
			state.crypto = payload;
		},
		SET_NETWORK(state, payload) {
			state.network = payload;
		},
		SET_USER_CONTEXT(state, payload) {
			state.userContext = payload;
		},

		// usage
		SET_QUOTA(state, payload) {
			state.quotaBytes = payload;
		},
		SET_USAGE(state, payload) {
			state.usageBytes = payload;
		},
	},

	//
});
