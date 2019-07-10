module.exports = {
    template: require('fingerprint.html'),
    data: function() {
        return {
	    width: 512,
	    height: 512,
	    stream: null,
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
		var that = this;
		navigator.mediaDevices.getUserMedia({ video: true }).then(function(stream) {
		    that.stream = stream;
		    setTimeout(() => {
			var video = document.getElementById('video');
			video.srcObject = stream;
			video.play()
			that.takeSnapshot(60)
		    }, 100);
		}).catch(function(error) {
		    alert("Couldn't connect to webcam. Make sure it is connected and you click allow access when prompted.");
		    console.error(error);
		    that.stream = null;
		});
	    }
	},

	takeSnapshot: function(attemptsLeft) {
	    var canvas = document.createElement('canvas');
	    canvas.width = 512;
	    canvas.height = 512;
	    var video = document.getElementById('video');
	    var vctx = canvas.getContext('2d');
	    vctx.drawImage(video, 0, 0, this.width, this.height);
	    this.processSnapshot(attemptsLeft, vctx);
	},

	processSnapshot: function(attemptsLeft, vctx) {
	    var pixels = this.convertCanvasToPixels(vctx)
	    try {
		var scanned = peergos.shared.fingerprint.FingerPrint.decodeFromPixels(pixels, this.width, this.height);
		this.stream.getVideoTracks()[0].stop();
		this.stream = null;
		if (this.fingerprint.right.matches(scanned)) {
		    this.context.addFriendAnnotation(new peergos.shared.user.FriendAnnotation(this.friendname, true, this.fingerprint.left))
		    alert("Friend successfully verified!");
		} else
		    alert("non matching fingerprint!!");
		   
	    } catch (err) {
		console.log("Couldn't find qr code in image");
		if (attemptsLeft > 0)
		    setTimeout(() => this.takeSnapshot(attemptsLeft-1), 1000);
		else {
		    this.stream.getVideoTracks()[0].stop();
		    this.stream = null;
		}
	    }
	},

	convertCanvasToPixels: function(context) {
	    var b = context.getImageData(0, 0, this.width, this.height).data;
	    // Reverting bytes from RGBA to ARGB
	    var pixels = []
	    for (var i=0 ; i < b.length/4 ; i++) {
		pixels[i] = (b[4*i + 3] << 24) | (b[4*i] << 16) | (b[4*i + 1] << 8) | (b[4*i + 2]);
	    }
	    return pixels;
	}
    },
    computed: {
        QRCodeURL: function() {
            return this.fingerprint.right.getBase64Thumbnail();
        },

	safetyNumber: function() {
	    var res = this.fingerprint.right.getDisplayString();
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
