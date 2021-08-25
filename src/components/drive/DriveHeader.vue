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

		<AppDropdown
			v-if="isLoggedIn"
			class=""
			aria-expanded="true"
			aria-label="settings"
		>
		<template #trigger>
			<div class="drive-user">
				{{ userName }} <span class="picture--temp"></span>
			</div>
		</template>
		<ul class="" aria-labelledby="logoutButton">
			<li v-if="isAdmin" v-on:keyup.enter="showAdminPanel">
				<a @click="showAdminPanel">Admin Panel</a>
			</li>
			<li class="settings-item" v-on:keyup.enter="showRequestStorage()">
				<a @click="showRequestStorage()">Account</a>
			</li>
			<li class="settings-item" v-on:keyup.enter="showChangePassword()">
				<a @click="showChangePassword()">Change Password</a>
			</li>
			<!-- <li class="settings-item" v-on:keyup.enter="showViewAccount">
				<a @click="showViewAccount">Delete Account</a>
			</li>
			<li role="separator" class="divider"></li>
			<li class="settings-item" v-on:keyup.enter="logout">
				<a v-on:keyup.enter="logout" @click="logout">Log out</a>
			</li> -->
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
		...Vuex.mapState([
			'isLoggedIn',
			'isAdmin',
			'context'
		]),
		userName(){
			return this.context.username
		}
	},
	methods: {
		askForFiles() {
			document.getElementById('uploadFileInput').click();
		},

		askForDirectories() {
			document.getElementById('uploadDirectoriesInput').click();
		},
        showAdminPanel() {
            if (this.context == null)
                return;
			console.log('admin panel...')
            // const that = this;
            // this.context.getAndDecodePendingSpaceRequests().thenApply(reqs => {
            //     that.admindata.pending = reqs.toArray([]);
            //     that.showAdmin = true;
            // });
        },
		showRequestStorage() {
			this.$store.commit('CURRENT_MODAL', 'ModalSpace');
		},
		showChangePassword(){
			this.$store.commit('CURRENT_MODAL', 'ModalPassword');
		}
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

.drive-user{
	display:flex;
	align-items: center;
}
.drive-user .picture--temp{
	display: inline-block;
	height: 50px;
	width:50px;
	margin-left:8px;
	background-color: var(--bg-2);
	border-radius: 50%;
}

</style>
