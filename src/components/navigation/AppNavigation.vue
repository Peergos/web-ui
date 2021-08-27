<template>
	<nav class="app-navigation" :class="{ expanded: isOpen }">

		<AppIcon class="logo" :icon="isOpen ? 'logo-full' : 'logo-min'" @click.native="toggleSidebar()"/>

		<!-- <AppButton
			class="toggle-button--mobile mobile"
			round
			size="small"
			icon="dot-menu"
			@click.native="toggleSidebar"
		/> -->

		<!-- <AppButton
			class="toggle-theme--mobile mobile"
			size="small"
			:icon="isDark ? 'sun' : 'moon'"
			@click.native="toggleTheme()"
			aria-label="Toggle themes"
		/> -->

		<ul class="nav-list">
			<MenuItem label="Files" icon="files" view="Drive" />
			<MenuItem label="Newsfeed" icon="news" view="NewsFeed" />
			<MenuItem label="Tasks" icon="tasks" view="Tasks" />
			<MenuItem label="Social" icon="social" view="Social" />
			<MenuItem label="Calendar" icon="calendar" view="Calendar" />
		</ul>


		<NavigationStorage
			:is-premium="false"
		/>
	</nav>
</template>

<script>
const MenuItem = require('./NavigationMenuItem.vue');
const NavigationStorage = require('./NavigationStorage.vue');

module.exports = {
	components: {
		MenuItem,
		NavigationStorage,
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
.app-navigation {
	position: fixed;
	top: 0;
	left: 0;
	z-index: 300;
	padding: 0 16px;

	display: flex;
	flex-direction: column;
	height: 100%;
	width: 96px;

	background: var(--bg-2);
	transition: all 0.5s ease;
}
.app-navigation.expanded {
	width: 240px;
	padding: 0 16px;
}

.app-navigation .logo {
	width: 100%;
	left: 0;
	height: 32px;
	margin-top: 16px;
	margin-bottom: 64px;
	padding: 0 16px;
	cursor: pointer;
}

.app-navigation .nav-list {
	margin-top: 20px;
	margin-bottom: auto;
	padding: 0;
}



.app-navigation .toggle-button--mobile svg,
.app-navigation .toggle-theme--mobile svg {
	width: 24px;
	height: 24px;
}

.app-navigation .toggle-button--mobile {
	background-color: var(--bg-2);
	position: fixed;
	top: 16px;
	right: 16px;
	opacity: 1;
}

.app-navigation .toggle-theme--mobile {
	position: fixed;
	top: 16px;
	right: 56px;
	opacity: 1;
}

@media (max-width: 1024px) {
	.app-navigation {
		/* visibility: hidden; */
		width: 100%;
		opacity: 0;
		pointer-events: none;
		/* background: var(--bg); */
		transition: opacity 0.3s, padding 0s 0.3s;
	}

	.app-navigation.expanded {
		visibility: visible;
		width: 100%;

		padding: 0;

		opacity: 1;
		transition: opacity 0.3s;

		pointer-events: all;
	}

}
</style>