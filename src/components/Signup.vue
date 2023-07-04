<template>
	<div class="app-signup">
		<template v-if="showSignup()">
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

			<FormPassword v-model="password" :passwordIsVisible="showPasswords" placeholder="Click generate password" firstOfTwo />

			<FormPassword v-model="password2" :passwordIsVisible="showPasswords" placeholder="Re-enter password" @keyup.native.enter="signup()"/>

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
				{{ signupButtonText }}
			</AppButton>
		</template>

                <template v-else-if="showPaidPlans()">
                        <div class="options_container">
			    <div class="card__meta options">
				<h3>Pro Account</h3>
				<ul>
				    <li>50 GB of hyper secure storage</li>
				    <li>All our bundled private applications</li>
				    <li>&#x00A3;5 / month</li>
				</ul>
                                <AppButton @click.native="setPlan(53687091200)" type="primary" block accent>Select Pro</AppButton>
			    </div>
                            <div class="card__meta options">
				<h3>Visionary Account</h3>
				<ul>
				    <li>500 GB of hyper secure storage</li>
				    <li>All our bundled private applications</li>
				    <li>&#x00A3;25 / month</li>
				</ul>
                                <AppButton @click.native="setPlan(536870912000)" type="primary" block accent>Select Visionary</AppButton>
			    </div>
                            <div class="card__meta options">
				<h3>Want to try it first?</h3>
				<label>Try it for free on our <u><a href="https://peergos-demo.net/?signup=true" target="_blank">demo server</a></u>.
                                </label>
			    </div>
                        </div>
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
                <continue
                    v-if="showContinue"
                    v-on:hide-continue="showContinue = false"
                    :message='continue_message'
                    :body="continue_body"
                    :ok_func="continue_func">
                </continue>
	</div>
</template>

<script>
import AppButton from "./AppButton.vue";
import Bip39 from '../mixins/password/bip-0039-english.js';
import BannedUsernames from '../mixins/password/bannedUsernames.js';
import FormPassword from "./form/FormPassword.vue";
import UriDecoder from '../mixins/uridecoder/index.js';
import sandboxMixin from "../mixins/sandbox/index.js";
import Continue from "./Continue.vue";

// import Vuex from "vuex"
import { mapState, mapActions } from 'vuex'
import { toast } from 'vue3-toastify';
import 'vue3-toastify/dist/index.css';

