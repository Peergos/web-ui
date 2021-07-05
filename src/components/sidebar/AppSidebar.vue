<template>
	<aside class="sidebar" :class="{ active: isOpen }">
		<AppIcon class="logo" :icon="isOpen ? 'logo-full' : 'logo-min'" />

		<AppButton
			class="toggle-button--mobile mobile"
			round
			size="small"
			@click="toggleSidebar"
		>
			<AppIcon icon="dots-menu"
		/></AppButton>

		<AppButton
			class="toggle-theme--mobile mobile"
			size="small"
			@click="toggleTheme()"
			aria-label="Toggle themes"
		>
			<AppIcon :icon="isDark ? 'sun' : 'moon'" />
		</AppButton>

		<AppButton
			class="toggle-button desktop"
			round
			icon
			size="small"
			@click="toggleSidebar"
		>
			<AppIcon :icon="isOpen ? 'arrow-left' : 'arrow-right'"
		/></AppButton>

		<ul class="nav-list">
			<MenuItem label="Files" icon="files" view="Drive" />
			<MenuItem label="Newsfeed" icon="news" view="NewsFeed" />
			<MenuItem label="Tasks" icon="tasks" view="Tasks" />
			<MenuItem label="Social" icon="social" view="Social" />
			<MenuItem label="Calendar" icon="calendar" view="Calendar" />
		</ul>

		<!-- <AccountSettings
			user="ianpreston"
			propic="./img/propic.png"
			class="account-settings mobile"
		/> -->
		<!-- <AppUpgrade/> -->
		<SidebarStorage
			:is-premium="false"
		/>
	</aside>
</template>

<script>
const MenuItem = require('./SidebarMenuItem.vue');
const SidebarStorage = require('./SidebarStorage.vue');
// const AppUpgrade = require('./AppUpgrade.vue');

module.exports = {
	components: {
		MenuItem,
		SidebarStorage,
		// AppUpgrade
		// AccountSettings,
	},
	computed: {
		isOpen() {
			return this.$store.state.isSidebarOpen;
		},
		currentTheme() {
			return this.$store.getters.currentTheme;
		},
		isDark() {
			return this.$store.state.isDark;
		},
	},
	methods: {
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
.sidebar {
	display: flex;
	flex-direction: column;
	height: 100%;
	width: 96px;
	position: fixed;
	top: 0;
	left: 0;
	z-index: 99;
	padding: 0 16px;
	background: var(--bg-2);
	transition: all 0.5s ease;
}
.sidebar.active {
	width: 240px;
	padding: 0 16px;
}

.sidebar .logo {
	width: 100%;
	left: 0;
	height: 32px;
	margin-top: 16px;
	margin-bottom: 64px;
	padding: 0 16px;
}

.sidebar .nav-list {
	margin-top: 20px;
	padding: 0;
}

.sidebar .toggle-button {
	position: absolute;
	width: 32px;
	right: -48px;
	top: 16px;
	background-color: var(--bg-2);
}

.sidebar .toggle-button svg {
	width: 100%;
	height: 100%;
}

.sidebar .toggle-button--mobile svg,
.sidebar .toggle-theme--mobile svg {
	width: 24px;
	height: 24px;
}

.sidebar .toggle-button--mobile {
	background-color: var(--bg-2);
	position: fixed;
	top: 16px;
	right: 16px;
	opacity: 1;
}

.sidebar .toggle-theme--mobile {
	position: fixed;
	top: 16px;
	right: 56px;
	opacity: 1;
}

@media (max-width: 1024px) {
	.sidebar {
		/* visibility: hidden; */
		width: 100%;
		opacity: 0;
		pointer-events: none;
		background: var(--bg);
		transition: opacity 0.3s, padding 0s 0.3s;
	}

	.sidebar.active {
		visibility: visible;
		width: 100%;

		padding: 0;

		opacity: 1;
		transition: opacity 0.3s;

		pointer-events: all;
	}

	.sidebar .account {
		display: flex;
	}

	.sidebar .account-settings {
		text-align: left;
		width: 100%;
		margin-top: auto;
		padding: 0 var(--app-margin);
		border-top: 1px solid var(--border-color);
	}

	.sidebar .account .propic {
		order: -1;
		margin-left: 0;
		margin-right: 8px;
	}
}
</style>