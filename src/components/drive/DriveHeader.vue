<template>
	<header class="drive-header">

		<div class="drive-breadcrumb">

			<AppButton class="breadcrumb__root" aria-label="global files" @click.native="$emit('goBackToLevel', 0 )">
				<AppIcon icon="globe-24"/>
				<span v-if="!path.length">global</span>
			</AppButton>

			<template v-for="(dir, index) in path">
				<AppIcon v-if="index!==0" icon="chevron-down" class="breadcrumb__separator" aria-hidden="true"/>
				<AppButton :key="index" class="breadcrumb__item" :aria-label="dir" tabindex="-1" @click.native="$emit('goBackToLevel', index + 1 )">{{ dir }}</AppButton>
			</template>
		</div>

		<AppButton
			class="change-view"
			:icon="gridView ? 'list' : 'grid'"
			:aria-label="gridView ? 'list view' : 'grid view'"
			@keyup.enter="$emit('switchView')"
			@click.native="$emit('switchView')"
		/>

		<AppDropdown
			v-if="isWritable"
			class="upload"
			icon="plus"
			type="primary"
			accent
			aria-label="Upload"
		>
			<ul>
				<li @click="askForFiles()">Upload files</li>
				<li @click="askForDirectories()">Upload folders</li>
				<li @click="$emit('askMkdir')">Create folder</li>
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
	methods: {
		askForFiles() {
			document.getElementById('uploadFileInput').click();
		},

		askForDirectories() {
			document.getElementById('uploadDirectoriesInput').click();
		},
	},
}
</script>

<style>
.drive-header {
	display: flex;
	justify-content: flex-start;
	align-items: center;

	height: 64px;
	text-align: left;

	padding: 0 16px;
}

.drive-header > *{
	margin-left: 16px;
}


.drive-breadcrumb{
	background-color: var(--bg-2);
	border-radius: 6px;
	padding: 4px 8px;
	margin-right:auto;
	color: var(--color-2);
}
.drive-breadcrumb .breadcrumb__root span{
	padding-left: 16px;
	font-weight: var(--regular);
}
.drive-breadcrumb .breadcrumb__separator{
	transform: rotate(-90deg);
	width:16px;
}
.drive-breadcrumb .breadcrumb__item{
	font-weight: var(--regular);
}
.drive-breadcrumb .breadcrumb__item:last-child{
	color: var(--color);
	background-color: var(--bg-2);
}


.drive-header .upload{
	margin-right: 200px;
}

</style>
