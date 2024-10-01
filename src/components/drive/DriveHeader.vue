<template>
	<header class="drive-header">

			<nav class="drive-breadcrumb">
				<AppButton v-if="!(path.length >2 && path[1] == '.apps')" class="breadcrumb__root" aria-label="global files" @click.native="$emit('goBackToLevel', 0 )">
					<AppIcon icon="globe--24"/>
					<span v-if="!path.length">global</span>
				</AppButton>

				<template v-if="!(path.length >2 && path[1] == '.apps')" v-for="(dir, index) in path">
					<AppIcon v-if="index!==0" icon="chevron--24" class="breadcrumb__separator" aria-hidden="true"/>
					<AppButton :key="index" class="breadcrumb__item" :aria-label="dir" tabindex="-1" @click.native="$emit('goBackToLevel', index + 1 )">{{ dir }}</AppButton>
				</template>
                <template v-if="path.length >2 && path[1] == '.apps'" v-for="(dir, index) in path">
                    <AppIcon v-if="index>2" icon="chevron--24" class="breadcrumb__separator" aria-hidden="true"/>
                    <AppButton v-if="index>2" :key="index" class="breadcrumb__item" :aria-label="dir" tabindex="-1" @click.native="$emit('goBackToLevel', index + 1 )">{{ dir }}</AppButton>
                    <AppButton v-if="index==2" :key="index" class="breadcrumb__item" :aria-label="dir" tabindex="-1">{{ dir }}</AppButton>
                </template>
			</nav>

			<div class="drive-tools">
				<AppButton
					class="change-view"
					:icon="gridView ? 'list' : 'grid'"
					:aria-label="gridView ? 'list view' : 'grid view'"
					@keyup.enter="$emit('switchView')"
					@click.native="$emit('switchView')"
				/>

				<AppButton
					class="search"
					icon="search"
					aria-label="search"
					@keyup.enter="$emit('search')"
					@click.native="$emit('search')"
				/>

				<AppDropdown
					v-if="isWritable"
					class="upload"
					icon="plus"
					accent
					aria-label="Upload"
				>
					<ul>
						<li @click="askForFiles()">{{ translate("DRIVE.UPLOAD.FILES") }}</li>
						<li @click="askForDirectories()">{{ translate("DRIVE.UPLOAD.FOLDER") }}</li>
						<li @click="$emit('createFile')">{{ translate("DRIVE.NEW.FILE") }}</li>
						<li @click="$emit('askMkdir')">{{ translate("DRIVE.NEW.FOLDER") }}</li>
						<li @click="$emit('newApp')">{{ translate("DRIVE.NEW.APP") }}</li>
                        <li v-if="canPaste" @click="$emit('paste')">{{ translate("DRIVE.PASTE") }}</li>
					</ul>
				</AppDropdown>
			</div>

			<UserSettings />
            <AppSandbox
                v-if="showAppSandbox"
                v-on:hide-app-sandbox="closeAppSandbox"
                :sandboxAppName="sandboxAppName"
                :currentFile=null>
            </AppSandbox>
	</header>
</template>

<script>
const AppButton = require("../AppButton.vue");
const AppDropdown = require("../AppDropdown.vue");
const AppIcon = require("../AppIcon.vue");
const AppSandbox = require("../sandbox/AppSandbox.vue");
const UserSettings = require("../UserSettings.vue");
const i18n = require("../../i18n/index.js");

module.exports = {
	components: {
	    AppButton,
		AppDropdown,
		AppIcon,
        AppSandbox,
		UserSettings
	},
    mixins:[i18n],
    data() {
        return {
            showAppSandbox: false,
            sandboxAppName: ''
        };
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
		canPaste: {
			type: Boolean,
			default: false
		},
		path:{
			type: Array,
			default: ()=>[]
		}
	},
	computed: {
        ...Vuex.mapState([
            "sandboxedApps"
        ]),
	},
	methods: {
	    appCreateNewInstance(appName) {
            this.showAppSandbox = true;
            this.sandboxAppName = appName;
        },
        closeAppSandbox() {
            this.showAppSandbox = false;
        },
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
}

.drive-header .drive-tools{
	flex:1 0 auto;
	display: flex;
	justify-content: flex-end;
	align-items: center;
	padding: 0 32px;

}

.drive-header .drive-tools > *{
	margin-right: 16px;
}


.drive-breadcrumb{
	padding: 4px 32px;
	color: var(--color-2);
}
.drive-breadcrumb .breadcrumb__root span{
	padding-left: 16px;
	font-weight: var(--regular);
}
.drive-breadcrumb .breadcrumb__separator{
	width:16px;
}
.drive-breadcrumb .breadcrumb__item{
	font-weight: var(--regular);
}
.drive-breadcrumb .breadcrumb__item:last-child{
	color: var(--color);
	/* background-color: var(--bg-2); */
}


.drive-header .upload button{
	width:36px;
	height: 36px;
	padding: 0;
	text-align: center;
	line-height: 24px;
	/* margin-right: 20px; */
}

@media screen and (max-width: 1024px) {
	.drive-header {
		flex-wrap: wrap;
		flex-direction: row;
		/* flex-direction: column; */
	}
	.drive-header > * {
		width:100%;
		min-height: 64px;
		padding: 0 16px;
	}


	.drive-header .drive-tools{
		flex:0 1 50%;
		order: 1;
		margin-left: 0;
		padding: 0 0 0 16px ;
		flex-direction: row-reverse;
	}

	.drive-header .user-settings{
		order: 2;
		flex: 0 1 50%;
		justify-content: flex-end;
		margin-right: 0;
		padding-left: 0;
	}
	.drive-header .drive-breadcrumb{
		order: 3;
		flex:1 0 100%;
		padding: 8px 16px;
		border-top: 1px solid var(--border-color);
	}
}
</style>
