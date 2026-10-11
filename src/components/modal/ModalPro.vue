<template>
	<AppModal :title="upgradeTitle" wide>
		<template #body>
			<p>{{ translate("SPACE.CURRENT") }}: {{ quota }}</p>
			<p v-if="!isPaid" class="pg-note">{{ translate("PAID.AGREE") }} <a href="/terms.html" target="_blank" rel="noopener noreferrer">Terms of Service</a>.</p>
			<p v-if="willCharge()" class="pg-note">Next charge: &#x00A3;{{ nextCharge() }} on {{ getExpiry() }}</p>
			<div v-if="!showCard" class="pro__billing" data-select="billing">
				<label class="pro__billing-entry" :class="{'pro__billing-entry--on': !annual}" @click="setMonthly()">Monthly<input type="radio" name="billing" value="monthly" v-bind:checked="!annual"></label>
				<label class="pro__billing-entry" :class="{'pro__billing-entry--on': annual}" @click="setAnnual()">Yearly<input type="radio" name="billing" value="yearly" v-bind:checked="annual"></label>
			</div>
			<div v-if="!showCard" class="pro__plans">
				<div class="pro__plan">
					<h4>Pro {{ translate("PAID.ACCOUNT") }}</h4>
					<ul>
						<li>200 GB {{ translate("PAID.STORAGE") }}</li>
						<li>{{ translate("PAID.APPS") }}</li>
						<li>&#x00A3;{{ price1() }}</li>
					</ul>
					<button type="button" class="pg-btn pg-btn--primary" :disabled="disablePro" @click="confirmUpdate(200000000000)">{{proButtonText}}</button>
				</div>
				<div class="pro__plan">
					<h4>Visionary {{ translate("PAID.ACCOUNT") }}</h4>
					<ul>
						<li>1000 GB {{ translate("PAID.STORAGE") }}</li>
						<li>{{ translate("PAID.APPS") }}</li>
						<li>&#x00A3;{{ price2() }}  {{ prorataTextVisionary }}</li>
					</ul>
					<button type="button" class="pg-btn pg-btn--primary" :disabled="disableVisionary" @click="confirmUpdate(1000000000000)">{{visionaryButtonText}}</button>
				</div>
				<div class="pro__plan">
					<h4>Pioneer {{ translate("PAID.ACCOUNT") }}</h4>
					<ul>
						<li>3000 GB {{ translate("PAID.STORAGE") }}</li>
						<li>{{ translate("PAID.APPS") }}</li>
						<li>&#x00A3;{{ price3() }}  {{ prorataTextPioneer }}</li>
					</ul>
					<button type="button" class="pg-btn pg-btn--primary" :disabled="disablePioneer" @click="confirmUpdate(3000000000000)">{{pioneerButtonText}}</button>
				</div>
			</div>
			<div v-if="showCard" class="pro__payment">
				<iframe id="paymentframe" :src="paymentUrl" referrerpolicy="origin"/>
			</div>
			<Confirm
				v-if="showConfirm"
				v-on:hide-confirm="showConfirm = false"
				:confirm_message='confirm_message'
				:confirm_body="confirm_body"
				:consumer_cancel_func="confirm_consumer_cancel_func"
				:consumer_func="confirm_consumer_func">
			</Confirm>
		</template>
		<template v-if="isPaid" #footer>
			<button type="button" class="pg-btn" @click="updateCardDetails()">{{ translate("PAID.CARD") }}</button>
			<button type="button" class="pg-btn pg-btn--danger" @click="cancelPaid()">{{ translate("PAID.CANCEL") }}</button>
		</template>
	</AppModal>
</template>

<script>
const AppModal = require("AppModal.vue");
const Confirm = require("../confirm/Confirm.vue");
const i18n = require("../../i18n/index.js");

