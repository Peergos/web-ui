// TODO: split store in modules (UI, Settings, Storage, Drive,...)

const helpers = require("../mixins/storage/index.js");
function shallow(val) {
    // tag a value so vue will only shallow watch it
    if (val != null) {
        val._isVue = true;
    }
    return val;
}
module.exports = new Vuex.Store({
	state: {
		windowWidth: null,
		currentView: null,
		isDark: false,
		isSidebarOpen: false,
		showModal: false,
		currentModal: 'AppModal',

		quotaBytes: 0,
		usageBytes: 0,
		isSecretLink: false,

		crypto: null,
		network: null,
        context: null,
        mirrorBatId: null,
		download: null,
		open: null,
		initPath: null,

		paymentProperties: null,

		isLoggedIn: false,
		isAdmin: false,

		driveMenuTarget: null,
		path: [],
		currentFilename: "",
        currentFeedback: "",
		// urlProps: null

		socialData: {
			annotations: {},
			friends: [],
			followers: [],
			following: [],
			pending: [],
			pendingOutgoing: [],
			blocked: [],
			groupsNameToUid: {},
			groupsUidToName: {}
		},
        sandboxedApps: {
            appFileExtensionRegistrationMap: new Map(),
            appMimeTypeRegistrationMap: new Map(),
            appFileTypeRegistrationMap: new Map(),
            appFileExtensionWildcardRegistrationList: [],
            appMimeTypeWildcardRegistrationList: [],
            appFileTypeWildcardRegistrationList: [],
            appsInstalled: [],
            appsLoaded: false
        },
        shortcuts: {
            shortcutsMap: new Map()
        }
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
		},
		currentFilename: (state) => {
			return state.currentFilename;
		},
		isPaid: (state) => {
			return state.paymentProperties != null && state.paymentProperties.isPaid()
		},
		getCurrentFeedback: (state) => {
			return state.currentFeedback;
		},
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
		    state.crypto = shallow(payload);
		},
		SET_NETWORK(state, payload) {
		    state.network = shallow(payload);
		},
		SET_CONTEXT(state, payload) {
		    state.context = shallow(payload);
		},
		SET_DOWNLOAD(state, payload) {
			state.download = payload;
		},
		SET_OPEN(state, payload) {
			state.open = payload;
		},
		SET_IS_SECRET_LINK(state, payload) {
			state.isSecretLink = payload;
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
        SET_MIRROR_BAT_ID(state, payload) {
			state.mirrorBatId = payload;
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
		SET_CURRENT_FILENAME(state, payload) {
			state.currentFilename = payload;
		},
		// SET_URL_PROPS(state, payload) {
		// 	state.urlProps = payload;
		// },
		SET_CURRENT_FEEDBACK(state, payload) {
			state.currentFeedback = payload;
		},
		// Social
		SET_ANOTATIONS(state, payload) {
			state.socialData.annotations = payload;
		},
		SET_FRIENDS(state, payload) {
			state.socialData.friends = payload;
		},
		SET_FOLLOWERS(state, payload) {
			state.socialData.followers = payload;
		},
		SET_FOLLOWING(state, payload) {
			state.socialData.following = payload;
		},
        SET_FOLLOWING_ROOTS(state, payload) {
            state.socialData.followingRoots = payload;
        },
		SET_GROUP_TO_NAME(state, payload) {
			state.socialData.groupsUidToName = payload;
		},
		SET_GROUP_TO_UID(state, payload) {
			state.socialData.groupsNameToUid = payload;
		},
		SET_PENDING_INCOMING(state, payload) {
			state.socialData.pending = payload;
		},
		SET_PENDING_OUTGOING(state, payload) {
			state.socialData.pendingOutgoing = payload;
		},
		SET_BLOCKED(state, payload) {
			state.socialData.blocked = payload;
		},
        //sandboxed Apps
        SET_FILE_EXTENSION_REGISTRATIONS(state, payload) {
            state.sandboxedApps.appFileExtensionRegistrationMap = payload;
        },
        SET_MIMETYPE_REGISTRATIONS(state, payload) {
            state.sandboxedApps.appMimeTypeRegistrationMap = payload;
        },
        SET_FILETYPE_REGISTRATIONS(state, payload) {
            state.sandboxedApps.appFileTypeRegistrationMap = payload;
        },
        SET_FILE_EXTENSION_WILDCARD_REGISTRATIONS(state, payload) {
            state.sandboxedApps.appFileExtensionWildcardRegistrationList = payload;
        },
        SET_MIMETYPE_WILDCARD_REGISTRATIONS(state, payload) {
            state.sandboxedApps.appMimeTypeWildcardRegistrationList = payload;
        },
        SET_FILETYPE_WILDCARD_REGISTRATIONS(state, payload) {
            state.sandboxedApps.appFileTypeWildcardRegistrationList = payload;
        },
        SET_SANDBOXED_APPS(state, payload) {
            state.sandboxedApps.appsLoaded = true;
            state.sandboxedApps.appsInstalled = payload;
        },
        SET_SHORTCUTS(state, payload) {
            state.shortcuts.shortcutsMap = payload;
        }
	},

	// Async
	actions: {
		updateQuota({ commit, state }, callback) {
			if (state.isSecretLink)
				return;
			return state.context.getQuota().thenApply(q => {
			    commit('SET_QUOTA', q)
				// return q;
				if (callback != null) {
					callback(q)
				}
            }).exceptionally(err => {
				if (callback != null) {
					callback(null);
				}
            });
		},

		updateUsage({ commit, state }, callback) {
			if (state.isSecretLink)
				return;

			return state.context.getSpaceUsage(false).thenApply(u => {
				commit('SET_USAGE', u);
                if (callback != null) {
                    callback(u)
                }
			});
		},

		updateMirrorBatId({ commit, state }) {
			if (state.isSecretLink)
				return;

			return state.context.ensureMirrorId().thenApply(u => {
				commit('SET_MIRROR_BAT_ID', u);
			});
		},

		updatePayment({ commit, state }, callback) {
			state.context
				.getPaymentProperties(false)
				.thenApply(function (paymentProps) {
					commit("SET_PAYMENT_PROPERTIES", paymentProps);
					if (paymentProps.isPaid()) {
					    commit("SET_PAYMENT_PROPERTIES", paymentProps);
                                            if (callback != null)
                                                callback()
					} else {
						state.context.getPendingSpaceRequests().thenApply(reqs => {
						if (reqs.toArray([]).length > 0)
							commit("USER_ADMIN", true);
						});
					}
				});
		},

		updateSocial({ commit, state }, callback) {

			return state.context.getSocialState().thenApply(function (socialState) {

				let annotations = {}
				socialState.friendAnnotations.keySet().toArray([]).map(name => annotations[name]=socialState.friendAnnotations.get(name))
				commit('SET_ANOTATIONS', annotations)


				let followerNames = socialState.followerRoots.keySet().toArray([])
				let followeeNames = socialState.followingRoots.toArray([]).map(function (f) { return f.getFileProperties().name })
				let friendNames = followerNames.filter(x => followeeNames.includes(x))
				followerNames = followerNames.filter(x => !friendNames.includes(x))
				followeeNames = followeeNames.filter(x => !friendNames.includes(x))

				commit('SET_FRIENDS', friendNames)
				commit('SET_FOLLOWERS', followerNames)
				commit('SET_FOLLOWING', followeeNames)
				commit('SET_FOLLOWING_ROOTS', socialState.followingRoots)

				let groupsUidToName = {}
				socialState.uidToGroupName.keySet().toArray([]).map(uid => groupsUidToName[uid] = socialState.uidToGroupName.get(uid))
				commit('SET_GROUP_TO_NAME', groupsUidToName)

				let groupsNameToUid = {}
				socialState.groupNameToUid.keySet().toArray([]).map(name => groupsNameToUid[name]=socialState.groupNameToUid.get(name));
				commit('SET_GROUP_TO_UID', groupsNameToUid)

				let pendingOutgoingUsernames = [];
				socialState.pendingOutgoing.toArray([]).map(u => pendingOutgoingUsernames.push(u));
				commit('SET_PENDING_OUTGOING', pendingOutgoingUsernames)

				commit('SET_PENDING_INCOMING', socialState.pendingIncoming.toArray([]))

				let blockedUsernames = [];
				socialState.blocked.toArray([]).filter(u => u.length > 0).map(i => blockedUsernames.push(i));
				commit('SET_BLOCKED', blockedUsernames)

				if (callback != null) {
					callback()
				}


			}).exceptionally(function(throwable) {
				return `Error retrieving social state ${throwable.getMessage()}`
			});
		}
	}
});
