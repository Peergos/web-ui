module.exports = {
	// created() {
	// 	console.log('hello from mixing')
	// },

	methods: {
		roundToDisplay(x) {
			return Math.round(x * 100) / 100;
		},

		convertBytesToHumanReadable(bytesAsString) {
			let bytes = Number(bytesAsString);
			if (bytes < 1000)
				return bytes + " Bytes";
			if (bytes < 1000 * 1000)
				return this.roundToDisplay(bytes / 1000) + " KB";
			if (bytes < 1000 * 1000 * 1000)
				return this.roundToDisplay(bytes / 1000 / 1000) + " MB";
			return this.roundToDisplay(bytes / 1000 / 1000 / 1000) + " GB";
		},
	 }

}
