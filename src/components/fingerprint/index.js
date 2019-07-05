module.exports = {
    template: require('fingerprint.html'),
    data: function() {
        return {
	    width: 512,
	    height: 512
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
	    context.drawImage(video, 0, 0, this.width, this.height);
	    var pixels = this.convertCanvasToPixels(context)
	    console.log(pixels);
	    try {
		var scanned = peergos.shared.fingerprint.FingerPrint.decodeFromPixels(pixels, this.width, this.height);
		console.log("Success!");
	    } catch (err) {
		console.log(err);
	    }
	},

	convertCanvasToPixels: function(context) {
	    var b = context.getImageData(0, 0, this.width, this.height);
	    var pixels = []; // ARGB
	    for (var i=0; i < this.width*this.height; i++)
		pixels[i] = b[i*4+3] & 0xff | ((b[i*4] & 0xff) << 8) | ((b[i*4+1] & 0xff) << 16) | ((b[i*4+2] & 0xff) << 24);
	    return pixels;
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
