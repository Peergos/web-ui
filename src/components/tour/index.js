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
		    text: "You can store your files in Peergos and arrange them in folders."
		},
		{
		    headline: "Secure sharing",
		    text: "You can securely share files or folders with friends in Peergos."
		},
		{
		    headline: "Secret links",
		    text: "You can create a secret link to a file or folder to share with anyone."
		},
		{
		    headline: "Photo gallery",
		    text: "You can store your photos in Peergos and view slideshows of them."
		},
		{
		    headline: "Document editing",
		    text: "You can store your text documents and edit them directly in Peerogs. We support text, markdown, and most progamming languages."
		},
		{
		    headline: "Music collection",
		    text: "You can store your music collection in Peergos and play songs back directly."
		},
		{
		    headline: "Videos and movies",
		    text: "You can store your videos and movies and watch them directly from the browser on any device."
		},
		{
		    headline: "PDF viewer",
		    text: "You can store and view PDF documents."
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
