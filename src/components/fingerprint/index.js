module.exports = {
    template: require('fingerprint.html'),
    data: function() {
        return {
	    width: 512,
	    height: 512,
	    stream: null
        };
    },
    props: ['fingerprint', 'friendname', 'context'],
    created: function() {
        console.debug('Fingerprint module created!');
    },

    methods: {
        close: function() {
	    if (this.stream != null)
		this.stream.getVideoTracks()[0].stop();
            this.$emit("hide-fingerprint");
        },

	scanQRCode: function() {
	    console.log("Scan QR code");
	    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
		var video = document.getElementById('video');
		var that = this;
		navigator.mediaDevices.getUserMedia({ video: true }).then(function(stream) {
		    that.stream = stream;
		    video.srcObject = stream;
		    video.play();
		    that.takeSnapshot(60)
		}).catch(function(error) {
		    console.log("Is webcam connected?");
		    console.error(error);
		});
	    }
	},

	takeSnapshot: function(attemptsLeft) {
	    var canvas = document.getElementById('canvas');
	    var vctx = canvas.getContext('2d');
	    var video = document.getElementById('video');
	    vctx.drawImage(video, 0, 0, this.width, this.height);
	    this.processSnapshot(attemptsLeft);
	},

	processSnapshot: function(attemptsLeft) {
	    var vctx = canvas.getContext('2d');
	    var pixels = this.convertCanvasToPixels(vctx)
	    try {
		var scanned = peergos.shared.fingerprint.FingerPrint.decodeFromPixels(pixels, this.width, this.height);
		console.log("Success!");
		alert("success!!!!!")
		var that = this;
		this.context.generateFingerPrint(this.friendname)
		    .thenApply(gen => {
			that.stream.getVideoTracks()[0].stop();
			if (gen.matches(scanned)) {
			    alert("match!");
			} else
			    alert("non matching fingerprint!!");
		    })
	    } catch (err) {
		console.log("Couldn't find qr code in image", err);
		if (attemptsLeft > 0)
		    setTimeout(() => this.takeSnapshot(attemptsLeft-1), 1000);
		else
		    this.stream.getVideoTracks()[0].stop();
	    }
	},

	convertCanvasToPixels: function(context) {
	    var b = context.getImageData(0, 0, this.width, this.height).data;
	    console.log("converting")
	    console.log(b)
	    // Reverting bytes from RGBA to ARGB
	    var pixels = []
	    for (var i=0 ; i < b.length/4 ; i++) {
		pixels[i] = (b[4*i + 3] << 24) | (b[4*i] << 16) | (b[4*i + 1] << 8) | (b[4*i + 2]);
	    }
  	    console.log(pixels);
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
