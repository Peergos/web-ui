<template>
	<li class="list-item" :class="{ 'current-view': isCurrentView }">
		<AppButton @click.native="setView(view)">
			<AppIcon class="list-item__icon" :icon="icon"></AppIcon>
			<span class="list-item__name">{{ label }} </span>
		</AppButton>
		<span class="tooltip">{{ label }}</span>
	</li>
</template>

<script>
module.exports = {
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
	},
	computed: {
		isCurrentView() {
			return  this.view === this.$store.state.currentView;
		},
	},
	methods: {
		setView(view) {
			this.$store.commit("CURRENT_VIEW", view);
		},
	},
};
</script>

<style>
.list-item {
	position: relative;
	height: 64px;
	padding: 0;
	list-style: none;
	line-height: 64px;
	margin: 0;
	color: var(--color);
}

.list-item.current-view {
	color: var(--color-hover);
}

.list-item + .list-item {
	margin-top: 0;
}

.list-item button {
	width: 100%;
	height: 100%;
	white-space: nowrap;
	padding: 16px;
}

.list-item button svg {
	width: 32px;
	height: 32px;
}

.sidebar.active .list-item button {
	text-align: left;
}

.sidebar .list-item__name {
	opacity: 0;
	pointer-events: none;
	transition: all 0.3s ease;
}

.sidebar.active .list-item__name {
	transition: 0s;
	opacity: 1;
	pointer-events: auto;
	margin-left: 4px;
}

.sidebar .tooltip {
	position: absolute;
	left: 96px;
	top: 0;
	transform: translateY(-50%);
	border-radius: 4px;
	padding: 4px 8px;
	background: var(--bg-2);
	line-height: 1;
	transition: 0s;
	opacity: 0;
	pointer-events: none;
	display: block;
}

.sidebar.active .tooltip {
	display: none;
}

.list-item:hover {
	background-color: var(--bg-2-hover);
	color: var(--color-hover);
}

.sidebar .list-item:hover .tooltip {
	transition: all 0.5s ease;
	opacity: 1;
	top: 50%;
}

@media (max-width: 1024px) {
	.sidebar .list-item__name {
		transition: none;
	}
}
</style>