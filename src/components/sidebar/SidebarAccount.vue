<template>
	<div class="sidebar-account">
		<div class="storage">{{ usedStorage }} MB / {{ maxStorage }} MB</div>
		<AppButton v-if="!isPremium" class="upgrade" size="small">
			Upgrade
		</AppButton>
	</div>
</template>

<script>
module.exports = {
	props: {
		isPremium: {
			type: Boolean,
			default: false,
		},
		maxStorage: {
			type: Number,
			default: 200,
		},
		usedStorage: {
			type: Number,
			default: 0,
		},
	},
	// methods:{
	// 	showRequestStorage() {
	// 		this.context.getPaymentProperties(false).thenApply(function (paymentProps) {
	// 			if (paymentProps.isPaid()) {
	// 				that.paymentProperties = paymentProps;
	// 				that.showBuySpace = true;
	// 			} else
	// 				that.showRequestSpace = true;
	// 		});
	// 	},
	// }
};
</script>

<style>
.sidebar-account {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	padding: 0;
	margin-top: auto;
	margin-bottom: 16px;
	transition: all 0.3s;
}

.sidebar-account .upgrade {
	font-size: var(--text-mini) !important;
	text-transform: uppercase;
	background-color: var(--green-500);
	color: white;
}

.upgrade:hover {
	color: white !important;
}

.sidebar-account .storage {
	margin-bottom: 8px;
}

.sidebar.active .storage {
	opacity: 1;
}

.sidebar.active .sidebar-account {
	padding: 0 16px;
}

.sidebar .storage {
	white-space: nowrap;
	opacity: 0;
}

@media (max-width: 1024px) {
	.sidebar-account {
		transition: none;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;

		margin-top: 0;

		border-top: 1px solid var(--border-color);

		padding: 0 16px;
		padding-top: 16px !important;
	}

	.sidebar-account .storage {
		font-size: var(--text-small);
		font-weight: var(--bold);
		margin: 0;
	}
}
</style>