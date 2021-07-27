<template>
	<div class="app-signup">
		<template v-if="acceptingSignups">
			<input
				type="text"
				autofocus
				name="username"
				v-model="username"
				placeholder="Public username"
				@input="(val) => (username = username.toLowerCase())"
			/>

			<AppButton class="generate-password" @click="generatePassword()">
				Generate password
			</AppButton>

			<FormPassword v-model="password" firstOfTwo />

			<FormPassword v-model="password2"/>

			<div class="checkbox__group">
				<input
					type="checkbox"
					name="safePassword"
					id="safePassword"
					v-model="safePassword"
					placeholder="Safely store your password"
				>
				<label for="safePassword">I understand that passwords cannot be reset or recovered - if I forget my password, then I will lose access to my
				account and data. If I enter my password into a malicious
				website then I will lose control of my account.
				</label>
			</div>

			<div class="checkbox__group">
				<input
					type="checkbox"
					name="tosAccepted"
					id="tosAccepted"
					v-model="tosAccepted"
					placeholder="Accept Terms of Service"
				/>
				<label for="tosAccepted">
					I accept the <a href="/terms.html" target="_blank" rel="noopener noreferrer">Terms of Service</a> and <a href="/privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
				</label>
			</div>

			<AppButton class="signup" @click="signup()">
				Sign up
				<AppIcon :width="24" :height="24" icon="arrow-right"/>
			</AppButton>
		</template>

		<template v-else><h4>This server is currently not accepting signups</h4>
			Join the waiting list to be notified when there are more places.
			<div class="form-group">
				<input
					type="text"
					name="email"
					id="email"
					class="form-control"
					v-model="email"
					placeholder="Email"
				/>
			</div>
			<button
				@click="addToWaitList()"
				class="btn btn-large btn-block btn-success"
			>
				Join waiting list
			</button>
			<message
				v-if="showMessage"
				v-on:remove-message="showMessage = false"
				:title="message.title"
				:message="message.body"
			>
			</message>
		</template>
	</div>
</template>

<script>
const Bip39 = require('../mixins/password/bip-0039-english.json');
const BannedUsernames = require('../mixins/password/bannedUsernames.json');

module.exports = {
	// components: {
	// 	FormPassword,
	// },

	props: {
		token: {
			type: String,
			default: ''
		},
	},

    data() {
        return {
			username: '',
			password: '',
			password2: '',
			acceptingSignups: true,
			email: [],
			tosAccepted:false,
			safePassword:false,
        };
    },

	computed: {
		...Vuex.mapState([
			'crypto',
			'network'
		]),

		// host() {
		// 	return window.location.origin;
		// }
    },
	mounted() {
		let that = this;
		this.network.instanceAdmin.acceptingSignups().thenApply(function(res) {
			if (that.token.length > 0) return;
			that.acceptingSignups = res;
			console.log("accepting signups: " + res);
		});
	},

    methods: {
		lowercaseUsername(){
			console.log('lowercaseUsername', this.username,	this.username.toLowerCase())


			this.username.toLowerCase()
		},

		addToWaitList() {
			var that = this;
			this.network.instanceAdmin.addToWaitList(this.email).thenApply(function(res) {
			that.message.title = "Congratulations";
			that.message.body = "You have joined the waiting list";
			that.showMessage = true;
			});
		},
		generatePassword() {
			let bytes = nacl.randomBytes(16);
			let wordIndices = [];
			for (var i=0; i < 7; i++)
			wordIndices[i] = bytes[2*i]*8 + (bytes[2*i + 1] & 7);
			let password = wordIndices.map(j => Bip39[j]).join("-");
			this.password = password;

        },
        signup() {
            const creationStart = Date.now();
            const that = this;

            if(!that.safePassword) {
			 	this.$toast.error('You must accept the password safety warning')
		 	}else if (!that.tosAccepted) {
				this.$toast.error('You must accept the Terms of Service')
            } else if (that.password != that.password2) {
				this.$toast.error('Passwords do not match!')
            } else {
                let usernameRegEx = /^[a-z0-9](?:[a-z0-9]|[_-](?=[a-z0-9])){0,31}$/;

				if(!usernameRegEx.test(that.username)) {
					that.$toast.error('Invalid username. Usernames must consist of between 1 and 32 characters, containing only digits, lowercase letters, underscore and hyphen. They also cannot have two consecutive hyphens or underscores, or start or end with a hyphen or underscore.',{timeout:false})
                } else if (BannedUsernames.includes(that.username)) {
					that.$toast.error(`Banned username: ${that.username}`,{timeout:false})
                } else {
                   	that.$toast.info('signing up!')
                    return peergos.shared.user.UserContext.signUp(
						that.username,
						that.password,
						that.token,
						that.network,
						that.crypto,
                    	// {"accept" : x => that.spinnerMessage = x}
						{"accept" : x => that.$toast.info(x)}
						)
                        .thenApply(function(context) {
                            // that.$emit("filesystem", {context: context, signup:true});
							that.$store.commit("CURRENT_VIEW", 'Drive');
							that.$store.commit("SET_USER_CONTEXT", context);
							that.$store.commit('USER_LOGIN', true);
                            console.log("Signing in/up took " + (Date.now()-creationStart)+" mS from function call");
                        })
						.exceptionally(function(throwable) {
                           that.$toast.error(throwable.getMessage(),{timeout:false})
                        });
                }
            }
		},
    }
};
</script>

<style>
.app-signup .generate-password,
.app-signup .signup{
	width:100%;
	margin: 8px 0;

	background-color: var(--green-500);
	text-align: center;
	line-height: 32px;
	color: var(--bg);
}

.app-signup .generate-password:hover,
.app-signup .signup:hover{
	color: var(--bg);
	background-color: var(--green-200);
}

.app-signup .generate-password:focus,
.app-signup .signup:focus{
	outline:none;
	background-color: var(--color-hover);
}

.app-signup .checkbox__group{
	display:flex;
	align-items: flex-start;
}
.app-signup .checkbox__group label{
	font-weight: var(--regular);
	text-align: left;
	margin-left:8px;
}

</style>
