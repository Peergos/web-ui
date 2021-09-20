<template>
	<AppModal>
		<template #header>
			<h2>{{upgradeTitle}}</h2>
		</template>
		<template #body>

			<p class="card__meta"> Current space: {{ quota }}</p>

			<div v-if="!isPro" class="card__meta">
				<h3>Pro Account</h3>
				<ul>
					<li>50 GB of hyper secure storage</li>
					<li>All our bundled private applications</li>
					<li>5 GBP / month</li>
				</ul>


			</div>
			<div v-else>
				<p>You will revert to the Basic quota<br/>at the end of the billing month.</p>
			</div>

			<div v-if="showCard">
				stripe iframe
				<iframe style="border: none;" width="450px" height="420px" :src="paymentUrl"/>
			</div>

		</template>
		<template #footer>
			<p v-if="!isPro">By continuing you agree to our <a href="/terms.html" target="_blank" rel="noopener noreferrer">Terms of Service</a>.</p>
			<!-- <AppButton v-if="!isPro" @click.native="(53687091200)" type="primary" block accent>Upgrade account</AppButton> -->
			<AppButton v-if="!isPro" @click.native="updateCard()" type="primary" block accent>Upgrade account</AppButton>

			<AppButton v-else @click.native="cancelPro()" type="primary" block accent >Cancel Pro subscription</AppButton>
		</template>
	</AppModal>
</template>

<script>

module.exports = {
	data() {
		return {
			unit:"GiB",
			space:"",
			paymentUrl:null,
			showCard:false,
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

		isPro() {
            //return this.quotaBytes/(1024*1024) > this.paymentProperties.freeMb() && this.paymentProperties.desiredMb() > 0;
			return false;
		},
		upgradeTitle(){
			return (this.isPro)
				? 'Cancel Peergos subscription'
				: 'Upgrade your account to get more space'
		}
    },

	methods: {
		...Vuex.mapActions([
			'updateQuota',
		]),


		requestStorage(bytes) {
			console.log('requestStorage:', bytes)
			var that = this;

			this.context.requestSpace(bytes)
				.thenCompose(x => that.updateQuota())
				.thenApply(quotaBytes => {

					console.log(quotaBytes,'quotaBytes')
					that.updateError();

					if (quotaBytes >= bytes && bytes > 0) {
						that.$toast.info('Thank you for signing up to a Peergos Pro account!')
					} else if (bytes == 0) {
						that.$toast.error(`Sorry to see you go. We'd love to know what we can do better. Make sure to delete enough data to return within your Basic quota. `)
					} else if (quotaBytes < bytes && bytes > 0 ) {
						that.$toast.error(`Card details required. Add a payment card to complete your upgrade. `)
					}
				});
		},

		updateError() {
			if (this.paymentProperties.hasError()) {
				that.$toast.error(this.paymentProperties.getError())
			}
		},

    	updateCard() {
			console.log('updateCard:')
			var that = this;
			this.context.getPaymentProperties(true).thenApply(function(props) {
				that.paymentUrl = props.getUrl() + "&username=" + that.context.username + "&client_secret=" + props.getClientSecret();
				that.showCard = true;
			});
		},

		cancelPro() {
            this.requestStorage(0);
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