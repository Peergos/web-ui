export default {
	// created() {
	// 	console.log('hello from mixing')
	// },

	methods: {
		roundToDisplay(x) {
			return Math.round(x * 100) / 100;
		},

		convertBytesToHumanReadable(bytesAsString) {
			let bytes = Number(bytesAsString);
			if (bytes < 1024)
				return bytes + " Bytes";
			if (bytes < 1024 * 1024)
				return this.roundToDisplay(bytes / 1024) + " KiB";
			if (bytes < 1024 * 1024 * 1024)
				return this.roundToDisplay(bytes / 1024 / 1024) + " MiB";
			return this.roundToDisplay(bytes / 1024 / 1024 / 1024) + " GiB";
		},
	 }

}