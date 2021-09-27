module.exports = {
    template: require('tour.html'),
    data: function() {
        return {
	    currentElementIndex: 0,
	    cards: [
		{
		    headline: "Welcome to Peergos!",
		    text: "Learn some of the cool things you can do with Peergos!"
		},
		{
		    headline: "Safe storage",
		    text: "Store your files and arrange them in folders.",
		    image: "images/tour/upload.png"
		},
		{
		    headline: "Find your friends",
		    text: "Add friends with a secure follow request.",
		    image: "images/tour/social.png"
		},
		{
		    headline: "Secure sharing",
		    text: "Securely share files or folders with friends.",
		    image: "images/tour/share.png"
		},
		{
		    headline: "Secret links",
		    text: "Create a secret link to share with anyone.",
		    image: "images/tour/secret.png"
		},
		{
		    headline: "Photo gallery",
		    text: "View slideshows of your photos.",
		    image: "images/tour/images.png"
		},
		{
		    headline: "Document editing",
		    text: "View and edit your text documents.",
		    image: "images/tour/text.png"
		},
		{
		    headline: "Music collection",
		    text: "Play your music collection.",
		    image: "images/tour/music.png"
		},
		{
		    headline: "Videos and movies",
		    text: "Watch your videos and movies from any device.",
		    image: "images/tour/video.png"
		},
		{
		    headline: "PDF viewer",
		    text: "Safely view PDF documents.",
		    image: "images/tour/pdf.png"
		},
		{
		    headline: "Planning board",
		    text: "Organise and plan things with our planning boards.",
		    image: "images/tour/kanban.png"
		},
		{
		    headline: "Calendar",
		    text: "Manage your schedule - share events or entire calendars.",
		    image: "images/tour/calendar.png"
		},
		{
		    headline: "Social Feed",
		    text: "Share posts and comments with your friends and followers.",
		    image: "images/tour/social-feed.png"
		},
	    ],
	};
    },
    props: [],
    created: function() {
    },
    computed: {
	currentElement() {
	    return this.cards[this.currentElementIndex];
	},
	reachedMaxLeft() {
	    return this.currentElementIndex === 0;
	},
	reachedMaxRight() {
	    return this.currentElementIndex === this.cards.length - 1;
	},
	headline() {
	    return this.currentElement.headline;
	},
	text() {
	    return this.currentElement.text;
	},
	image() {
	    return this.currentElement.image;
	},
	isLast() {
	    return this.currentElementIndex == this.cards.length - 1;
	}
    },
    methods: {
        showNextElement() {
	    this.currentElementIndex++;
	},
	showPrevElement() {
	    this.currentElementIndex--;
	},
	showElement(elementIndex) {
	    this.currentElementIndex = elementIndex;
	}
    }
}
