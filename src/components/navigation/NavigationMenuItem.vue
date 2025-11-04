<template>
	<li class="menu-item" :class="{ 'active': isCurrentView }">
		<AppButton @click.native="setView(view)" :disabled="disabled">
			<AppIcon class="menu__icon" :icon="icon"></AppIcon>
			<span class="menu__name">{{ label }} </span>
		</AppButton>
		<span class="menu__tooltip">{{ label }}</span>
	</li>
</template>

<script>
const AppButton = require("../AppButton.vue");
const AppIcon = require("../AppIcon.vue");
const router = require("../../mixins/router/index.js");
module.exports = {
	components: {
	    AppButton,
    	AppIcon,
	},
	props: {
		icon: {
			type: String,
			default: "",
		},
		label: {
			type: String,
			default: "",
		},
		view: {
			type: String,
			default: "",
		},
		disabled: {
			type: Boolean,
			default: false,
		},
	},
    	mixins:[router],
	computed: {
		...Vuex.mapState([
			'context'
		]),...Vuex.mapGetters([
		    'isMobile',
                    'getPath'
		]),
		isCurrentView() {
			return  this.view === this.$store.state.currentView;
		},

	},
	methods: {
		setView(view) {
			if(this.isMobile){
				this.$store.commit("TOGGLE_SIDEBAR");
			}
			this.openFileOrDir(view, this.context.username, {filename:""});
		},
	},
};
</script>

<style>
.menu-item {
	position: relative;
	height: 64px;
	padding: 0;
	list-style: none;
	line-height: 64px;
	margin: 0;
	color: var(--color-2);
	display: flex;
	align-items: center;
}

.menu-item.active {
	color: var(--color);
}


.menu-item button {
	width: 100%;
	height: 100%;
	white-space: nowrap;
	padding: 0 16px;
	line-height: 32px;
	text-align: left;
}

.menu-item button svg {
	width: 32px;
	height: 32px;
}


.app-navigation .menu__name {
	opacity: 0;
	pointer-events: none;
	transition: all 0.3s ease;
}

.app-navigation.expanded .menu__name {
	transition: 0s;
	opacity: 1;
	pointer-events: auto;
	margin-left: 4px;
}

.app-navigation .menu__tooltip {
	display: block;
	border-radius: 4px;
	padding: 8px 8px;
	font-size:16px;
	line-height: 14px;
	background: var(--bg-2);
	pointer-events: none;
	transition: 0s;
	opacity: 0;
	color: var(--color-hover);

}

.app-navigation.expanded .menu__tooltip {
	display: none;
}

.menu-item:hover {
	color: var(--color-hover);
}

.app-navigation .menu-item:hover .menu__tooltip {
	transition: all 0.5s ease;
	opacity: 1;
	transform: translateX(16px);
}

@media (max-width: 1024px) {
	.app-navigation .menu__name {
		transition: none;
	}
}
</style>
