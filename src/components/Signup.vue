<template>
	<div class="app-signup pg-auth">
		<template v-if="showSignup()">
			<FormUsername v-model="username" :placeholder="translate('SIGNUP.USERNAME')" autocomplete="username" @keyup.enter="signup()"/>

			<button type="button" class="pg-btn pg-btn--primary generate-password" @click="generatePassword()">
				{{ translate("SIGNUP.GENERATE") }}
			</button>

			<FormPassword v-model="password" :passwordIsVisible="showPasswords" :placeholder="translate('SIGNUP.CLICKGEN')" autocomplete="new-password" firstOfTwo @keyup.enter="signup()"/>

			<FormPassword v-model="password2" :passwordIsVisible="showPasswords" :placeholder="translate('SIGNUP.REENTER')" autocomplete="new-password" @keyup.enter="signup()"/>

			<label class="pg-check">
				<input type="checkbox" name="safePassword" v-model="safePassword"/>
				<span>{{ translate("SIGNUP.AGREE") }}</span>
			</label>

			<label class="pg-check">
				<input type="checkbox" name="tosAccepted" v-model="tosAccepted"/>
				<span>{{ translate("SIGNUP.ACCEPT") }} <a href="/terms.html" target="_blank" rel="noopener noreferrer">{{ translate("SIGNUP.TERMS") }}</a> {{ translate("SIGNUP.AND") }} <a href="/privacy.html" target="_blank" rel="noopener noreferrer">{{ translate("SIGNUP.POLICY") }}</a></span>
			</label>

			<button type="button" class="pg-btn pg-btn--primary signup" @click="signup()">
				{{ signupButtonText }}
			</button>
		</template>

		<template v-else-if="showPaidPlans()">
			<BillingPeriod v-model="annual"/>
			<PaidPlans :annual="annual" @choose="setPlan">
				<li class="pg-plan">
					<h3>{{ translate("SIGNUP.TRYTITLE") }}</h3>
					<p><a href="https://peergos-demo.net/?signup=true" target="_blank" rel="noopener noreferrer">{{ translate("SIGNUP.TRY") }}</a>.</p>
				</li>
			</PaidPlans>
		</template>

		<template v-else-if="showSignupWarning">
			<h2>This server is currently not accepting open signups</h2>
			<p>If this is your self-hosted server, ask the administrator for a signup token or enable signups on that instance.</p>
			<p>The desktop app can be pointed at a self-hosted server with <code>peergos -server-url https://YOUR_SERVER</code> or by setting <code>server-url = https://YOUR_SERVER</code> in <code>~/.peergos/config</code>.</p>
			<p>For security, prefer <code>https</code>; use plain <code>http</code> only for loopback addresses such as <code>http://localhost:8000</code>.</p>
		</template>

		<template v-else>
			<h2>This server is currently not accepting signups</h2>
			<p>Join the waiting list to be notified when there are more places.</p>
			<input
				class="pg-input"
				type="text"
				name="email"
				v-model="email"
				placeholder="Email"
				aria-label="Email"
			/>
			<button type="button" class="pg-btn pg-btn--primary waiting-list" @click="addToWaitList()">
				Join waiting list
			</button>
		</template>
		<continue
			v-if="showContinue"
			v-on:hide-continue="showContinue = false"
			:message='continue_message'
			:body="continue_body"
			:ok_func="continue_func"
			:href="paymentUrl">
		</continue>
	</div>
</template>

