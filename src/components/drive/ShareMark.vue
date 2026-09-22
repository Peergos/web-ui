<template>
	<span v-if="kind" class="share-mark" :title="translate('DRIVE.SHARED')">
		<AppIcon icon="shared"/>
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
		// "", "people", "link" or "people link" - only whether it is empty is read here
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
	color: var(--pg-on-ok);
}

/* This glyph is drawn edge to edge in its own viewBox, where the rest of the set sits inset
   in theirs, so 18px here would stand taller than the menu beside it. 16px draws it to the
   same height as the other icons on the row. */
.share-mark svg {
	width: 16px;
	height: 16px;
}
</style>
