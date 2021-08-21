<template>
	<header class="drive-header">

			<AppButton
				class="toggle-button desktop"
				round
				icon="chevron-down"
				:class="{active : isOpen}"
				small
				@click="toggleSidebar"
			/>

			<h2>My files</h2>
			<div class="drive-breadcrumb">
				<template v-for="(dir, index) in path">
					<span class="breadcrumb__separator"> / </span>
					<AppButton tabindex="-1" @click="$emit('goBackToLevel', index + 1 )">{{ dir }}</AppButton>
				</template>
			</div>

			<AppButton
				class="change-view"
				:icon="gridView ? 'list' : 'grid'"
				@keyup.enter="$emit('switchView')"
				@click="$emit('switchView')"
			/>

			<AppDropdown
				v-if="isWritable"
				icon="plus"
				type="primary"
				accent
				aria-label="Upload"
			>
				<ul>
					<li @click="$emit('askForFiles')">upload file</li>
					<li @click="$emit('askForDirectories')">Upload directory</li>
					<li @click="$emit('askMkdir')">Add folder</li>
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
	transform: rotate(-90deg);
	transition: transform 0.5s;

}
.drive-header .toggle-button.active svg{
	transform: rotate(90deg);
}

</style>