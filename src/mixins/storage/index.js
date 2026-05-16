module.exports = {

	roundToDisplay:function(x) {
			return Math.round(x * 100) / 100;
	},

	convertBytesToHumanReadable:function(bytesAsString) {
		let bytes = Number(bytesAsString);
		if (bytes < 1000)
			return bytes + " Bytes";
		if (bytes < 1000 * 100)
			return this.roundToDisplay(bytes / 1000) + " KB";
		if (bytes < 1000 * 1000 * 1000)
			return this.roundToDisplay(bytes / 1000 / 1000) + " MB";
		return this.roundToDisplay(bytes / 1000 / 1000 / 1000) + " GB";
	},

	formatTransferStats: function(done, max, startTime) {
		if (!startTime || done === 0) return '';
		const elapsed = (Date.now() - startTime) / 1000;
		if (elapsed < 1) return '';
		const speed = done / elapsed;
		const speedStr = this.convertBytesToHumanReadable('' + Math.round(speed)) + '/s';
		const remaining = max - done;
		if (remaining <= 0) return speedStr;
		const etaSec = Math.round(remaining / speed);
		if (etaSec < 60) return speedStr + ' — ' + etaSec + 's remaining';
		const mins = Math.floor(etaSec / 60);
		const secs = etaSec % 60;
		return speedStr + ' — ' + mins + 'm ' + (secs < 10 ? '0' : '') + secs + 's remaining';
	},
}
