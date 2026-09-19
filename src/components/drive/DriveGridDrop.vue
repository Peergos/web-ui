<template>
	<figure class="grid-card drop" @click="askForFiles()">
		<AppIcon class="card__icon" icon="upload--72" />
		<figcaption>{{ translate("DRIVE.DROP") }}</figcaption>
	</figure>
</template>

<script>
const AppIcon = require("../AppIcon.vue");
const i18n = require("../../i18n/index.js");

module.exports = {
    components: {
	    AppIcon,
    },
    mixins:[i18n],
    props: {
    },
    methods: {
        askForFiles() {
            document.getElementById('uploadFileInput').click();
        },
    },
};
</script>

<style>
/* An empty folder's drop target is the empty folder: it takes the space under
   either view, which is the area that accepts a drop (#dnd in Drive.vue). */
.grid-card.drop {
	position: relative;
	display: flex;
	flex: 1 1 auto;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 10px;
	min-height: 220px;
	margin: 12px 32px 24px;
	padding: 24px;
	cursor: default;
	background-color: transparent;
	border: 2px dashed var(--border-color);
	border-radius: var(--radius-container);
}

.grid-card.drop .card__icon {
	width: 56px;
	height: 56px;
	padding: 0;
	color: var(--color-2);
	background-color: transparent;
}

.grid-card.drop figcaption {
	height: auto;
	padding: 0;
	font-size: var(--text-small);
	line-height: 1.4;
	color: var(--pg-muted);
	text-align: center;
}

@media screen and (max-width: 1024px) {
	.grid-card.drop {
		min-height: 180px;
		margin: 10px 16px 16px;
	}
}
</style>