<script>
const Bip39 = require('../mixins/password/bip-0039-english.json');
const BannedUsernames = require('../mixins/password/bannedUsernames.json');
const FormPassword = require("./form/FormPassword.vue");
const FormUsername = require("./form/FormUsername.vue");
const BillingPeriod = require("./form/BillingPeriod.vue");
const PaidPlans = require("./form/PaidPlans.vue");
const UriDecoder = require('../mixins/uridecoder/index.js');
const loopback = require("../mixins/loopback/index.js");
const sandboxMixin = require("../mixins/sandbox/index.js");
const i18n = require("../i18n/index.js");
const Continue = require("Continue.vue");
module.exports = {
    components: {
	    FormPassword,
	    FormUsername,
	    BillingPeriod,
	    PaidPlans,
        Continue,
    },

    mixins:[UriDecoder, sandboxMixin, i18n],

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
            annual: false,
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
            paymentUrl: "",
            cardFuture: null,
            showSignupWarning: false,
	};
    },

    computed: {
	...Vuex.mapState([
	    'crypto',
	    'network'
	]),
        signupButtonText() {
            return this.desiredQuota > 0 ? this.translate("SIGNUP.SIGNUPPAID") : this.translate("SIGNUP.SIGNUPFREE");
        },
    },
    watch: {
        network(newNetwork) {
            if (newNetwork != null) {
                this.loadSignupAvailability();
            }
        },
    },
    mounted() {
	this.loadSignupAvailability();
    },

    methods: {
	...Vuex.mapActions([
	    'updateSocial',
	    'updateUsage',
	    'updatePayment'
	]),
        loadSignupAvailability() {
            if (this.network == null) {
                return;
            }
            let that = this;
            this.network.instanceAdmin.acceptingSignups().thenApply(function(res) {
                if (that.token.length > 0) return;
                that.acceptingFreeSignups = res.free;
                that.acceptingPaidSignups = res.paid;
                if (!res.free && loopback.isLoopbackHost(window.location.hostname))
                   that.showSignupWarning = true;
                console.log("accepting signups - free: " + res.free + ", paid: " + res.paid);
            });
        },
        showPaidPlans() {
            return this.token.length == 0 && this.acceptingPaidSignups && this.desiredQuota == 0;
        },
	showSignup() {
            return this.token.length > 0 || this.acceptingFreeSignups || this.desiredQuota > 0;
        },
	setPlan(quotaBytes) {
            this.desiredQuota = quotaBytes;
        },
	addToWaitList() {
	    var that = this;
	    if (this.network == null) {
		that.$toast.error(this.translate("LOGIN.SERVER.NETWORK"), {timeout:false})
                return
	    }
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
        startAddCardListener(future) {
            var that = this;
            this.currentFocusFunction = function(event) {
                that.$toast.info('Completing signup', {id:'signup', timeout:false})
                window.removeEventListener("focus", that.currentFocusFunction);
                future.complete(new peergos.shared.util.Plan(that.desiredQuota,  that.annual))
            };
	    window.addEventListener("focus", this.currentFocusFunction, false);
	},
        confirmAddCard() {
            this.continue_func = this.addCard;
            this.showContinue = true;
        },
        addCard() {
            //  open payment card page in new tab
            //let link = document.createElement('a')
            //let click = new MouseEvent('click')
            //link.target = "_blank";
            //link.href = this.paymentUrl;
            //link.dispatchEvent(click);
            this.startAddCardListener(this.cardFuture);
            this.$toast.info('Opening payment provider', {id:'signup', timeout:false})
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

            if (this.network == null) {
		this.$toast.error(this.translate("LOGIN.SERVER.NETWORK"), {id:'signup', timeout:false})
            } else if(!that.safePassword) {
		this.$toast.error('You must accept the password safety warning', {id:'signup'})
	    } else if (!that.tosAccepted) {
		this.$toast.error('You must accept the Terms of Service',{id:'signup'})
            } else if (that.password != that.password2) {
		this.$toast.error('Passwords do not match!',{id:'signup'})
	    } else if (that.password == '') {
		this.$toast.error('Please generate your password',{id:'signup'})
            } else {
                let usernameRegEx = /^[a-z0-9](?:[a-z0-9]|[-](?=[a-z0-9])){0,31}$/;

		if(!usernameRegEx.test(that.username)) {
		    that.$toast.error('Invalid username. Usernames must consist of between 1 and 32 characters, containing only digits, lowercase letters and hyphen. They also cannot have two consecutive hyphens, or start or end with a hyphen.',{id:'signup',timeout:false})
                } else if (BannedUsernames.includes(that.username)) {
		    that.$toast.error(`Banned username: ${that.username}`,{id:'signup', timeout:false})
                } else {
                    that.$toast.info('Signing up...', {id:'signup', timeout:false})
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
			{"accept" : x => that.$toast.info(x, {id:'signup', timeout:false})}
		    ).thenApply(function(context) {
            		    sessionStorage.removeItem(idKey);
                        that.$store.commit('SET_CONTEXT', context);
                        that.$store.commit('USER_LOGIN', true);
			that.installDefaultApp().thenApply(function(props) {
                            that.initSandboxedApps().thenApply(function(res) {
                                that.$store.commit('CURRENT_VIEW', 'Drive');
                                that.$store.commit('CURRENT_MODAL', 'ModalTour');
                                that.updatePayment()
                                that.updateUsage()
                                console.log("Signing in/up took " + (Date.now()-creationStart)+" mS from function call");
                                that.$toast.dismiss('signup');
                            });
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
