<template>
	<AppModal position="center">
		<template #header>
			<h2>Welcome to Peergos!</h2>
		</template>
		<template #body>
			<Slider :slides="slides"/>
		</template>
		<template #footer>
		</template>
	</AppModal>
</template>

<script>
const Slider = require("../slider/Slider.vue");

module.exports = {
components: {
	Slider,
},
data() {
	return {
	    slides: [
			{
				title: "Encrypted storage",
				description: "Store your files and arrange them in folders.",
				image: "images/tour/drive.png"
			},
			{
				title: "Secure sharing",
				description: "Securely share with friends on Peergos, or with anyone via a secret link.",
				image: "images/tour/share.jpg"
			},
			{
				title: "Photo gallery",
				description: "View slideshows of your photos.",
				image: "images/tour/images.jpg"
			},
			{
				title: "Document editing",
				description: "View and edit your text documents.",
				image: "images/tour/markdown.png"
			},
			{
				title: "Music collection",
				description: "Play your music collection.",
				image: "images/tour/music.jpg"
			},
			{
				title: "Videos and movies",
				description: "Watch your videos and movies from any device.",
				image: "images/tour/video.jpg"
			},
			{
				title: "PDF viewer",
				description: "Safely view PDF documents.",
				image: "images/tour/pdf.jpg"
			},
			{
				title: "Tasks board",
				description: "Organise and plan things with our task boards.",
				image: "images/tour/tasks.jpg"
			},
			{
				title: "Calendar",
				description: "Manage your schedule - share events or entire calendars.",
				image: "images/tour/calendar.png"
			},
			{
				title: "Social Feed",
				description: "Share posts and comments with your friends and followers.",
				image: "images/tour/social-feed.jpg"
			},
		]
	}
},
}
</script>

<style>

</style>
