<template>
	<div class="sidebar-storage">
		<div class="storage">{{ usage }} / {{ quota }}</div>
		<AppButton class="upgrade" size="small" v-if="!isPremium" @click="showRequestStorage()">
			Upgrade
		</AppButton>
	</div>
</template>

<script>
const mixins = require("../../mixins/mixins.js");
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

	mixins:[mixins],

	computed: {
		...Vuex.mapState([
			'usageBytes',
			'quotaBytes',
		]),
		usage(){
			if (this.usageBytes == 0)
				return "N/A";
			return this.convertBytesToHumanReadable(this.usageBytes.toString());
		},
		quota() {
			if (this.quotaBytes == 0)
				return "N/A";
			return this.convertBytesToHumanReadable(this.quotaBytes.toString());
		},
	},
	methods: {
		showRequestStorage() {
			this.$store.commit('CURRENT_MODAL', 'ModalSpace');
		},
	},
};
</script>

<style>
.sidebar-storage {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	padding: 0;
	margin-top: auto;
	margin-bottom: 16px;
	transition: all 0.3s;
}

.sidebar-storage .upgrade {
	font-size: var(--text-mini) !important;
	text-transform: uppercase;
	background-color: var(--green-500);
	color: white;
}

.upgrade:hover {
	color: white !important;
}

.sidebar-storage .storage {
	margin-bottom: 8px;
}

.sidebar.active .storage {
	opacity: 1;
}

.sidebar.active .sidebar-storage {
	padding: 0 16px;
}

.sidebar .storage {
	white-space: nowrap;
	opacity: 0;
}

@media (max-width: 1024px) {
	.sidebar-storage {
		transition: none;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;

		margin-top: 0;

		border-top: 1px solid var(--border-color);

		padding: 0 16px;
		padding-top: 16px !important;
	}

	.sidebar-storage .storage {
		font-size: var(--text-small);
		font-weight: var(--bold);
		margin: 0;
	}
}
</style>