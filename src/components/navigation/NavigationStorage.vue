<template>
	<div class="navigation-storage">
		<p class="storage">{{ usage }} / {{ quota }}</p>
		<AppButton class="upgrade" size="small" v-if="!isPro" @click.native="showRequestStorage()">
			Upgrade
		</AppButton>
	</div>
</template>

<script>
module.exports = {
	props: {
		isPro: {
			type: Boolean,
			default: false,
		},
	},
	computed: {
		...Vuex.mapGetters([
			'quota',
			'usage'
		]),
	},
	methods: {
		showRequestStorage() {
			this.$store.commit('CURRENT_MODAL', 'ModalSpace');
		},
	},
};
</script>

<style>
.navigation-storage {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	padding: 0;
	margin-top: auto;
	/* margin-bottom: 16px; */
	transition: all 0.3s;
}

.navigation-storage .upgrade {
	font-size: var(--text-mini) !important;
	text-transform: uppercase;
	background-color: var(--green-500);
	color: white;
	width:100%;
	max-width: 72px;
	text-align: center;

}

.upgrade:hover {
	color: white !important;
}

.navigation-storage .storage {
	margin-bottom: 8px;
	transition: all 0.3s;
}

.app-navigation.expanded .storage {
	opacity: 1;
}

.app-navigation.expanded .navigation-storage {
	padding: 16px;
}

.app-navigation .storage {
	white-space: nowrap;
	opacity: 0;
}



@media (max-width: 1024px) {
	.navigation-storage {
		transition: none;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;

		margin-top: 0;

		border-top: 1px solid var(--border-color);

		padding: 0 16px;
		padding-top: 16px !important;
	}

	.navigation-storage .storage {
		font-size: var(--text-small);
		font-weight: var(--bold);
		margin: 0;
	}
}
</style>