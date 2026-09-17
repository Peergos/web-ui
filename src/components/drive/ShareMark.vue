<template>
	<span v-if="kind" class="share-mark" :title="translate('DRIVE.SHARED')">
		<AppIcon v-if="kind.indexOf('people') >= 0" icon="social"/>
		<AppIcon v-if="kind.indexOf('link') >= 0" icon="shared"/>
	</span>
</template>

<script>
const AppIcon = require("../AppIcon.vue");
const i18n = require("../../i18n/index.js");

module.exports = {
	components: {
		AppIcon
	},
	mixins: [i18n],
	props: {
		// "", "people", "link" or "people link"
		kind: {
			type: String,
			default: ""
		}
	}
}
</script>

<style>
.share-mark {
	display: flex;
	flex: none;
	align-items: center;
	gap: 4px;
	color: var(--pg-on-ok);
}

.share-mark svg {
	width: 18px;
	height: 18px;
}
</style>
