<template>
	<nav class="app-navigation" :class="{ expanded: isOpen }">

		<AppIcon class="logo" :icon="isOpen ? 'logo-full' : 'logo-min'" @click.native="toggleSidebar()"/>

		<AppButton
			class="toggle-button--mobile desktop-hidden"
			round
			size="small"
			icon="dot-menu"
			@click.native="toggleSidebar"
		/>

		<AppButton
			class="toggle-theme--mobile desktop-hidden"
			size="small"
			:icon="isDark ? 'sun' : 'moon'"
			@click.native="toggleTheme()"
			aria-label="Toggle themes"
		/>

		<ul class="nav-list">
            <MenuItem label="Launcher" icon="tasks" view="Launcher" />
			<MenuItem label="Drive" icon="folder" view="Drive" />
			<MenuItem label="Newsfeed" icon="news" view="NewsFeed" />
			<MenuItem label="Tasks" icon="tasks" view="Tasks" />
			<MenuItem label="Social" icon="social" view="Social" />
			<MenuItem label="Calendar" icon="calendar" view="Calendar" />
            <MenuItem v-if="showChat" label="Chat" icon="chat" view="Chat" />
            <MenuItem v-if="showEmail" label="Email" icon="email" view="Email" />
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
        showChat() {
            var query = new URLSearchParams(window.location.search)
            return query.get("chat") == "true";
        },
        showEmail() {
            var query = new URLSearchParams(window.location.search)
            return query.get("email") == "true";
        }
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

	display: flex;
	flex-direction: column;
	height: 100%;
	width: 72px;
	padding-top:16px;
	background: var(--bg-2);
	transition: all 0.5s ease;
}
.app-navigation.expanded {
	width: 240px;
}

.app-navigation .logo {
	width: 100%;
	height: 32px;
	margin:  0;
	padding: 0 16px;
	cursor: pointer;
}

.app-navigation .nav-list {
	margin-top: var(--app-margin);
	margin-bottom: auto;
	padding: 0;
}



.app-navigation .toggle-button--mobile svg,
.app-navigation .toggle-theme--mobile svg {
	width: 24px;
	height: 24px;
}

.app-navigation .toggle-button--mobile {
	/* background-color: var(--bg); */
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
		/* width: 100%; */
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.3s, padding 0s 0.3s;
	}

	.app-navigation.expanded {
		visibility: visible;
		width: 100%;
		opacity: 1;
		transition: opacity 0.3s;
		pointer-events: all;
	}

}
</style>
