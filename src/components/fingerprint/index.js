module.exports = {
    template: require('fingerprint.html'),
    data: function() {
        return {
        };
    },
    props: ['fingerprint', 'friendname', 'context'],
    created: function() {
        console.debug('Fingerprint module created!');
    },

    methods: {
        close: function() {
            this.$emit("hide-fingerprint");
        },

	scanQRCode: function() {
	    console.log("Scan QR code");
	    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
		var video = document.getElementById('video');
		var that = this;
		navigator.mediaDevices.getUserMedia({ video: true }).then(function(stream) {
		    video.srcObject = stream;
		    video.play();
		    that.takeSnapshot()
		}).catch(function(error) {
		    console.log("Is webcam connected?");
		    console.error(error);
		});
	    }
	},

	takeSnapshot: function() {
	    var canvas = document.getElementById('canvas');
	    var context = canvas.getContext('2d');
	    var video = document.getElementById('video');
	    context.drawImage(video, 0, 0, 640, 480);
	    var image = this.convertCanvasToImage(canvas)
	    console.log(image);
	},

	convertCanvasToImage: function(canvas) {
	    return canvas.toDataURL("image/png");
	}
    },
    computed: {
        QRCodeURL: function() {
            return this.fingerprint.getBase64Thumbnail();
        },

	safetyNumber: function() {
	    var res = this.fingerprint.getDisplayString();
	    var split = [];
	    for (var i=0; i < res.length; i += 5)
		split.push(res.substring(i, i + 5))
	    var lines = [];
	    for (var j=0; j < 3; j++)
		lines.push(split.slice(j*4, j*4 + 4).join(" "));
            return lines;
        },
    }
};
