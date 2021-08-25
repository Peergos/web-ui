<template>
	<AppModal>
		<template #header>
			<h2>Change password</h2>
		</template>
		<template #body>

         	 <!-- <input type="password" name="pw0" id="pw0" class="form-control" v-model="existing" placeholder="Current password"> -->
			<FormPassword v-model="existing" />


        	<!-- <button @click="generatePassword()" class="btn btn-large btn-block btn-success">Generate password</button> -->
			<AppButton class="generate-password" type="primary" block accent @click.native="generatePassword()">
				Generate password
			</AppButton>

			<FormPassword v-model="password" firstOfTwo />

			<FormPassword v-model="password2"/>


             <!-- <input :type="passwordFieldType" name="password1" id="password1" v-on:keyup="validatePassword(true)" class="form-control password" v-model="password" placeholder="New password">
                    <div v-bind:class="['fa', 'password' == passwordFieldType ? 'fa-eye password-eye' : 'fa-eye-slash password-eye-slash']" @click="togglePassword1()"></div>
                </div>
            </div>
            <div class="form-group flex-row">
                <input :type="password2FieldType" name="password2" id="password2" v-on:focus="validatePassword(false)" class="form-control password" v-model="password2" placeholder="Confirm new password">
                <div v-bind:class="['fa', 'password' == password2FieldType ? 'fa-eye password-eye' : 'fa-eye-slash password-eye-slash']" @click="togglePassword2()"></div>
            </div> -->
        </div>

		</template>
		<template #footer>

			 <AppButton  @click.native="updatePassword()" type="primary" block accent>Change password</AppButton>

		</template>
	</AppModal>
</template>

<script>
const Bip39 = require('../../mixins/password/bip-0039-english.json');
const FormPassword = require("../form/FormPassword.vue");
module.exports = {
	components: {
		FormPassword,
	},
	name: "ModalPassword",
	data() {
        return {
			existing: "",
			password: "",
			password2: "",
        };
    },

	computed: {
		...Vuex.mapState([
			'context'
		]),
    },

	methods: {
		generatePassword() {
			let bytes = nacl.randomBytes(16);
			let wordIndices = [];
			for (var i=0; i < 7; i++)
			wordIndices[i] = bytes[2*i]*8 + (bytes[2*i + 1] & 7);
			let password = wordIndices.map(j => Bip39[j]).join("-");
			this.password = password;
        },

		updatePassword() {
            if(this.existing.length == 0 || this.password.length == 0 || this.password2.length == 0) {
				this.$toast.error('All fields must be populated!',{timeout:false, position: 'bottom-left' })
            } else {
                if (this.password == this.password2) {
                    let that = this;
                    that.context.changePassword(this.existing, this.password).thenApply(function(newContext){

						that.$store.commit("SET_USER_CONTEXT", newContext);
						that.$store.commit("SET_MODAL", false);
						that.$toast.info('Password changed')

					}).exceptionally(function(throwable) {
						// that.$toast.error(throwable.getMessage())
						//
						console.log(throwable.getMessage())
             		});

				} else {
					this.$toast.error('Passwords do not match',{timeout:false, position: 'bottom-left' })
                }
            }
        },
	},

};
</script>
<style>

.app-modal__container h2{
	font-size: var(--title);
	font-weight: var(--bold);
}
.app-modal__container .card__meta{
	background-color: var(--bg-2);
	border-radius: 4px;
	padding: 16px;
	margin-top:var(--app-margin);
	text-align: center;
}
.app-modal__container .card__meta > *{
	margin-top: 0;
}
.app-modal__container .card__meta ul{
	list-style:none;
	padding: 0px;
	text-align: left;
	margin:16px 0;
}
.app-modal__container .card__meta li{
	color: var(--color);
	line-height: 32px;
	background: url('data:image/svg+xml;utf8,<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19.5224 6.16169L9.17909 16.505L4.4776 11.8035" stroke="mediumaquamarine" stroke-width="2"/></svg>') left center no-repeat;
	background-size: 24px auto;
    padding-left: 32px;
}

</style>