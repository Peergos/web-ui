<template>
	<AppModal>
		<template #header>
			<h2>Upgrade your account to get more space</h2>
		</template>
		<template #body>
			<p> Current space: {{ quota }}</p>

			<div v-if="!isPro" class="card__meta">
				<h3>Pro Account</h3>
				<ul>
					<li>50 GB of hyper secure storage</li>
					<li>All our bundled private applications</li>
					<li>5 GBP / month</li>
				</ul>

				<div v-if="showCard">
					<iframe style="border: none;" width="450px" height="420px" :src="paymentUrl"/>
				</div>
			</div>
			<div v-else>
				<p>You will revert to the Basic quota<br/>at the end of the billing month.</p>
			</div>

		</template>
		<template #footer>
			<p>By continuing you agree to our <a href="/terms.html" target="_blank" rel="noopener noreferrer">Terms of Service</a>.</p>

			<AppButton v-if="!isPro" @click.native="requestStorage(53687091200)" type="primary" block accent>Upgrade account</AppButton>
			<AppButton v-else @click.native="cancelPro()" type="primary" block accent >Cancel Pro subscription</AppButton>
		</template>
	</AppModal>
</template>

<script>

module.exports = {
	name: "ModalSpace",
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
		// quotaBytes:{
		// 	get () {
		// 		return this.$store.state.quotaBytes
		// 	},
		// 	set (value) {
		// 		this.$store.commit('updateQuota', value)
		// 	}
		// },
		isPro() {
            return this.quotaBytes/(1024*1024) > this.paymentProperties.freeMb() && this.paymentProperties.desiredMb() > 0;
			// return false;
		}
    },

	methods: {
		...Vuex.mapActions([
			'updateQuota',
		]),

		// space

        // getRequestedBytes() {
        //     if (this.unit == "GiB")
        //         return this.space*1024*1024*1024;
        //     return this.space*1024*1024;
        // },

        // validateSpace() {
        //     var bytes = parseInt(this.getRequestedBytes())
        //     if (bytes != this.getRequestedBytes()) {
        //         this.isError = true;
        //         this.error = "Space must be a positive integer!";
        //         this.errorClass = "has-error has-feedback alert alert-danger";
        //         return false;
        //     }
        //     if (bytes < this.usage) {
        //         this.isError = true;
        //         this.error = "You can't request space smaller than your current usage, please delete some files and try again.";
        //         this.errorClass = "has-error has-feedback alert alert-danger";
        //         return false;
        //     }
        //     this.isError = false;
        //     this.errorClass = "";
        //     return true;
        // },

        // requestStorage() {
        //     if (! this.validateSpace())
        //         return;
        //     const that = this;
        //     this.context.requestSpace(this.getRequestedBytes()).thenApply(x => that.close())
        // },


		// Payment
		// getRequestedBytes() {
		// 	if (this.unit == "GiB")
		// 		return this.space*1024*1024*1024;
		// 	return this.space*1024*1024;
		// },

		// cancelPro() {
		// 	this.requestStorage(0);
		// },

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
			var that = this;
			this.context.getPaymentProperties(true).thenApply(function(props) {
				that.paymentUrl = props.getUrl() + "&username=" + that.context.username + "&client_secret=" + props.getClientSecret();
				that.showCard = true;
			});
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