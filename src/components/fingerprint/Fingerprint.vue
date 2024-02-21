<template>
<transition name="modal">
<div class="modal-mask" @click="close">
    <div class="modal-container full-height" @click.stop style="overflow-y:auto">
        <span @click="close" tabindex="0" v-on:keyup.enter="close" aria-label="close" class="close">&times;</span>
        <center>
            <h2>{{ translate("VERIFY.TITLE") }}: {{ friendname }}</h2>
        </center>
        <center style="font-size:1.6em">
	  <div class="qrcode-container">
            <img v-if="stream == null" v-bind:src="QRCodeURL" alt="QR code" class="qrcode"></img>
	    <video v-if="stream != null" id="video" class="qrcode"></video>
	  </div>
	  <div>
	    <button class="btn btn-success" @click="scanQRCode()">{{ translate("VERIFY.SCAN") }}</button>
	    <span style="display:block;width:6em;text-align:left;"><input type="checkbox" v-model="isVerified" autocomplete="off"> {{ verified }}</span>
	    <br/>
	    <h4>{{ translate("VERIFY.NUMBERS") }}</h4>
            {{ safetyNumber[0] }}
	    <br/>
	    {{ safetyNumber[1] }}
	    <br/>
	    {{ safetyNumber[2] }}
	  </div>
        </center>
    </div>
</div>
</transition>
</template>

<script>
const i18n = require("../../i18n/index.js");
module.exports = {
    data: function() {
        return {
	    width: 512,
	    height: 512,
	    stream: null,
	    isVerified: false
        };
    },
    mixins:[i18n],
    props: ['fingerprint', 'friendname', 'context', "initialIsVerified"],
    created: function() {
	this.isVerified = this.initialIsVerified;
    },

    watch: {
	isVerified: function(newVerified) {
	    this.persistVerification(newVerified);
	}
    },
    
    methods: {
        close: function() {
	    this.closeCamera();
            this.$emit("hide-fingerprint", this.isVerified);
        },

	closeCamera: function() {
	    if (this.stream != null) {
		var tracks = this.stream.getTracks();
		for (var i = 0; i < tracks.length; i++) {
		    var track = tracks[i];
		    track.stop();
		}
	    }
	    this.stream = null;
	    var video = document.getElementById('video');
	    if (video != null)
		video.srcObject = null;
	},

	scanQRCode: function() {
	    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
		var that = this;
		navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }}).then(function(stream) {
		    that.stream = stream;
		    setTimeout(() => {
			var video = document.getElementById('video');
			video.srcObject = stream;
			video.play()
			that.takeSnapshot(60)
		    }, 100);
		}).catch(function(error) {
		    alert(that.translate("VERIFY.ERROR.CAMERA"));
		    console.error(error);
		    that.closeCamera();
		});
	    }
	},

	persistVerification: function(verified) {
	    this.context.addFriendAnnotation(new peergos.shared.user.FriendAnnotation(this.friendname, verified, this.fingerprint.left));
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
		this.closeCamera();
		if (this.fingerprint.right.matches(scanned)) {
		    this.isVerified = true;
		    alert(this.translate("VERIFY.SUCCESS"));
		} else {
		    alert(this.translate("VERIFY.ERROR.MISMATCH"));
		    this.isVerified = false;
		}
	    } catch (err) {
		console.log("Couldn't find qr code in image");
		if (attemptsLeft > 0)
		    setTimeout(() => this.takeSnapshot(attemptsLeft-1), 1000);
		else {
		    this.closeCamera();
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

	verified: function() {
	    return this.isVerified ? this.translate("VERIFY.VERIFIED") : this.translate("VERIFY.UNVERIFIED");
	}
    }
};
</script>
<style>
</style>
