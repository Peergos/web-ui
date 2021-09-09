<template>
	<nav class="user-settings">
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
					Admin Panel
				</li>
				<li
					v-on:keyup.enter="showRequestStorage()"
					@click="showRequestStorage()"
				>
					Storage
				</li>
				<li class="divider"></li>
				<li v-on:keyup.enter="showProfile()" @click="showProfile()">
					Profile
				</li>
				<li
					v-on:keyup.enter="showChangePassword()"
					@click="showChangePassword()"
				>
					Change Password
				</li>
				<li
					v-on:keyup.enter="showViewAccount()"
					@click="showViewAccount()"
				>
					Delete Account
				</li>
				<li class="divider"></li>
				<li v-on:keyup.enter="logout()" @click="logout()">Log out</li>
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
const AppDropdown = require("./AppDropdown.vue");

module.exports = {
	components: {
		AppDropdown,
	},
	data() {
		return {
			profileImage: "",
		};
	},
	computed: {
		...Vuex.mapState(['isLoggedIn', 'isAdmin', 'context', 'isDark']),
		...Vuex.mapGetters(['currentTheme'])
	},
	methods: {
		displayProfile() {
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
			console.log("admin panel...");
			// const that = this;
			// this.context.getAndDecodePendingSpaceRequests().thenApply(reqs => {
			//     that.admindata.pending = reqs.toArray([]);
			//     that.showAdmin = true;
			// });
		},
		showRequestStorage() {
			this.$store.commit("CURRENT_MODAL", "ModalSpace");
		},
		showProfile() {
			this.$store.commit("CURRENT_MODAL", "ModalProfile");
		},
		showChangePassword() {
			this.$store.commit("CURRENT_MODAL", "ModalPassword");
		},
		showViewAccount() {
			this.$store.commit("CURRENT_MODAL", "ModalAccount");
		},
		logout() {
			this.$store.commit("SET_CONTEXT", null);
			window.location.fragment = "";
			window.location.reload();
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