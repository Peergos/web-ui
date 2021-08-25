<template>
	<AppDropdown
			v-if="isLoggedIn"
			class=""
			aria-expanded="true"
			aria-label="settings"
		>
		<template #trigger>
			<div class="drive-user">
				{{ context.username }}
				<img class="cover" v-if="profileImage" :src="profileImage" alt="profile">
				<AppIcon class="cover" v-else icon="user--48" />
			</div>
		</template>
		<ul class="" aria-labelledby="logoutButton">
			<li v-if="isAdmin" v-on:keyup.enter="showAdminPanel()"  @click="showAdminPanel()">
				Admin Panel
			</li>
			<li v-on:keyup.enter="showRequestStorage()" @click="showRequestStorage()">
				Account
			</li>
			<li v-on:keyup.enter="showChangePassword()" @click="showChangePassword()">
				Change Password
			</li>
			<li v-on:keyup.enter="showViewAccount()" @click="showViewAccount()">
				Delete Account
			</li>
			<li class="divider"></li>
			<li v-on:keyup.enter="logout()" @click="logout()">
				Log out
			</li>
		</ul>
	</AppDropdown>
</template>

<script>
const AppDropdown = require("./AppDropdown.vue");

module.exports = {
	components: {
		AppDropdown,
	},
	data() {
		return {
			profileImage: ''
		}
	},
	computed: {
		...Vuex.mapState([
			'isLoggedIn',
			'isAdmin',
			'context'
		])
	},
	methods: {
		 displayProfile() {
			let that = this
			peergos.shared.user.ProfilePaths.getProfile(this.context.username, this.context).thenApply(profile => {
				if (profile.profilePhoto.isPresent()) {
					let str = "";
					let data = profile.profilePhoto.get();
					for (let i = 0; i < data.length; i++) {
						str = str + String.fromCharCode(data[i] & 0xff);
					}
					if (data.byteLength > 0) {
						that.profileImage = "data:image/png;base64," + window.btoa(str);
					}
				}
			})
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
		},
		showViewAccount(){
			this.$store.commit('CURRENT_MODAL', 'ModalAccount');
		},
		logout(){
  			this.$store.commit("SET_USER_CONTEXT", null);
			window.location.fragment = "";
			window.location.reload();
		}

	},
}
</script>

<style>
.drive-user{
	display:flex;
	align-items: center;
}
.drive-user .cover{
	display: inline-block;
	height: 50px;
	width:50px;
	margin-left:8px;
	background-color: var(--bg-2);
	border-radius: 50%;
	object-fit: cover;
	color: var(--color)
}


</style>