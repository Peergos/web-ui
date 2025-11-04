<template>
	<AppModal position="center">
		<template #header>
			<h2>{{ translate("TOUR.TITLE") }}</h2>
		</template>
		<template #body>
			<Slider :slides="slides"/>
		</template>
		<template #footer>
		</template>
	</AppModal>
</template>

<script>
const AppModal = require("AppModal.vue");
const Slider = require("../slider/Slider.vue");
const i18n = require("../../i18n/index.js");

module.exports = {
components: {
    AppModal,
	Slider,
},
data() {
	return {
	    slides: [
			{
				title: this.translate("TOUR.SYNC"),
				description: this.translate("TOUR.SYNC.DESC"),
				image: "images/tour/sync.png"
			},
			{
				title: this.translate("TOUR.STORAGE"),
				description: this.translate("TOUR.STORAGE.DESC"),
				image: "images/tour/drive.png"
			},
			{
				title: this.translate("TOUR.SHARE"),
				description: this.translate("TOUR.SHARE.DESC"),
				image: "images/tour/share.jpg"
			},
			{
				title: this.translate("TOUR.PHOTOS"),
				description: this.translate("TOUR.PHOTOS.DESC"),
				image: "images/tour/images.jpg"
			},
			{
				title: this.translate("TOUR.DOCS"),
				description: this.translate("TOUR.DOCS.DESC"),
				image: "images/tour/markdown.png"
			},
			{
				title: this.translate("TOUR.MUSIC"),
				description: this.translate("TOUR.MUSIC.DESC"),
				image: "images/tour/music.jpg"
			},
			{
				title: this.translate("TOUR.VIDEOS"),
				description: this.translate("TOUR.VIDEOS.DESC"),
				image: "images/tour/video.jpg"
			},
			{
				title: this.translate("TOUR.PDF"),
				description: this.translate("TOUR.PDF.DESC"),
				image: "images/tour/pdf.jpg"
			},
			{
				title: this.translate("TOUR.CAL"),
				description: this.translate("TOUR.CAL.DESC"),
				image: "images/tour/calendar.png"
			},
			{
				title: this.translate("TOUR.SOCIAL"),
				description: this.translate("TOUR.SOCIAL.DESC"),
				image: "images/tour/social-feed.jpg"
			},
		]
	}
},
    mixins:[i18n],  
}
</script>

<style>

</style>
