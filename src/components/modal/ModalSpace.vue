<template>
	<AppModal>
		<template #header>
			<h2>Upgrade your account to get more space</h2>
		</template>
		<template #body>
			<p>By continuing you agree to our <a href="/terms.html" target="_blank" rel="noopener noreferrer">Terms of Service</a>.</p>

			<div v-if="!isPro">
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
			<AppButton v-if="!isPro" @click="requestStorage(53687091200)" type="primary">Upgrade account</AppButton>
			<AppButton v-else @click="cancelPro()">Cancel Pro subscription</AppButton>
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
			error: "",
			isError:false,
			errorClass: "",
			message: "",
			messageTitle: "",
			showMessage: false
        };
    },
	computed: {
		isPro() {
            // return this.quotaBytes/(1024*1024) > this.paymentProperties.freeMb() && this.paymentProperties.desiredMb() > 0;
			return false;
		}
    },

	props: ['context', 'quota', 'quotaBytes', 'usage', 'paymentProperties', 'updateQuota'],

	methods: {
		getQuota() {
			return this.quota;
		},

		getRequestedBytes() {
			if (this.unit == "GiB")
				return this.space*1024*1024*1024;
			return this.space*1024*1024;
		},

		cancelPro() {
			this.requestStorage(0);
		},

		requestStorage(bytes) {
			var that = this;
			this.context.requestSpace(bytes)
				.thenCompose(x => that.updateQuota())
				.thenApply(quotaBytes => {
							that.updateError();
					if (quotaBytes >= bytes && bytes > 0) {
					that.messageTitle = "Congratulations";
					that.message = "Thank you for signing up to a Peergos Pro account!";
					} else if (bytes == 0) {
					that.messageTitle = "Sorry";
					that.message = "Sorry to see you go. We'd love to know what we can do better. Make sure to delete enough data to return within your Basic quota. ";
					} else if (quotaBytes < bytes && bytes > 0 && ! that.isError) {
					that.messageTitle = "Card details required";
					that.message = "Add a payment card to complete your upgrade.";
					}
					that.showMessage = true;
				});
		},

		updateError() {
			if (this.paymentProperties.hasError()) {
			this.isError = true;
			this.error = this.paymentProperties.getError();
			} else
			this.isError = false;
		},

        updateCard() {
			var that = this;
			this.context.getPaymentProperties(true).thenApply(function(props) {
			that.paymentUrl = props.getUrl() + "&username=" + that.context.username + "&client_secret=" + props.getClientSecret();
			that.showCard = true;
			});
        },

        close() {
            this.$emit("hide-payment");
        }
    },

};
</script>
<style>


</style>