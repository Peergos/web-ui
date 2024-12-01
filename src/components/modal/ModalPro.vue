<template>
	<AppModal>
		<template #header>
			<h2>{{upgradeTitle}}</h2>
		</template>
		<template #body>

			<h2 class="card__meta"> {{ translate("SPACE.CURRENT") }}: {{ quota }}</h2>

                        <p v-if="!isPaid">{{ translate("PAID.AGREE") }} <a href="/terms.html" target="_blank" rel="noopener noreferrer">Terms of Service</a>.</p>
                        <center><div v-if="!showCard" class="button-group-container">
                            <div class="priceslider" data-select="billing"> 
                                <label class="entry" @click="setMonthly()">Monthly<input type="radio" name="billing" value="monthly" v-bind:checked="!annual"></label>
                                <label class="entry" @click="setAnnual()">Yearly<input type="radio" name="billing" value="yearly" v-bind:checked="annual"></label>
                            </div>
                        </div>
                        </center>
                        <div v-if="!showCard" class="options_container">
                            
			    <div class="card__meta options">
				<h3>Pro {{ translate("PAID.ACCOUNT") }}</h3>
				<ul>
				    <li>200 GB {{ translate("PAID.STORAGE") }}</li>
				    <li>{{ translate("PAID.APPS") }}</li>
				    <li>&#x00A3;{{ price1() }}</li>
				</ul>
                                <AppButton @click.native="updateCard(200000000000)" :disabled="disablePro" type="primary" block accent>{{proButtonText}}</AppButton>
			    </div>
                            <div class="card__meta options">
				<h3>Visionary {{ translate("PAID.ACCOUNT") }}</h3>
				<ul>
				    <li>1000 GB {{ translate("PAID.STORAGE") }}</li>
				    <li>{{ translate("PAID.APPS") }}</li>
				    <li>&#x00A3;{{ price2() }}  {{ prorataTextVisionary }}</li>
				</ul>
                                <AppButton @click.native="updateCard(1000000000000)" :disabled="disableVisionary" type="primary" block accent>{{visionaryButtonText}}</AppButton>
			    </div>
                            <div class="card__meta options">
				<h3>Pioneer {{ translate("PAID.ACCOUNT") }}</h3>
				<ul>
				    <li>3000 GB {{ translate("PAID.STORAGE") }}</li>
				    <li>{{ translate("PAID.APPS") }}</li>
				    <li>&#x00A3;{{ price3() }}  {{ prorataTextPioneer }}</li>
				</ul>
                                <AppButton @click.native="updateCard(3000000000000)" :disabled="disablePioneer" type="primary" block accent>{{pioneerButtonText}}</AppButton>
			    </div>
                        </div>

			<div v-if="showCard">
			    <iframe id="paymentframe" style="border: none;" width="450px" height="420px" :src="paymentUrl" referrerpolicy="origin"/>
			</div>

		</template>
		<template #footer>
			<AppButton v-if="isPaid" @click.native="updateCardDetails()" type="primary" block accent>{{ translate("PAID.CARD") }}</AppButton>
			<AppButton v-if="isPaid" @click.native="cancelPaid()" type="primary" block class="alert" >{{ translate("PAID.CANCEL") }}</AppButton>
		</template>
	</AppModal>
</template>

<script>
const AppButton = require("../AppButton.vue");
const AppModal = require("AppModal.vue");
const i18n = require("../../i18n/index.js");

module.exports = {
	components: {
	    AppButton,
	    AppModal,
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
                        annual: true,
                        currentFocusFunction:null,
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
			            that.$toast.error(that.translate("PAID.CARD.NEEDED"),{timeout:false, id: 'pro', position: 'bottom-left'})
                            });
			} else
                            that.updatePayment(() => that.updateError());
		    })).exceptionally(t => {
                        that.$toast.error(that.translate("PAID.ERROR.STORAGE")+": " + t.getMessage())
                    })
	    },
            
	    updateError() {
		if (this.paymentProperties.hasError()) {
		    this.$toast.error(this.paymentProperties.getError(),{timeout:false, id: 'payment', position: 'bottom-left'})
		}
	    },

            updateCardDetails() {
                this.updateCard(this.paymentProperties.desiredMb()*1000*1000)
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
.app-modal__container h2.card__meta{
	font-size: var(--text);
}
.app-modal__container .options_container{
	display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: space-around;
}
.app-modal__container .options{
	
}
.app-modal__container button:disabled{
	background-color: gray;
}
.app-modal__container button:disabled:hover{
	background-color: gray;
}
.app-modal__container .app-button.alert{
	background-color: var(--alert);
	color:var(--bg);
	margin-top:8px;
}
.app-modal__container .app-button.alert:hover{
	background-color: var(--alert-hover);
}
</style>
