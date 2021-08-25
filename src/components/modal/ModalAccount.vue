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

		</template>
		<template #footer>

			 <AppButton @click.native="deleteAccountAction()" type="primary" block accent>Delete Account</AppButton>

		</template>
	</AppModal>
</template>

<script>
const FormPassword = require("../form/FormPassword.vue");
module.exports = {
	components: {
		FormPassword,
	},
    // props: ['deleteAccount', 'username'],
	data() {
		return {
			password: "",
		};
	},

	computed: {
		...Vuex.mapState([
			'context'
		]),
    },

	methods: {
		confirmDeleteAccount(deleteAccountFn) {
			this.$toast.error('Are you absolutely sure you want to delete your account?',{timeout:false, position: 'bottom-left' })
            // this.warning_consumer_func = deleteAccountFn;
        },
        completeDeleteAccount() {
            this.deleteAccount(this.password);
			this.$store.commit("SET_MODAL", false);
        },
        deleteAccountAction() {
            if(this.password.length == 0) {
				this.$toast.error('Password must be populated!',{timeout:false, position: 'bottom-left' })
            } else {
                let that = this;
                this.confirmDeleteAccount(() => that.completeDeleteAccount());
            }
        },

		deleteAccount(password) {
            console.log("Deleting Account");
            // var that = this;
            // this.context.deleteAccount(password).thenApply(function(result){
            //     if (result) {
			// 		that.$toast('Account Deleted!',{position: 'bottom-left' })
            //         // setTimeout(function(){ that.logout(); }, 5000);
            //     } else {
            //         that.updateFiles();
            //         that.errorTitle = "Error Deleting Account";
            //         that.errorBody = throwable.getMessage();
            //         that.showError = true;
            //         that.showSpinner = false;
            //     }
            // }).exceptionally(function(throwable) {
            //     that.updateFiles();
            //     that.errorTitle = "Error Deleting Account";
            //     that.errorBody = throwable.getMessage();
            //     that.showError = true;
            //     that.showSpinner = false;
            // });
        },
	},

};
</script>
<style>

</style>