<template>
	<header class="drive-header">

			<AppButton
				class="toggle-button desktop"
				round
				icon
				small
				@click="toggleSidebar"
			>
				<AppIcon :icon="isOpen ? 'chevron-left' : 'chevron-right'"/>
			</AppButton>

			<h2>My files</h2>
			<div class="drive-breadcrumb">
				<template v-for="(dir, index) in path">
					<span class="breadcrumb__separator"> / </span>
					<AppButton tabindex="-1" @click="$emit('goBackToLevel', index + 1 )">{{ dir }}</AppButton>
				</template>
			</div>

			<AppButton
				@keyup.enter="$emit('switchView')"
				@click="$emit('switchView')"
				class="change-view"
			>
				<AppIcon :icon="gridView ? 'list' : 'grid'" />
				<span class="desktop">{{ gridView ? "List view" : "Grid view"}}</span>
			</AppButton>

			<AppDropdown
				v-if="isWritable"
				icon="add"
				aria-label="Upload"
			>
				<ul>
					<li @click="$emit('askForFiles')">upload file</li>
					<li @click="$emit('askForDirectories')">upload directory</li>
					<li @click="$emit('askMkdir')">create new folder</li>
				</ul>
			</AppDropdown>

	</header>
</template>

<script>
const AppDropdown = require("../AppDropdown.vue");

module.exports = {
	components: {
		AppDropdown,
	},
	props: {
		gridView: {
			type: Boolean,
			default: true
		},
		isWritable: {
			type: Boolean,
			default: true
		},
		path:{
			type: Array,
			default: ()=>[]
		}
	},
	computed: {
		isOpen() {
			return this.$store.state.isSidebarOpen;
		},
	},
	methods: {
		toggleSidebar() {
			this.$store.commit("TOGGLE_SIDEBAR");
		}
	},
}
</script>

<style>

.drive-header {


	display: flex;
	justify-content: flex-start;
	align-items: baseline;

	height: 64px;
	text-align: left;

	padding: 0 16px;

	/* transition: margin 0.5s ease; */
}

.drive-header > *{
	margin-left: 16px;
}

.drive-header .toggle-button {
	width: 32px;
	top: 16px;
	background-color: var(--bg-2);
}

.drive-header .toggle-button svg {
	width: 100%;
	height: 100%;
}

</style>