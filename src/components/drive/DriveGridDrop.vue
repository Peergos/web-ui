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
.grid-card.drop {
	position: relative;
	width: 100%;
	cursor:default;
	background-color: transparent;
	border: 2px dashed var(--border-color);
}
.grid-card.drop:before {
 	content: "";
	position: relative;
    padding-top: 75%;
}

@media screen and (max-width:1024px) {
	.grid-card.drop{
		 grid-column: 1/-1;
	}
}

</style>
