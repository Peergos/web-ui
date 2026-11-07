<template>
	<span v-if="mark" class="media-mark" role="img" :aria-label="translate(mark.label)">
		<AppIcon :icon="mark.icon"/>
	</span>
</template>

<script>
const AppIcon = require("../AppIcon.vue");
const i18n = require("../../i18n/index.js");

const MARKS = new Map([
	['video', {icon: 'play', label: 'SEARCH.VIDEO'}],
	// The speaker of the audio file icon, filled like the play glyph and with one wave rather than
	// two: in the list's small disc two waves blur into one smear on a screen of ordinary density.
	['audio', {icon: 'speaker', label: 'SEARCH.AUDIO'}],
]);

/** Laid over the thumbnail of a video, or of music with cover art, which is otherwise a still
 *  picture that reads as a photo. Any other type of file wears nothing. */
module.exports = {
	components: {
		AppIcon
	},
	mixins: [i18n],
	props: {
		// the file's type, as FileProperties.getType names it
		type: {
			type: String,
			default: ""
		}
	},
	computed: {
		mark() {
			return MARKS.get(this.type);
		}
	}
}
</script>

<style>
/* The glyph is light on the dialogs' scrim, so it reads on any picture. Over a white one the disc
   still comes out at 4.3:1 against the glyph in the light theme and 7:1 in the dark, past the
   3:1 a graphic needs (WCAG 2.2, 1.4.11). It takes no pointer events, so a tap on it is a tap on
   the thumbnail under it. The size comes from where it sits. */
.media-mark {
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 50%;
	color: var(--white);
	background-color: var(--pg-scrim);
	pointer-events: none;
}

.media-mark svg {
	width: 70%;
	height: 70%;
}
</style>
