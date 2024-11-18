<template>
	<div class="navigation-storage">
		<p class="storage">{{ usage }} / {{ quota }}</p>
        <div style="width:100%">
            <div><meter v-if="percentage > 0" min="0" low="0" high="90" max="100" style="width: 100%" v-bind:value="percentage"></meter></div>
        </div>

		<AppButton class="upgrade" size="small" v-if="!isPro" @click.native="showRequestStorage()">
			{{ translate("APPNAV.UPGRADE") }}
		</AppButton>
	</div>
</template>

<script>
const AppButton = require("../AppButton.vue");
const i18n = require("../../i18n/index.js");
module.exports = {
	components: {
	    AppButton,
	},
        mixins:[i18n],
	props: {
		isPro: {
			type: Boolean,
			default: false,
		},
	},
	computed: {
        ...Vuex.mapState([
            'quotaBytes',
            'usageBytes',
        ]),
		...Vuex.mapGetters([
			'quota',
			'usage',
			'isPaid',
            'isSecretLink',
		]),
        percentage() {
            if (!this.isSecretLink && this.quotaBytes.toString() != '0' && this.usageBytes.toString() != '0') {
                let accountQuota = Number(this.quotaBytes.toString());
                let accountUsage = Number(this.usageBytes.toString());
                var value = Math.floor(accountUsage/accountQuota * 100.0);
                return value;
            } else {
                return 0;
            }
        },
	},
	methods: {
		showRequestStorage() {
			if(this.isPaid){
				this.$store.commit('CURRENT_MODAL', 'ModalPro');
			}else{
				this.$store.commit('CURRENT_MODAL', 'ModalSpace');
			}
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
