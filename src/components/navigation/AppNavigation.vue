<template>
	<nav class="app-navigation" :class="{ expanded: isOpen }">

		<div class="nav-dismiss" @click="toggleSidebar()" aria-hidden="true"></div>

		<AppIcon class="logo" :icon="isOpen ? 'logo-full' : 'logo-min'" @click.native="toggleSidebar()"/>

		<AppButton
			class="toggle-theme"
			size="small"
			:icon="isDark ? 'sun' : 'moon'"
			@click.native="toggleTheme()"
			aria-label="Toggle themes"
		/>

		<ul class="nav-list">
            <MenuItem :label="translate('APPNAV.LAUNCHER')" icon="launcher" view="Launcher" />
			<MenuItem :label="translate('APPNAV.DRIVE')" icon="folder" view="Drive" />
            <MenuItem :label="translate('APPNAV.SHAREDWITH')" icon="shared" view="SharedWith" />
            <MenuItem :label="translate('APPNAV.SYNC')" icon="sync" view="Sync"/>
            <MenuItem :label="translate('APPNAV.MOUNT')" icon="drive" view="Mount"/>
			<MenuItem :label="translate('APPNAV.NEWSFEED')" icon="news" view="NewsFeed" />
			<MenuItem :label="translate('APPNAV.SOCIAL')" icon="social" view="Social" />
			<MenuItem :label="translate('APPNAV.CAL')" icon="calendar" view="Calendar" />
		</ul>


		<NavigationStorage
			:is-premium="false"
		/>
	</nav>
</template>

<script>
const AppButton = require("../AppButton.vue");
const AppIcon = require("../AppIcon.vue");
const MenuItem = require('./NavigationMenuItem.vue');
const NavigationStorage = require('./NavigationStorage.vue');
const loopback = require("../../mixins/loopback/index.js");
const i18n = require("../../i18n/index.js");

module.exports = {
	components: {
	    AppButton,
    	AppIcon,
		MenuItem,
		NavigationStorage,
	},
        mixins:[i18n],
        mounted: function() {
                // a phone's panel starts closed however the last desktop session left it:
                // restoring "open" here reopened it every time picking a view remounted this
                if (this.$store.getters.isMobile) {
                    this.$store.commit("SET_SIDEBAR", false);
                    return;
                }
                let open = localStorage.getItem("side-bar-open");
                if (open != null)
                    this.$store.commit("SET_SIDEBAR", "true" === open);
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
		isLocalHost() {
		    return loopback.isLoopbackHost(window.location.hostname);
		},
	},
	methods: {
		toggleSidebar() {
			this.$store.commit("TOGGLE_SIDEBAR");
                        localStorage.setItem("side-bar-open", this.isOpen ? "true" : "false");
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
	flex-shrink: 0;
}

.app-navigation .nav-list {
	margin-top: var(--app-margin);
	margin-bottom: auto;
	padding: 0;
}



.app-navigation .toggle-theme svg {
	width: 24px;
	height: 24px;
}

/* nothing to dismiss beside a sidebar that is always there */
.nav-dismiss {
	display: none;
}

/* in the sidebar's own corner, not the screen's: at the screen's it would land on the
   header buttons of the view showing beside the panel */
.app-navigation .toggle-theme {
	position: absolute;
	top: 16px;
	right: 16px;
	opacity: 1;
}

@media (min-width: 1025px) {
	/* the rail has no room beside the crest, so the theme arrives with the labels */
	.app-navigation .toggle-theme {
		display: none;
	}

	.app-navigation.expanded .toggle-theme {
		display: block;
	}
}

@media (max-width: 1024px) {
	/* a panel beside the view, not a sheet in place of it: as wide as its own content,
	   and the same shape open or closed, so closing is a fade with nothing moving */
	.app-navigation,
	.app-navigation.expanded {
		width: max-content;
		max-width: 85vw;
	}

	.app-navigation {
		border-right: 1px solid var(--border-color);
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.3s, padding 0s 0.3s;
	}

	.app-navigation.expanded {
		visibility: visible;
		opacity: 1;
		transition: opacity 0.3s;
		pointer-events: all;
	}

	/* labels and figure stay visible while the panel fades; a tooltip only earns its
	   place beside a rail of bare icons */
	.app-navigation .menu-item .menu__name,
	.app-navigation .navigation-storage .storage {
		opacity: 1;
	}

	.app-navigation .menu-item .menu__name {
		margin-left: 4px;
	}

	.app-navigation .menu-item .menu__tooltip {
		display: none;
	}

	/* a tap on the view dismisses the panel, without dimming what is under it: the
	   layer starts at the panel's own edge, so a tap on the panel itself is not one */
	.app-navigation.expanded .nav-dismiss {
		display: block;
		position: absolute;
		top: 0;
		bottom: 0;
		left: 100%;
		width: 100vw;
		z-index: -1;
		background-color: transparent;
	}
}
</style>
