<template>
	<div class="app-signup pg-auth">
		<MultiFactorAuth
			v-if="showMultiFactorAuth"
			v-on:hide-confirm="showMultiFactorAuth = false"
			:mfaMethods="mfaMethods"
			:challenge="challenge"
			:consumer_cancel_func="consumer_cancel_func"
			:consumer_func="consumer_func">
		</MultiFactorAuth>
		<template v-if="showSignup()">
			<FormUsername v-model="username" :placeholder="translate('LOGIN.USERNAME')" autocomplete="username" @keyup.enter="mirror()"/>

			<FormPassword v-model="password" :passwordIsVisible="showPasswords" :placeholder="translate('LOGIN.PASSWORD')" firstOfTwo @keyup.enter="mirror()"/>

			<label class="pg-check">
				<input type="checkbox" name="tosAccepted" v-model="tosAccepted"/>
				<span>{{ translate("SIGNUP.ACCEPT") }} <a href="/terms.html" target="_blank" rel="noopener noreferrer">{{ translate("SIGNUP.TERMS") }}</a> {{ translate("SIGNUP.AND") }} <a href="/privacy.html" target="_blank" rel="noopener noreferrer">{{ translate("SIGNUP.POLICY") }}</a></span>
			</label>

			<button type="button" class="pg-btn pg-btn--primary signup" @click="mirror()">
				{{ signupButtonText }}
			</button>
		</template>

		<template v-else-if="showPaidPlans()">
			<BillingPeriod v-model="annual"/>
			<PaidPlans :annual="annual" @choose="setPlan"/>
		</template>

		<template v-else-if="showSignupWarning">
			<h2>This server is currently not accepting mirrors</h2>
			<p>If this is your self-hosted server, ask the administrator to enable mirrors or choose a plan on that same instance.</p>
			<p>The desktop app can be pointed at a self-hosted server with <code>peergos -server-url https://YOUR_SERVER</code> or by setting <code>server-url = https://YOUR_SERVER</code> in <code>~/.peergos/config</code>.</p>
			<p>For security, prefer <code>https</code>; use plain <code>http</code> only for loopback addresses such as <code>http://localhost:8000</code>.</p>
		</template>

		<template v-else>
			<h2>This server is currently not accepting mirrors</h2>
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
const MultiFactorAuth = require("./auth/MultiFactorAuth.vue");
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
	MultiFactorAuth,
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
            annual: true,
            desiredQuota: 0,
            showPasswords: false,
	    acceptingFreeSignups: true,
            acceptingPaidSignups: false,
	    tosAccepted:false,
            showContinue: false,
            continue_message: "Add a payment card",
            continue_body: "Continue to our payment processor to enter your card details",
            continue_func: function(){},
            paymentUrl: "",
            cardFuture: null,
            showSignupWarning: false,
            showMultiFactorAuth: false,
            usage: 0
	};
    },

    computed: {
	...Vuex.mapState([
	    'crypto',
	    'network'
	]),
        signupButtonText() {
            return this.desiredQuota > 0 ? this.translate("MIRROR.MIRRORPAID") : this.translate("MIRROR.MIRRORFREE");
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
        mirror() {
            const creationStart = Date.now();
            const that = this;

            if (this.network == null) {
		this.$toast.error(this.translate("LOGIN.SERVER.NETWORK"), {id:'signup', timeout:false})
            } else if (!that.tosAccepted) {
		this.$toast.error('You must accept the Terms of Service',{id:'signup'})
            } else {
                let usernameRegEx = /^[a-z0-9](?:[a-z0-9]|[-](?=[a-z0-9])){0,31}$/;

		if(!usernameRegEx.test(that.username)) {
		    that.$toast.error('Invalid username. Usernames must consist of between 1 and 32 characters, containing only digits, lowercase letters and hyphen. They also cannot have two consecutive hyphens, or start or end with a hyphen.',{id:'signup',timeout:false})
                } else if (BannedUsernames.includes(that.username)) {
		    that.$toast.error(`Banned username: ${that.username}`,{id:'signup', timeout:false})
                } else {
                    that.$toast.info('Starting mirror...', {id:'signup', timeout:false})
                    var addCard;
                    if (this.acceptingPaidSignups && this.token.length == 0) {
                        addCard = java.util.Optional.of(props => that.addPaymentCard(props));
                    } else {
                        addCard = java.util.Optional.empty();
                    }
                    let handleMfa = function(mfaReq) {
                        let future = peergos.shared.util.Futures.incomplete();
                        let mfaMethods = mfaReq.methods.toArray([]);
                        that.challenge = mfaReq.challenge;
                        that.mfaMethods = mfaMethods;
                        that.consumer_func = (credentialId, resp) => {
                              that.showMultiFactorAuth = false;
                              future.complete(resp);
                        };
                        that.consumer_cancel_func = (credentialId) => {
                            that.showMultiFactorAuth = false;
                            let resp = peergos.client.JsUtil.generateAuthResponse(credentialId, '');
                            future.complete(resp);
                        }
                        that.showMultiFactorAuth = true;
                        return future;
                    };

                    return peergos.shared.user.UserContext.signIn(
			that.username,
			that.password,
			mfaReq => handleMfa(mfaReq),
			false,
                        true,
			that.network,
			that.crypto,
			{"accept" : x => that.$toast.info(x, {id:'signup', timeout:false})}
		    ).thenCompose(function(context) {
                        that.$store.commit('SET_CONTEXT', context);
                        return context.isHome().thenCompose(function(isHome) {
                               if (isHome) {
                                   that.$toast.info("This is your home server", {id:'signup', timeout:false})
                                   return;
                               }
                               return context.getSpaceUsage(false).thenCompose(function(usage) {
                                   that.usage = usage;
                                   if (that.desiredQuota < usage) {
                                       that.$toast.info("Choose a larger plan to mirror all your data", {id:'signup', timeout:false})
                                       return peergos.shared.util.Futures.of(true);
                                   }
                                   // now add a card and then request mirror
                                   return context.mirrorOnThisServer(addCard,
                                           {"accept" : x => that.$toast.info(x, {id:'signup', timeout:false})}).thenApply(function(res) {
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
                                   });
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
