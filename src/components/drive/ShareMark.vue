<template>
	<span v-if="kind" class="share-mark">
		<span v-if="kind.indexOf('people') >= 0" :title="translate('DRIVE.SHARED.PEOPLE')">
			<AppIcon class="share-mark__people" icon="social"/>
		</span>
		<span v-if="kind.indexOf('link') >= 0" :title="translate('DRIVE.SHARED.LINK')">
			<AppIcon class="share-mark__link" icon="shared"/>
		</span>
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
		// "", "people", "link" or "people link" - a file can be shared both ways at once,
		// and then wears both marks
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

/* Each mark says what it means on hover, which needs an element that takes a title: the
   attribute is not how an svg carries one. A pointer is the only thing that asks for this,
   and a touch screen losing it costs nothing. */
.share-mark > span {
	display: flex;
}

/* The two glyphs are drawn to different scales in their own viewBoxes, so equal CSS sizes
   would not put equal ink on the row: the link fills its box edge to edge, while the people
   mark sits inset in its own. Measured, these two sizes paint 15.7px and 15.6px of ink and
   centre within 0.05px of each other and of the menu beside them. */
.share-mark__link {
	width: 16px;
	height: 16px;
}

.share-mark__people {
	width: 17.5px;
	height: 17.5px;
}
</style>
