module.exports = new Vuex.Store({
	state: {
		view: "Files",
		isDark: false,
		isSidebarOpen: false,
	},
	getters: {
		currentTheme: (state) => {
			return state.isDark ? "dark-mode" : "";
		},
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
	},
});
