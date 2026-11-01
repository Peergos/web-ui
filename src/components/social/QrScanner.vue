<template>
	<video ref="video" class="qrcode qr-scanner" playsinline></video>
</template>

<script>
const i18n = require("../../i18n/index.js");

// The camera loop the fingerprint check and friend links share: it starts on mount, tries a frame a second
// until the decoder finds a code or the attempts run out, and always stops the camera when it goes.
module.exports = {
    mixins: [i18n],
    props: {
        // function(pixels, width, height) returning what the code says, or throwing if there is none
        decoder: {
            type: Function,
            required: true
        },
        attempts: {
            type: Number,
            default: 60
        }
    },
    emits: ["scanned", "failed"],
    data: function() {
        return {
            size: 512,
            stream: null,
            timer: null
        };
    },
    mounted: function() {
        let that = this;
        if (! (navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
            this.$emit("failed", this.translate("VERIFY.ERROR.CAMERA"));
            return;
        }
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }}).then(function(stream) {
            if (that.$refs.video == null) {
                stream.getTracks().forEach(t => t.stop());
                return;
            }
            that.stream = stream;
            that.$refs.video.srcObject = stream;
            that.$refs.video.play();
            that.timer = setTimeout(() => that.takeSnapshot(that.attempts), 100);
        }).catch(function(error) {
            console.error(error);
            that.$emit("failed", that.translate("VERIFY.ERROR.CAMERA"));
        });
    },
    beforeUnmount: function() {
        this.stop();
    },
    methods: {
        stop: function() {
            if (this.timer != null)
                clearTimeout(this.timer);
            this.timer = null;
            if (this.stream != null)
                this.stream.getTracks().forEach(t => t.stop());
            this.stream = null;
            if (this.$refs.video != null)
                this.$refs.video.srcObject = null;
        },
        takeSnapshot: function(attemptsLeft) {
            if (this.$refs.video == null)
                return;
            let canvas = document.createElement('canvas');
            canvas.width = this.size;
            canvas.height = this.size;
            let vctx = canvas.getContext('2d');
            vctx.drawImage(this.$refs.video, 0, 0, this.size, this.size);
            let scanned;
            try {
                scanned = this.decoder(this.toPixels(vctx), this.size, this.size);
            } catch (err) {
                if (attemptsLeft > 0)
                    this.timer = setTimeout(() => this.takeSnapshot(attemptsLeft - 1), 1000);
                else {
                    this.stop();
                    this.$emit("failed", null);
                }
                return;
            }
            this.stop();
            this.$emit("scanned", scanned);
        },
        toPixels: function(context) {
            let b = context.getImageData(0, 0, this.size, this.size).data;
            // RGBA to ARGB
            let pixels = [];
            for (let i = 0; i < b.length / 4; i++)
                pixels[i] = (b[4*i + 3] << 24) | (b[4*i] << 16) | (b[4*i + 1] << 8) | (b[4*i + 2]);
            return pixels;
        }
    }
};
</script>
