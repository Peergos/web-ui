<template>
	<figure class="grid-card drop" @click="askForFiles()">
		<AppIcon class="card__icon" icon="upload--72" />
		<figcaption>Drop files here</figcaption>
	</figure>
</template>

<script>
const AppIcon = require("../AppIcon.vue");

module.exports = {
    components: {
	    AppIcon,
    },
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