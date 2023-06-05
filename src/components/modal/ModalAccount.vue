<template>
	<AppModal>
		<template #header>
			<h2>Delete Account</h2>
		</template>
		<template #body>
			<p>If you choose to proceed you will lose access to your account and data!</p>
            <p>This action is not reversible</p>
            <p>You must enter your password to confirm you want to delete your account and all your data</p>

			<FormPassword v-model="password" />

			<div class="modal__warning account" v-if="warning">
				<p><AppIcon icon="warning"/> Are you absolutely sure you want to delete your account?</p>
				<AppButton @click.native="deleteAccount()" accent >Yes, delete everything</AppButton>
				<AppButton @click.native="warning=false">Nevermind</AppButton>
			</div>

		</template>
		<template #footer>

			 <AppButton @click.native="showWarning()" type="primary" block accent>Delete account</AppButton>

		</template>
	</AppModal>
</template>

<script>
const AppButton = require("../AppButton.vue");
const AppModal = require("AppModal.vue");
const AppIcon = require("../AppIcon.vue");
const FormPassword = require("../form/FormPassword.vue");
module.exports = {
	components: {
	    AppButton,
	    AppModal,
	    AppIcon,
		FormPassword,
	},
	data() {
		return {
			password: "",
			warning: false

		};
	},
	computed: {
		...Vuex.mapState([
			'context'
		]),
    },

	methods: {
		showWarning() {
			if(this.password.length == 0) {
				this.$toast.error('Password must be populated!',{timeout:false, position: 'bottom-left' })
			} else {
				this.warning = true
			}
		},

		deleteAccount() {
            console.log("Deleting Account");
            var that = this;
            this.context.deleteAccount(this.password).thenApply(function(result){
                if (result) {
					that.$toast('Account Deleted!',{position: 'bottom-left' })
					that.$store.commit("SET_MODAL", false);
                	that.exit()
                } else {
					that.$toast(`Error Deleting Account: ${throwable.getMessage()}`,{position: 'bottom-left' })
                }
            }).exceptionally(function(throwable) {
                that.$toast(`Error Deleting Account: ${throwable.getMessage()}`,{position: 'bottom-left' })
            });
        },
		exit(){

			setTimeout(()=>{
				window.location.fragment = "";
				window.location.reload();
			 }, 3000);
		}
	},

};
</script>
<style>
.modal__warning {
	background-color: var(--bg-2);
	border-radius: 4px;
	padding: 16px;
}
.modal__warning.account p {
	margin-bottom: var(--app-margin);
}
</style>