module.exports = {
	components: {
	    AppModal,
            Confirm,
	},
        mixins:[i18n],
	data() {
		return {
			unit:"GiB",
			space:"",
			proMb: 200*1000,
                        visionaryMb: 1000*1000,
                        pioneerMb: 3000*1000,
                        gettingCard: false,
                        paymentUrl:null,
			showCard:false,
                        currentAnnual: false,
                        annual: false,
                        currentFocusFunction:null,
                        showConfirm: false,
                        confirm_message: "",
                        confirm_body: "",
                        confirm_consumer_cancel_func: () => {},
                        confirm_consumer_func: () => {},
		};
	},
	computed: {
		...Vuex.mapState([
			'context',
			'quotaBytes',
			'usageBytes',
			'paymentProperties'
		]),
		...Vuex.mapGetters([
			'quota',
			'usage'
		]),

		isPaid() {
            return this.quotaBytes/(1000*1000) > this.paymentProperties.freeMb() && this.paymentProperties.desiredMb() > 0;
		},
                disablePro() {
                    return this.isPro || this.usageBytes/(1000*1000) > this.proMb;
                },
		disableVisionary() {
                    return this.isVisionary || this.usageBytes/(1000*1000) > this.visionaryMb;
                },
		disablePioneer() {
                    return this.isPioneer || this.usageBytes/(1000*1000) > this.pioneerMb;
                },
		isPro() {
                    return this.quotaBytes/(1000*1000) > this.paymentProperties.freeMb() && this.paymentProperties.desiredMb() == this.proMb && this.annual == this.currentAnnual;
                },

            isVisionary() {
                return this.quotaBytes/(1000*1000) > this.paymentProperties.freeMb() && this.paymentProperties.desiredMb() == this.visionaryMb && this.annual == this.currentAnnual;
            },

            isPioneer() {
                return this.quotaBytes/(1000*1000) > this.paymentProperties.freeMb() && this.paymentProperties.desiredMb() == this.pioneerMb && this.annual == this.currentAnnual;
            },

            prorataTextVisionary() {
                if (this.isPro)
                    return " ("+this.translate("PAID.PRORATA")+")";
                else
                    return ""
            },
            prorataTextPioneer() {
                if (this.isPro || this.isVisionary)
                    return " ("+this.translate("PAID.PRORATA")+")";
                else
                    return ""
            },
            upgradeTitle(){
			return (this.isPaid)
				? this.translate("PAID.SETTINGS")
				: this.translate("PAID.UPGRADE")
	    },
            proButtonText(){
                return (this.isPro)
				? this.translate("PAID.CURRENT")
				: this.translate("PAID.PRO")
            },
            visionaryButtonText(){
                return (this.isVisionary)
				? this.translate("PAID.CURRENT")
				: this.translate("PAID.VISIONARY")
            },
            pioneerButtonText(){
                return (this.isPioneer)
				? this.translate("PAID.CURRENT")
				: this.translate("PAID.PIONEER")
            }
    },

    mounted() {
        this.updateError()
        this.currentAnnual = this.paymentProperties.isAnnual();
        console.log("annual :" + this.annual)
    },
    
	methods: {
		...Vuex.mapActions([
			'updateQuota',
			'updatePayment'
		]),
            setMonthly() {
            this.annual = false;
        },

        willCharge() {
            return this.paymentProperties.getExpiry().isPresent() && this.paymentProperties.desiredMb() > 0;
        },

        getExpiry() {
            return this.paymentProperties.getExpiry().get();
        },

        nextCharge() {
            return this.paymentProperties.getNextCharge();
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
        startAddCardListener: function(desired) {
                var that = this;
                this.currentFocusFunction = function(event) {
                    that.requestStorage(desired);
                };
	        window.addEventListener("focus", this.currentFocusFunction, false);
	    },
	    requestStorage(bytes) {
		var that = this;
                window.removeEventListener("focus", this.currentFocusFunction);
                console.log("requesting annual " + this.annual);
		this.context.requestSpace(bytes, this.annual)
		    .thenApply(x => that.updateQuota(quotaBytes => {
			console.log(quotaBytes,'quotaBytes')
                        
			if (quotaBytes >= bytes && bytes > 0) {
			    that.updatePayment()
			    that.$store.commit("SET_MODAL", false)
			    that.$toast.info(that.translate("PAID.THANKYOU"),{timeout:false, id: 'pro'})                            
			} else if (bytes == 0) {
			    that.updatePayment()
			    that.$store.commit("SET_MODAL", false)
			    that.$toast.error(that.translate("PAID.SORRY"), {timeout:false, id: 'pro'})
			} else if (quotaBytes < bytes && bytes > 0 ) {
                            that.updatePayment(() => {
                                that.updateError()
                                if (! that.paymentProperties.hasError())
			            that.$toast.error(that.translate("PAID.CARD.NEEDED"),{timeout:false, id: 'pro'})
                            });
			} else
                            that.updatePayment(() => that.updateError());
		    })).exceptionally(t => {
                        that.$toast.error(that.translate("PAID.ERROR.STORAGE")+": " + t.getMessage())
                    })
	    },
            
	    updateError() {
		if (this.paymentProperties.hasError()) {
		    this.$toast.error(this.paymentProperties.getError(),{timeout:false, id: 'payment'})
		}
	    },

            updateCardDetails() {
                this.updateCard(this.paymentProperties.desiredMb()*1000*1000)
            },

            confirmUpdate(bytes) {
                this.confirm_message = "Confirm plan change";
                this.confirm_body = "Do you want to switch to the " + (this.annual ? "annual ": "monthly ") + (bytes/1000000000) + "GB plan?" + (this.annual ? " You will switch to annual and be billed at the end of your current billing month." : "");
                var that = this;
                this.confirm_consumer_func = () => that.updateCard(bytes),
                this.showConfirm = true;
            },
            
    	    updateCard(desired) {
		console.log('updateCard')
		var that = this;
		this.context.getPaymentProperties(true).thenApply(function(props) {
		    that.paymentUrl = props.getUrl() + "&username=" + that.context.username + "&client_secret=" + props.getClientSecret();
                    //  open payment card page in new tab
                    let link = document.createElement('a')
                    let click = new MouseEvent('click')
                    link.target = "_blank";
                    link.href = that.paymentUrl;
                    link.dispatchEvent(click);
		    //that.showCard = true;
            	    that.startAddCardListener(desired);
		});
	    },
            
	    cancelPaid() {
                this.$store.commit("CURRENT_MODAL", "ModalCancel");
            },
	},
};
</script>
<style>
/* The plans side by side where there is room and one above the other where there is not,
   each on the field surface with its price and a way to choose it at the foot. */
.pro__billing {
	display: inline-flex;
	align-self: center;
	gap: 2px;
	padding: 3px;
	border-radius: var(--radius-pill);
	background-color: var(--pg-surface-2);
}

.pro__billing-entry {
	display: flex;
	align-items: center;
	height: 34px;
	margin: 0;
	padding: 0 16px;
	border-radius: var(--radius-pill);
	font-size: var(--text-small);
	font-weight: var(--bold);
	color: var(--pg-muted);
	cursor: pointer;
}

/* the chosen period in the primary button's colours, which keep their contrast in both themes */
.pro__billing-entry--on {
	background-color: var(--pg-primary);
	color: var(--pg-on-primary);
}

.pro__billing input[type="radio"] {
	display: none;
}

.pro__plans {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
	gap: 12px;
}

.pro__plan {
	display: flex;
	flex-direction: column;
	gap: 10px;
	padding: 16px;
	border-radius: var(--radius-control);
	background-color: var(--pg-surface-2);
}

.pro__plan h4 {
	margin: 0;
	font-size: 16px;
	font-weight: 600;
}

.pro__plan ul {
	display: flex;
	flex-direction: column;
	gap: 6px;
	flex: 1 1 auto;
	margin: 0;
	padding: 0;
	list-style: none;
}

.pro__plan li {
	padding-left: 26px;
	font-size: var(--text-small);
	background: url('data:image/svg+xml;utf8,<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19.5224 6.16169L9.17909 16.505L4.4776 11.8035" stroke="mediumaquamarine" stroke-width="2"/></svg>') left 2px no-repeat;
	background-size: 18px auto;
}

/* the payment provider's form keeps its own size where it fits and narrows where it does not */
.pro__payment {
	display: flex;
	justify-content: center;
}

.pro__payment iframe {
	width: 100%;
	max-width: 450px;
	height: 420px;
	border: none;
}
</style>
