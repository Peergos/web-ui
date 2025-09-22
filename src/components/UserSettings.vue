<template>
	<nav class="user-settings">
    	<Spinner v-if="showSettingsSpinner"></Spinner>
        <AppPrompt
            v-if="showPrompt"
            @hide-prompt="closePrompt()"
            :message='prompt_message'
            :placeholder="prompt_placeholder"
            :max_input_size="prompt_max_input_size"
            :value="prompt_value"
            :consumer_func="prompt_consumer_func"
            :action="prompt_action"
        />
		<AppDropdown
			v-if="isLoggedIn"
			aria-expanded="true"
			aria-label="settings"
		>
			<template #trigger>
				<div class="drive-user">
					<span class="mobile-hidden">{{ context.username }}</span>
					<img
						class="cover"
						v-if="profileImage"
						:src="profileImage"
						alt="profile"
					/>
					<AppIcon class="cover" v-else icon="user--48" />
				</div>
			</template>
			<ul class="" aria-labelledby="logoutButton">
				<li
					v-if="isAdmin"
					v-on:keyup.enter="showAdminPanel()"
					@click="showAdminPanel()"
				>
					{{ translate("SETTINGS.ADMIN") }}
				</li>
				<li
                                        v-on:keyup.enter="showRequestStorage()"
					@click="showRequestStorage()"
				>
					{{ translate("SETTINGS.ACCOUNT") }}
				</li>
				<li class="divider"></li>
				<li v-on:keyup.enter="showProfile()" @click="showProfile()">
					{{ translate("SETTINGS.PROFILE") }}
				</li>
				<li v-on:keyup.enter="showFeedback()" @click="showFeedback()">
					{{ translate("SETTINGS.FEEDBACK") }}
				</li>
				<li v-on:keyup.enter="showTour()" @click="showTour()">
					{{ translate("SETTINGS.TOUR") }}
				</li>
				<li v-on:keyup.enter="launchHelp()" @click="launchHelp()">
					{{ translate("SETTINGS.HELP") }}
				</li>
				<li
					v-on:keyup.enter="showAuthenticationScreen()"
					@click="showAuthenticationScreen()"
				>
					{{ translate("SETTINGS.AUTH") }}
				</li>
				<li
					v-on:keyup.enter="showChangePassword()"
					@click="showChangePassword()"
				>
					{{ translate("SETTINGS.PASS") }}
				</li>
                <li
                    v-on:keyup.enter="cleanupFailedUploads()"
                    @click="cleanupFailedUploads()"
                >
                    {{ translate("SETTINGS.CLEANUP") }}
                </li>
                <li
                    v-on:keyup.enter="modifyCacheSize()"
                    @click="modifyCacheSize()"
                >
                    {{ translate("SETTINGS.CACHE") }}
                </li>
				<li
					v-on:keyup.enter="showMigrate()"
					@click="showMigrate()"
				>
					{{ translate("SETTINGS.MIGRATE") }}
				</li>
				<li
					v-on:keyup.enter="showViewAccount()"
					@click="showViewAccount()"
				>
					{{ translate("SETTINGS.DELETE") }}
				</li>
				<li class="divider"></li>
				<li v-on:keyup.enter="logout()" @click="logout()">{{ translate("SETTINGS.LOGOUT") }}</li>
			</ul>
		</AppDropdown>

		<!-- dark theme -->
		<AppButton
			class="toggle-theme mobile-hidden"
			size="small"
			:icon="isDark ? 'sun' : 'moon'"
			@click.native="toggleTheme()"
			aria-label="Toggle theme"
		/>
                <Admin
                    v-if="showAdmin"
                    v-on:hide-admin="showAdmin=false"
                    v-on:recalc-admin="recalculateAdminData()"
                    :data="admindata"
                    :context="context">
                </Admin>
		<!-- mobile menu trigger -->
		<AppButton
			v-if="isLoggedIn"
			class="mobile-menu--trigger desktop-hidden"
			size="small"
			round
			icon="dot-menu"
			@click.native="toggleSidebar()"
			aria-label="Open menu"
		/>
	</nav>
</template>

<script>
const Admin = require("./admin/Admin.vue")
const AppButton = require("AppButton.vue");
const AppDropdown = require("./AppDropdown.vue");
const AppIcon = require("AppIcon.vue");
const AppPrompt = require("./prompt/AppPrompt.vue");
const Spinner = require("./spinner/Spinner.vue");
const i18n = require("../i18n/index.js");