export default {
    components: {
        AppButton,
	    FormPassword,
        Continue,
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
            desiredQuota: 0,
            showPasswords: false,
	    acceptingFreeSignups: true,
            acceptingPaidSignups: false,
	    tosAccepted:false,
	    safePassword:false,
            showContinue: false,
            continue_message: "Add a payment card",
            continue_body: "Continue to our payment processor to enter your card details",
            continue_func: function(){},
            cardFuture: null,
	};
    },

    computed: {
	...mapState([
	    'crypto',
	    'network'
	]),
        signupButtonText() {
            return this.desiredQuota > 0 ? "Add payment card and sign up" : "Sign up";
        },
    },
    mounted() {
	this.$refs.username.focus()
	let that = this;
	this.network.instanceAdmin.acceptingSignups().thenApply(function(res) {
	    if (that.token.length > 0) return;
	    that.acceptingFreeSignups = res.free;
            that.acceptingPaidSignups = res.paid;
	    console.log("accepting signups - free: " + res.free + ", paid: " + res.paid);
	});
    },

    methods: {
	...mapActions([
	    'updateSocial',
	    'updateUsage',
	    'updatePayment'
	]),
        showPaidPlans() {
            return this.token.length == 0 && this.acceptingPaidSignups && this.desiredQuota == 0;
        },
	showSignup() {
            return this.token.length > 0 || this.acceptingFreeSignups || this.desiredQuota > 0;
        },
	setPlan(quotaBytes) {
            this.desiredQuota = quotaBytes;
        },
	lowercaseUsername(){
	    this.username.toLowerCase()
	},
	addToWaitList() {
	    var that = this;
	    let emailRegEx = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,24}))$/ ;
	    if(!emailRegEx.test(that.email)) {
		toast.error('Invalid email.',{autoClose:false})
                return
	    }
	    this.network.instanceAdmin.addToWaitList(that.email).thenApply(function(res) {
		that.email='';
		toast.info("Congratulations, you have joined the waiting list. We'll be in touch as soon as a place is available.")
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
        startAddCardListener(future) {
            var that = this;
            this.currentFocusFunction = function(event) {
                toast.info('Completing signup', {id:'signup', autoClose:false})
                window.removeEventListener("focus", that.currentFocusFunction);
                future.complete(peergos.shared.util.LongUtil.box(that.desiredQuota))
            };
	    window.addEventListener("focus", this.currentFocusFunction, false);
	},
        confirmAddCard() {
            this.continue_func = this.addCard;
            this.showContinue = true;
        },
        addCard() {
            //  open payment card page in new tab
            let link = document.createElement('a')
            let click = new MouseEvent('click')
            link.target = "_blank";
            link.href = this.paymentUrl;
            link.dispatchEvent(click);
            this.startAddCardListener(this.cardFuture);
            toast.info('Opening payment provider', {id:'signup', autoClose:false})
        },
        addPaymentCard(props) {
            this.paymentUrl = props.getUrl() + "&username=" + this.username + "&client_secret=" + props.getClientSecret();
            this.cardFuture = peergos.shared.util.Futures.incomplete();
            this.confirmAddCard();
            return this.cardFuture;
        },
        signup() {
            const creationStart = Date.now();
            const that = this;

            if(!that.safePassword) {
		toast.error('You must accept the password safety warning', {id:'signup'})
	    } else if (!that.tosAccepted) {
		toast.error('You must accept the Terms of Service',{id:'signup'})
            } else if (that.password != that.password2) {
		toast.error('Passwords do not match!',{id:'signup'})
	    } else if (that.password == '') {
		toast.error('Please generate your password',{id:'signup'})
            } else {
                let usernameRegEx = /^[a-z0-9](?:[a-z0-9]|[-](?=[a-z0-9])){0,31}$/;

		if(!usernameRegEx.test(that.username)) {
		    toast.error('Invalid username. Usernames must consist of between 1 and 32 characters, containing only digits, lowercase letters and hyphen. They also cannot have two consecutive hyphens, or start or end with a hyphen.',{id:'signup',autoClose:false})
                } else if (BannedUsernames.includes(that.username)) {
		    toast.error(`Banned username: ${that.username}`,{id:'signup', autoClose:false})
                } else {
                    toast.info('Signing up...', {id:'signup', autoClose:false})
                    var addCard;
                    if (this.acceptingPaidSignups && this.token.length == 0) {
                        addCard = java.util.Optional.of(props => that.addPaymentCard(props));
                    } else {
                        addCard = java.util.Optional.empty();
                    }
                    let idKey = that.username + "$id";
                    let id = sessionStorage.getItem(idKey);
                    let idOpt = id == null ? java.util.Optional.empty() : java.util.Optional.of(id);
                    let idStore = (idVal) => sessionStorage.setItem(idKey, idVal);
                    return peergos.shared.user.UserContext.signUp(
			that.username,
			that.password,
			that.token,
			idOpt,
			{ accept: (x) => idStore(x) },
                        addCard,
			that.network,
			that.crypto,
			{"accept" : x => toast.info(x, {id:'signup', autoClose:false})}
		    ).thenApply(function(context) {
            		    sessionStorage.removeItem(idKey);
                        that.$store.commit('SET_CONTEXT', context);
                        that.$store.commit('USER_LOGIN', true);
			that.installDefaultApp().thenApply(function(props) {
                            that.initSandboxedApps().thenApply(function(res) {
                                that.$store.commit('CURRENT_VIEW', 'Drive');
                                that.$store.commit('CURRENT_MODAL', 'ModalTour');
                                that.updatePayment()
                                that.updateSocial()
                                that.updateUsage()
                                console.log("Signing in/up took " + (Date.now()-creationStart)+" mS from function call");
                                toast.remove('signup');
                            });
                        });
                    }).exceptionally(function(throwable) {
                        toast.error(that.uriDecode(throwable.getMessage()),{autoClose:false, id: 'signup'})
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
