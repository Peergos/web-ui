<template>
	<AppModal position="center">
		<template #header>
			<h2>Tour</h2>
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
				title: "Welcome to Peergos!",
				description: "Learn some of the cool things you can do with Peergos!"
			},
			{
				title: "Safe storage",
				description: "Store your files and arrange them in folders.",
				image: "images/tour/upload.png"
			},
			{
				title: "Find your friends",
				description: "Add friends with a secure follow request.",
				image: "images/tour/social.png"
			},
			{
				title: "Secure sharing",
				description: "Securely share files or folders with friends.",
				image: "images/tour/share.png"
			},
			{
				title: "Secret links",
				description: "Create a secret link to share with anyone.",
				image: "images/tour/secret.png"
			},
			{
				title: "Photo gallery",
				description: "View slideshows of your photos.",
				image: "images/tour/images.png"
			},
			{
				title: "Document editing",
				description: "View and edit your text documents.",
				image: "images/tour/text.png"
			},
			{
				title: "Music collection",
				description: "Play your music collection.",
				image: "images/tour/music.png"
			},
			{
				title: "Videos and movies",
				description: "Watch your videos and movies from any device.",
				image: "images/tour/video.png"
			},
			{
				title: "PDF viewer",
				description: "Safely view PDF documents.",
				image: "images/tour/pdf.png"
			},
			{
				title: "Planning board",
				description: "Organise and plan things with our planning boards.",
				image: "images/tour/kanban.png"
			},
			{
				title: "Calendar",
				description: "Manage your schedule - share events or entire calendars.",
				image: "images/tour/calendar.png"
			},
			{
				title: "Social Feed",
				description: "Share posts and comments with your friends and followers.",
				image: "images/tour/social-feed.png"
			},
		]
	}
},
}
</script>

<style>

</style>