module.exports = {
    components: {
        Admin,
        AppButton,
	    AppDropdown,
        AppPrompt,
        Spinner,
	    AppIcon,
    },
    mixins:[i18n],
	data() {
		return {
		    profileImage: "",
                    showAdmin: false,
                    admindata: {pending:[]},
                    showSettingsSpinner: false,
                    chatResponseHeader: null,
                    showPrompt: false,
                    prompt_message: '',
                    prompt_placeholder: '',
                    prompt_max_input_size: null,
                    prompt_value: '',
                    prompt_consumer_func: () => {},
                    prompt_action: 'Set'
		};
	},
	computed: {
		...Vuex.mapState(['isLoggedIn', 'isAdmin', 'context', 'isDark']),
		...Vuex.mapGetters(['currentTheme', 'isPaid'])
	},
    created() {
        this.prompt_action = this.translate("PROMPT.SET");
        this.displayProfile();
    },
	methods: {
        cleanupFailedUploads() {
            this.showSettingsSpinner = true;
            let that = this;
            this.context.cleanPartialUploads().thenApply(snapshot => {
                that.showSettingsSpinner = false;
                that.context.getSpaceUsage(false).thenApply(u => {
                    that.$store.commit('SET_USAGE', u);
                });
            }).exceptionally(function(throwable) {
                let errMsg = throwable.getMessage();
                console.log(errMsg);
                that.$toast.error('Upload cleanup failed. Please try again. Error: ' + errMsg, {timeout:false});
                that.showSettingsSpinner = false;
            });
        },
        modifyCacheSize: function() {
            let that = this;
            const isLocalhost = window.location.hostname == "localhost";
            if (!isLocalhost && !isCachingAvailable()) {
                that.$toast('Cache not available');
                return;
            }
            getBrowserStorageQuota().then(maxStorage => {
                let maxStorageMiB = Math.floor(maxStorage /1024 /1024);
                this.prompt_message = this.translate("SETTINGS.CACHE") + ' (MiB)';
                let roundedCurrentCacheSize = Math.floor(isLocalhost ? maxStorageMiB : getCurrentDesiredCacheSize());
                this.prompt_value = '' + roundedCurrentCacheSize;
                this.prompt_placeholder = " ";
                this.prompt_consumer_func = function (prompt_result) {
                    that.showPrompt = false;
                    if (prompt_result == null) {
                        return;
                    }
                    let newCacheSizeMiB = prompt_result.trim();
                    if (!that.validateCacheSize(newCacheSizeMiB)) {
                        that.$toast.error(that.translate("SETTINGS.CACHE.INVALID"), {timeout:false});
                        return;
                    }
                    let validNewCacheSize = Number(newCacheSizeMiB);
                    if (validNewCacheSize > maxStorageMiB && ! isLocalhost) {
                        that.$toast.error(that.translate("SETTINGS.CACHE.LARGE")
                                          .replace("$SIZE", maxStorageMiB), {timeout:false});
                    } else {
                        if (roundedCurrentCacheSize != validNewCacheSize) {
                            that.showSettingsSpinner = true;
                            modifyCacheSize(validNewCacheSize).thenApply(() => {
                                that.showSettingsSpinner = false;
                                that.$toast(that.translate("SETTINGS.CACHE.UPDATED"));
                            });
                        }
                    }
                };
                this.showPrompt = true;
            });
        },
        validateCacheSize: function(num) {
            if (num == null || num == '') {
                return false;
            }
            let numInt = parseInt(num, 10);
            if (isNaN(numInt)) {
                return false;
            }
            if (numInt < 0) {
                return false;
            }
            return true;
        },
        closePrompt() {
            this.showPrompt = false;
        },
		displayProfile() {
		    if (this.context.username == null) {
		        return;
		    }
			let that = this;
			peergos.shared.user.ProfilePaths.getProfile(
				this.context.username,
				this.context
			).thenApply((profile) => {
				if (profile.profilePhoto.isPresent()) {
					let str = "";
					let data = profile.profilePhoto.get();
					for (let i = 0; i < data.length; i++) {
						str = str + String.fromCharCode(data[i] & 0xff);
					}
					if (data.byteLength > 0) {
						that.profileImage =
							"data:image/png;base64," + window.btoa(str);
					}
				}
			});
		},
		showAdminPanel() {
		    if (this.context == null) return;
		    const that = this;
		    this.context.getAndDecodePendingSpaceRequests().thenApply(reqs => {
			that.admindata.pending = reqs.toArray([]);
			that.showAdmin = true;
		    });
		},
		recalculateAdminData() {
		    const that = this;
            this.context.getAndDecodePendingSpaceRequests().thenApply(reqs => {
                that.admindata.pending = reqs.toArray([]);
            });
		},
	    showRequestStorage() {
                if(this.isPaid){
		    this.$store.commit('CURRENT_MODAL', 'ModalPro');
		}else{
		    this.$store.commit('CURRENT_MODAL', 'ModalSpace');
		}
	    },
		showProfile() {
			this.$store.commit("CURRENT_MODAL", "ModalProfile");
		},
		launchHelp() {
			this.$store.commit("CURRENT_MODAL", "ModalHelp");
		},
		showTour() {
			this.$store.commit("CURRENT_MODAL", "ModalTour");
		},
		showFeedback() {
			this.$store.commit("CURRENT_MODAL", "ModalFeedback");
		},
        showAuthenticationScreen() {
            this.$store.commit("CURRENT_MODAL", "ModalAuthSettings");
        },
		showChangePassword() {
			this.$store.commit("CURRENT_MODAL", "ModalPassword");
		},
		showMigrate() {
			this.$store.commit("CURRENT_MODAL", "ModalMigrate");
		},
		showViewAccount() {
			this.$store.commit("CURRENT_MODAL", "ModalAccount");
		},
		logout() {
		    let that = this;
		    clearRootKeyCacheFully(cleared =>  {
                that.$store.commit("SET_CONTEXT", null);
                window.location.fragment = "";
                window.location.reload();
            });
		},
		toggleSidebar() {
			this.$store.commit("TOGGLE_SIDEBAR");
		},
		toggleTheme() {
			this.$store.commit("TOGGLE_THEME");
			document.documentElement.setAttribute(
				"data-theme",
				this.currentTheme
			);
			localStorage.setItem("theme", this.currentTheme);
		},
	},
};
</script>

<style>
.user-settings {
	margin-left:auto;
	display: flex;
	align-items: center;
	padding: 0 32px;
}
.user-settings button{
	margin-left: 16px;
}
.drive-user {
	display: flex;
	align-items: center;
}
.drive-user .cover {
	display: inline-block;
	height: 42px;
	width: 42px;
	margin-left: 8px;
	background-color: var(--bg-2);
	border-radius: 50%;
	object-fit: cover;
	color: var(--color);
}
</style>
