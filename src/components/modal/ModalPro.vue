<template>
	<AppModal>
		<template #header>
			<h2>{{upgradeTitle}}</h2>
		</template>
		<template #body>

			<h2 class="card__meta"> Current space: {{ quota }}</h2>

                        <p v-if="!isPaid">By continuing you agree to our <a href="/terms.html" target="_blank" rel="noopener noreferrer">Terms of Service</a>.</p>
                        <div v-if="!showCard" class="options_container">
			    <div class="card__meta options">
				<h3>Pro Account</h3>
				<ul>
				    <li>100 GB of hyper secure storage</li>
				    <li>All our bundled private applications</li>
				    <li>&#x00A3;5 / month</li>
				</ul>
                                <AppButton @click.native="updateCard(100000000000)" :disabled="isPro" type="primary" block accent>{{proButtonText}}</AppButton>
			    </div>
                            <div class="card__meta options">
				<h3>Visionary Account</h3>
				<ul>
				    <li>500 GB of hyper secure storage</li>
				    <li>All our bundled private applications</li>
				    <li>&#x00A3;10 / month  {{ prorataTextVisionary }}</li>
				</ul>
                                <AppButton @click.native="updateCard(500000000000)" :disabled="isVisionary" type="primary" block accent>{{visionaryButtonText}}</AppButton>
			    </div>
                            <div class="card__meta options">
				<h3>Pioneer Account</h3>
				<ul>
				    <li>2000 GB of hyper secure storage</li>
				    <li>All our bundled private applications</li>
				    <li>&#x00A3;25 / month  {{ prorataTextPioneer }}</li>
				</ul>
                                <AppButton @click.native="updateCard(2000000000000)" :disabled="isPioneer" type="primary" block accent>{{pioneerButtonText}}</AppButton>
			    </div>
                            <div class="card__meta options">
				<h3>Trailblazer Account</h3>
				<ul>
				    <li>4000 GB of hyper secure storage</li>
				    <li>All our bundled private applications</li>
				    <li>&#x00A3;40 / month  {{ prorataTextTrailblazer }}</li>
				</ul>
                                <AppButton @click.native="updateCard(4000000000000)" :disabled="isTrailblazer" type="primary" block accent>{{trailblazerButtonText}}</AppButton>
			    </div>
                        </div>

			<div v-if="showCard">
			    <iframe id="paymentframe" style="border: none;" width="450px" height="420px" :src="paymentUrl" referrerpolicy="origin"/>
			</div>

		</template>
		<template #footer>
			<AppButton v-if="isPaid" @click.native="updateCardDetails()" type="primary" block accent>Update payment details (opens in new tab)</AppButton>
			<AppButton v-if="isPaid" @click.native="cancelPaid()" type="primary" block class="alert" >Cancel Peergos subscription</AppButton>
		</template>
	</AppModal>
</template>

<script>
const AppButton = require("../AppButton.vue");
const AppModal = require("AppModal.vue");

module.exports = {
	components: {
	    AppButton,
	    AppModal,
	},
	data() {
		return {
			unit:"GiB",
			space:"",
			proMb: 100*1000,
                        visionaryMb: 500*1000,
                        pioneerMb: 2000*1000,
                        trailblazerMb: 4000*1000,
                        gettingCard: false,
                        paymentUrl:null,
			showCard:false,
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
            return this.quotaBytes/(1024*1024) > this.paymentProperties.freeMb() && this.paymentProperties.desiredMb() > 0;
		},
		isPro() {
                    return this.quotaBytes/(1024*1024) > this.paymentProperties.freeMb() && this.paymentProperties.desiredMb() == this.proMb;
                },

            isVisionary() {
                return this.quotaBytes/(1024*1024) > this.paymentProperties.freeMb() && this.paymentProperties.desiredMb() == this.visionaryMb;
            },

            isPioneer() {
                return this.quotaBytes/(1024*1024) > this.paymentProperties.freeMb() && this.paymentProperties.desiredMb() == this.pioneerMb;
            },

            isTrailBlazer() {
                return this.quotaBytes/(1024*1024) > this.paymentProperties.freeMb() && this.paymentProperties.desiredMb() == this.trailblazerMb;
            },

            prorataTextVisionary() {
                if (this.isPro())
                    return " (pro rata for this month)";
                else
                    return ""
            },
            prorataTextPioneer() {
                if (this.isPro() || this.isVisionary())
                    return " (pro rata for this month)";
                else
                    return ""
            },
            prorataTextTrailBlazer() {
                if (this.isPro() || this.isVisionary() || this.isPioneer())
                    return " (pro rata for this month)";
                else
                    return ""
            },
            upgradeTitle(){
			return (this.isPaid)
				? 'Subscription settings'
				: 'Upgrade your account to get more space'
	    },
            proButtonText(){
                return (this.isPro)
				? 'Your Current Plan'
				: 'Select Pro (opens new tab)'
            },
            visionaryButtonText(){
                return (this.isVisionary)
				? 'Your Current Plan'
				: 'Select Visionary (opens new tab)'
            },
            pioneerButtonText(){
                return (this.isPioneer)
				? 'Your Current Plan'
				: 'Select Pioneer (opens new tab)'
            },
            trailblazerButtonText(){
                return (this.isTrailBlazer)
				? 'Your Current Plan'
				: 'Select Trailblazer (opens new tab)'
            }
    },

    mounted() {
        this.updateError()
    },
    
	methods: {
		...Vuex.mapActions([
			'updateQuota',
			'updatePayment'
		]),
            startAddCardListener: function(desired) {
                var that = this;
                this.currentFocusFunction = function(event) {
                    that.requestStorage(desired);
                };
	        window.addEventListener("focus", this.currentFocusFunction, false);
	    },
	    requestStorage(bytes) {
		console.log('requestStorage:', bytes)
		var that = this;
                window.removeEventListener("focus", this.currentFocusFunction);
		this.context.requestSpace(bytes)
		    .thenApply(x => that.updateQuota(quotaBytes => {
			console.log(quotaBytes,'quotaBytes')
                        
			if (quotaBytes >= bytes && bytes > 0) {
			    that.updatePayment()
			    that.$store.commit("SET_MODAL", false)
			    that.$toast.info('Thank you for signing up to a paid Peergos account!',{timeout:false, id: 'pro'})                            
			} else if (bytes == 0) {
			    that.updatePayment()
			    that.$store.commit("SET_MODAL", false)
			    that.$toast.error("Sorry to see you go. We'd love to know what we can do better. Make sure to delete enough data to return within your Basic quota. You will revert to the Basic quota at the end of the billing month.", {timeout:false, id: 'pro'})
			} else if (quotaBytes < bytes && bytes > 0 ) {
                            that.updatePayment(() => {
                                that.updateError()
                                if (! that.paymentProperties.hasError())
			            that.$toast.error(`Card details required. Add a payment card to complete your upgrade. `,{timeout:false, id: 'pro', position: 'bottom-left'})
                            });
			} else
                            that.updatePayment(() => that.updateError());
		    })).exceptionally(t => {
                        that.$toast.error("Error requesting more storage: " + t.getMessage())
                    })
	    },
            
	    updateError() {
		if (this.paymentProperties.hasError()) {
		    this.$toast.error(this.paymentProperties.getError(),{timeout:false, id: 'payment', position: 'bottom-left'})
		}
	    },

            updateCardDetails() {
                this.updateCard(this.paymentProperties.desiredMb()*1024*1024)
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
                this.requestStorage(0);
		this.$store.commit("SET_MODAL", false);
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
