<template>
	<div class="app-signup">
		<template v-if="acceptingSignups">
			<input
				type="text"
				autofocus
				name="username"
				v-model="username"
				ref="username"
				placeholder="Public username"
				@input="(val) => (username = username.toLowerCase())"
			/>

			<AppButton class="generate-password" type="primary" block accent @click.native="generatePassword()">
				Generate password
			</AppButton>

			<FormPassword v-model="password" :passwordIsVisible="showPasswords" firstOfTwo />

			<FormPassword v-model="password2" :passwordIsVisible="showPasswords" @keyup.native.enter="signup()"/>

			<label class="checkbox__group">
				I understand that passwords cannot be reset or recovered - if I forget my password, then I will lose access to my
				account and data. If I enter my password into a malicious website then I will lose control of my account.
				<input
					type="checkbox"
					name="safePassword"
					v-model="safePassword"
				/>
				<span class="checkmark"></span>
			</label>

			<label class="checkbox__group">
				I accept the <a href="/terms.html" target="_blank" rel="noopener noreferrer">Terms of Service</a> and <a href="/privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
				<input
					type="checkbox"
					name="tosAccepted"
					v-model="tosAccepted"
				/>
				<span class="checkmark"></span>
			</label>

			<AppButton class="signup" type="primary" block accent @click.native="signup()" icon="arrow-right">
				Sign up
			</AppButton>
		</template>

		<template v-else>
			<h2>This server is currently not accepting signups</h2>
			<p>Join the waiting list to be notified when there are more places.</p>
			<input
			    type="text"
			    name="email"
			    v-model="email"
			    placeholder="Email"
			/>
			<AppButton
			    @click.native="addToWaitList()"
			    class="waiting-list"
			    type="primary"
                            block
                            accent
			>
				Join waiting list
			</AppButton>
		</template>
	</div>
</template>

<script>
const Bip39 = require('../mixins/password/bip-0039-english.json');
const BannedUsernames = require('../mixins/password/bannedUsernames.json');
const FormPassword = require("./form/FormPassword.vue");
const UriDecoder = require('../mixins/uridecoder/index.js');
const sandboxMixin = require("../mixins/sandbox/index.js");
module.exports = {
    components: {
	FormPassword,
    },

    mixins:[UriDecoder, sandboxMixin],

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
	    email: '',
            showPasswords: false,
	    acceptingSignups: true,
	    tosAccepted:false,
	    safePassword:false,
	};
    },

    computed: {
	...Vuex.mapState([
	    'crypto',
	    'network'
	]),
    },
    mounted() {
	this.$refs.username.focus()
	let that = this;
	this.network.instanceAdmin.acceptingSignups().thenApply(function(res) {
	    if (that.token.length > 0) return;
	    that.acceptingSignups = res;
	    console.log("accepting signups: " + res);
	});
    },

    methods: {
	...Vuex.mapActions([
	    'updateSocial',
	    'updateUsage',
	    'updatePayment'
	]),
	lowercaseUsername(){
	    this.username.toLowerCase()
	},
	addToWaitList() {
	    var that = this;
	    let emailRegEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,24}))$/ ;
	    if(!emailRegEx.test(that.email)) {
		that.$toast.error('Invalid email.',{timeout:false})
                return
	    }
	    this.network.instanceAdmin.addToWaitList(that.email).thenApply(function(res) {
		that.email='';
		that.$toast.info("Congratulations, you have joined the waiting list. We'll be in touch as soon as a place is available.")
	    });

	},
	generatePassword() {
	    let bytes = nacl.randomBytes(16);
	    let wordIndices = [];
	    for (var i=0; i < 7; i++)
		wordIndices[i] = bytes[2*i]*8 + (bytes[2*i + 1] & 7);
	    let password = wordIndices.map(j => Bip39[j]).join("-");
	    this.password = password;
            this.showPasswords = true;
        },
        signup() {
            const creationStart = Date.now();
            const that = this;

            if(!that.safePassword) {
		this.$toast.error('You must accept the password safety warning', {id:'signup'})
	    } else if (!that.tosAccepted) {
		this.$toast.error('You must accept the Terms of Service',{id:'signup'})
            } else if (that.password != that.password2) {
		this.$toast.error('Passwords do not match!',{id:'signup'})
	    } else if (that.password == '') {
		this.$toast.error('Please generate your password',{id:'signup'})
            } else {
                let usernameRegEx = /^[a-z0-9](?:[a-z0-9]|[_-](?=[a-z0-9])){0,31}$/;

		if(!usernameRegEx.test(that.username)) {
		    that.$toast.error('Invalid username. Usernames must consist of between 1 and 32 characters, containing only digits, lowercase letters, underscore and hyphen. They also cannot have two consecutive hyphens or underscores, or start or end with a hyphen or underscore.',{id:'signup',timeout:false})
                } else if (BannedUsernames.includes(that.username)) {
		    that.$toast.error(`Banned username: ${that.username}`,{id:'signup', timeout:false})
                } else {
                    that.$toast.info('signing up!', {id:'signup'})
                    return peergos.shared.user.UserContext.signUp(
					that.username,
					that.password,
					that.token,
					that.network,
					that.crypto,
					{"accept" : x => that.$toast.info(x, {id:'signup', timeout:false})}
					).thenApply(function(context) {
                        that.$store.commit('SET_CONTEXT', context);
                        that.$store.commit('USER_LOGIN', true);
					    that.installDefaultApps().thenApply(function() {
                            that.initSandboxedApps();
                            that.$store.commit('CURRENT_VIEW', 'Drive');
                            that.$store.commit('CURRENT_MODAL', 'ModalTour');
                            that.updatePayment()
                            that.updateSocial()
                            that.updateUsage()
                            console.log("Signing in/up took " + (Date.now()-creationStart)+" mS from function call");
                            that.$toast.dismiss('signup');
                        });
                    }).exceptionally(function(throwable) {
                        that.$toast.error(that.uriDecode(throwable.getMessage()),{timeout:false, id: 'signup'})
                    });
                }
            }
		},
    }
};
</script>

<style>
.app-signup .generate-password,
.app-signup .signup,
.app-signup .waiting-list{
	margin: 8px 0;
}


/* Waiting list */
.app-signup h2{
	margin-bottom: 28px;
	font-size: var(--title);
	line-height: var(--title-height);
	font-weight: var(--bold);
	text-align: left;
}
.app-signup p{
	text-align: left;
}
</style>
