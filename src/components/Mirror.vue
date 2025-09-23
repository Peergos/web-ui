<template>
	<div class="app-signup">
                <MultiFactorAuth
                v-if="showMultiFactorAuth"
                v-on:hide-confirm="showMultiFactorAuth = false"
                :mfaMethods="mfaMethods"
                :challenge="challenge"
                :consumer_cancel_func="consumer_cancel_func"
                :consumer_func="consumer_func">
        </MultiFactorAuth>
		<template v-if="showSignup()">
			<input
				type="text"
				autofocus
				name="username"
				v-model="username"
				ref="username"
				:placeholder="translate('LOGIN.USERNAME')"
				@input="(val) => (username = username.toLowerCase())"
			/>

			<FormPassword v-model="password" :passwordIsVisible="showPasswords" :placeholder="translate('LOGIN.PASSWORD')" firstOfTwo />

			<label class="checkbox__group">
				{{ translate("SIGNUP.ACCEPT") }} <a href="/terms.html" target="_blank" rel="noopener noreferrer">{{ translate("SIGNUP.TERMS") }}</a> {{ translate("SIGNUP.AND") }} <a href="/privacy.html" target="_blank" rel="noopener noreferrer">{{ translate("SIGNUP.POLICY") }}</a>
				<input
					type="checkbox"
					name="tosAccepted"
					v-model="tosAccepted"
				/>
				<span class="checkmark"></span>
			</label>

			<AppButton class="signup" type="primary" block accent @click.native="mirror()" icon="arrow-right">
				{{ signupButtonText }}
			</AppButton>
		</template>

                <template v-else-if="showPaidPlans()">
                        <div class="options_container">
                            <div class="button-group-container">
                                <div class="priceslider" data-select="billing"> 
                                     <label class="entry" @click="setMonthly()">Monthly<input type="radio" name="billing" value="monthly"></label>
                                     <label class="entry" @click="setAnnual()">Yearly<input type="radio" name="billing" value="yearly" v-bind:checked="annual"></label>
                                </div>
                            </div>
			    <div class="card__meta options">
				<h3>Pro Account</h3>
				<ul>
				    <li>200 GB {{ translate("SIGNUP.HYPER") }}</li>
				    <li>{{ translate("SIGNUP.BUNDLED") }}</li>
				    <li>&#x00A3;{{ price1() }}</li>
				</ul>
                                <AppButton @click.native="setPlan(200000000000)" type="primary" block accent>Select Pro</AppButton>
			    </div>
                            <div class="card__meta options">
				<h3>Visionary Account</h3>
				<ul>
				    <li>1000 GB {{ translate("SIGNUP.HYPER") }}</li>
				    <li>{{ translate("SIGNUP.BUNDLED") }}</li>
				    <li>&#x00A3;{{ price2() }}</li>
				</ul>
                                <AppButton @click.native="setPlan(1000000000000)" type="primary" block accent>Select Visionary</AppButton>
			    </div>
                            <div class="card__meta options">
				<h3>Pioneer Account</h3>
				<ul>
				    <li>3000 GB {{ translate("SIGNUP.HYPER") }}</li>
				    <li>{{ translate("SIGNUP.BUNDLED") }}</li>
				    <li>&#x00A3;{{ price3() }}</li>
				</ul>
                                <AppButton @click.native="setPlan(3000000000000)" type="primary" block accent>Select Pioneer</AppButton>
			    </div>
                        </div>
                </template>

                <template v-else-if="showSignupWarning">
                    <h2>This server is currently not accepting mirrors</h2>
		    <strong>Please sign up here first: <br/>
                    <a class="line" href="https://peergos.net?signup=true">https://peergos.net?signup=true</a>.</strong>
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
const AppButton = require("AppButton.vue");
const Bip39 = require('../mixins/password/bip-0039-english.json');
const BannedUsernames = require('../mixins/password/bannedUsernames.json');
const FormPassword = require("./form/FormPassword.vue");
const UriDecoder = require('../mixins/uridecoder/index.js');
const sandboxMixin = require("../mixins/sandbox/index.js");
const i18n = require("../i18n/index.js");
const Continue = require("Continue.vue");
module.exports = {
    components: {
        AppButton,
	FormPassword,
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
	    email: '',
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
    mounted() {
	this.$refs.username.focus()
	let that = this;
	this.network.instanceAdmin.acceptingSignups().thenApply(function(res) {
	    if (that.token.length > 0) return;
	    that.acceptingFreeSignups = res.free;
            that.acceptingPaidSignups = res.paid;
            if (!res.free && window.location.hostname == "localhost")
               that.showSignupWarning = true;
	    console.log("accepting signups - free: " + res.free + ", paid: " + res.paid);
	});
    },

    methods: {
	...Vuex.mapActions([
	    'updateSocial',
	    'updateUsage',
	    'updatePayment'
	]),
        setMonthly() {
            this.annual = false;
        },
        setAnnual() {
            this.annual = true;
        },
        price1() {
            return (this.annual ? 3 : 4) + " / " + this.translate("SIGNUP.MONTH") + ", " + (this.annual ? this.translate("SIGNUP.BILL.YEARLY") : this.translate("SIGNUP.BILL.MONTHLY"));
        },
        price2() {
            return (this.annual ? 8 : 10) + " / " + this.translate("SIGNUP.MONTH") + ", " + (this.annual ? this.translate("SIGNUP.BILL.YEARLY") : this.translate("SIGNUP.BILL.MONTHLY"));
        },
        price3() {
            return (this.annual ? 20 : 25) + " / " + this.translate("SIGNUP.MONTH") + ", " + (this.annual ? this.translate("SIGNUP.BILL.YEARLY") : this.translate("SIGNUP.BILL.MONTHLY"));
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

            if (!that.tosAccepted) {
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

<style>
.button-group-container {
	margin-block: 24px;
	display: flex;
	justify-content: center;
	gap: 8px;
}

.priceslider {
	display: flex;
	align-items: center;
	height: 36px;

	border-radius: 36px;
	background-color: #efefef;
}

.priceslider .entry {
	display: flex;
	align-items: center;
	padding: 0 16px;
	border-radius: 36px;
	height: 36px;
	font-weight: var(--bold);
	color: var(--gray-3);
	cursor: pointer;
}

.entry:has(input:checked),
.entry.active {
	background-color: var(--green-500);
	color: white;
}

input[type="radio"] {
	height: 0;
	width: 0;
	visibility: hidden;
	display: none;
}


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
