<template>
	<div class="navigation-storage">
		<p class="storage">{{ usage }} / {{ quota }}</p>
		<div class="navigation-storage__bar">
			<meter min="0" low="0" high="90" max="100" v-bind:value="percentage"></meter>
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
/* the storage as a line about the account: figure and action on one row, the bar across
   the full width under them, one gap above, between and below */
.app-navigation .navigation-storage {
	flex-direction: row;
	flex-wrap: wrap;
	align-items: baseline;
	justify-content: center;
	gap: 10px;
	padding-top: 10px;
	padding-bottom: 10px;
	border-top: 1px solid var(--border-color);
}

/* the figure gives up width as the sidebar narrows rather than wrapping the row mid
   animation: what is left of it is clipped, and it is fading out anyway */
.app-navigation .navigation-storage .storage {
	flex: 1 1 0;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	margin: 0;
	font-size: 13px;
	font-weight: normal;
	line-height: 1.2;
	color: var(--pg-muted);
}

.app-navigation .navigation-storage .upgrade {
	flex: none;
	width: auto;
	max-width: none;
	/* the row lays out around the label, so the three gaps read as one measure; the
	   padding keeps a finger sized target and the margin keeps it out of the layout */
	height: auto;
	padding: 7px 0;
	margin: -7px 0;
	border: 0;
	line-height: 1.2;
	font-size: 13px !important;
	text-transform: none;
	background-color: transparent;
	color: var(--pg-on-ok);
}

/* the bar takes the row under the other two */
.app-navigation .navigation-storage__bar {
	order: 3;
	flex: 1 0 100%;
}

/* .pg-bar's own 4px, track and pill, filled with the tone the level has earned: the
   browser's green to amber, in the palette's colours rather than the engine's */
.app-navigation .navigation-storage meter {
	width: 100%;
	/* block, or its wrapper keeps a text line box under the row above */
	display: block;
	height: 4px;
	appearance: none;
	-webkit-appearance: none;
	border: 0;
	border-radius: var(--radius-pill);
	background: var(--pg-track);
}

.app-navigation .navigation-storage meter::-webkit-meter-bar {
	height: 4px;
	border: 0;
	border-radius: var(--radius-pill);
	background: var(--pg-track);
}

.app-navigation .navigation-storage meter::-webkit-meter-optimum-value {
	border-radius: var(--radius-pill);
	background: var(--pg-on-ok);
}

.app-navigation .navigation-storage meter::-webkit-meter-suboptimum-value {
	border-radius: var(--radius-pill);
	background: var(--pg-pause);
}

.app-navigation .navigation-storage meter::-webkit-meter-even-less-good-value {
	border-radius: var(--radius-pill);
	background: var(--pg-on-error);
}

/* the same three, for the engine that spells them the other way */
.app-navigation .navigation-storage meter::-moz-meter-bar {
	border-radius: var(--radius-pill);
	background: var(--pg-on-ok);
}

.app-navigation .navigation-storage meter:-moz-meter-sub-optimum::-moz-meter-bar {
	background: var(--pg-pause);
}

.app-navigation .navigation-storage meter:-moz-meter-sub-sub-optimum::-moz-meter-bar {
	background: var(--pg-on-error);
}

/* a 72px rail cannot take the sidebar's gutter and the link, so it keeps a narrow gutter
   and drops the column gap. Both are lengths, so collapsing tweens rather than jumps */
@media (min-width: 1025px) {
	.app-navigation:not(.expanded) .navigation-storage {
		column-gap: 0;
		padding-left: 4px;
		padding-right: 4px;
	}

	.app-navigation:not(.expanded) .navigation-storage .storage {
		flex-grow: 0;
	}
}

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
	padding: 10px 16px;
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

		padding: 10px 16px;
	}

	.navigation-storage .storage {
		font-size: var(--text-small);
		font-weight: var(--bold);
		margin: 0;
	}
}
</style>
