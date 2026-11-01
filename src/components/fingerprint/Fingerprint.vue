<template>
<transition name="modal">
<div class="pg-dialog__mask" @click="close">
    <div class="pg-dialog pg-dialog--prompt fingerprint" role="dialog" aria-modal="true" :aria-label="translate('VERIFY.TITLE') + ': ' + friendname" @click.stop>
        <header class="pg-dialog__head">
            <h3 class="pg-dialog__title">{{ translate("VERIFY.TITLE") }}: {{ friendname }}</h3>
            <DialogClose @close="close"/>
        </header>
        <div class="pg-dialog__body fingerprint__body">
            <!-- a code on a white ground whatever the theme: a camera reads dark on light -->
            <div class="qrcode-container">
                <img v-if="! scanning" v-bind:src="QRCodeURL" alt="QR code" class="qrcode"/>
                <QrScanner v-if="scanning" :decoder="decode" @scanned="checkScanned" @failed="scanFailed"/>
            </div>
            <div class="fingerprint__actions">
                <button type="button" class="pg-btn" @click="scanQRCode()">{{ translate("VERIFY.SCAN") }}</button>
                <label class="pg-switch">
                    <input type="checkbox" v-model="isVerified" autocomplete="off">
                    <span class="pg-switch__track"></span>
                    {{ verified }}
                </label>
            </div>
            <div class="fingerprint__numbers">
                <h4>{{ translate("VERIFY.NUMBERS") }}</h4>
                <p v-for="line in safetyNumber">{{ line }}</p>
            </div>
        </div>
    </div>
</div>
</transition>
</template>

<script>
const i18n = require("../../i18n/index.js");
const DialogClose = require("../dialog/DialogClose.vue");
const QrScanner = require("../social/QrScanner.vue");
module.exports = {
    components: { DialogClose, QrScanner },
    data: function() {
        return {
	    scanning: false,
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
            this.scanning = false;
            this.$emit("hide-fingerprint", this.isVerified);
        },

	scanQRCode: function() {
	    this.scanning = true;
	},

	decode: function(pixels, width, height) {
	    return peergos.shared.fingerprint.FingerPrint.decodeFromPixels(pixels, width, height);
	},

	checkScanned: function(scanned) {
	    this.scanning = false;
	    if (this.fingerprint.right.matches(scanned)) {
		this.isVerified = true;
		alert(this.translate("VERIFY.SUCCESS"));
	    } else {
		alert(this.translate("VERIFY.ERROR.MISMATCH"));
		this.isVerified = false;
	    }
	},

	scanFailed: function(message) {
	    this.scanning = false;
	    if (message != null)
		alert(message);
	},

	persistVerification: function(verified) {
	    this.context.addFriendAnnotation(new peergos.shared.user.FriendAnnotation(this.friendname, verified, this.fingerprint.left));
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
/* Two people checking they see the same key, on the surface the other dialogs use: the code
   to scan, the scan and the verdict side by side, then the numbers to read out. */

.fingerprint__body {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 16px;
}

/* each part keeps its height and the body scrolls, rather than squeezing the code until
   the controls under it ride up over it */
.fingerprint__body > * {
	flex: none;
}

.fingerprint .qrcode-container {
	display: flex;
	justify-content: center;
	width: 100%;
	max-width: 280px;
	padding: 12px;
	background-color: #ffffff;
	border-radius: var(--radius-control);
}

.fingerprint .qrcode {
	display: block;
	width: 100%;
	height: auto;
}

.fingerprint__actions {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: center;
	gap: 12px;
}

.fingerprint__numbers {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 2px;
}

.fingerprint__numbers h4 {
	margin: 0 0 6px;
	font-size: var(--text-small);
	font-weight: var(--regular);
	color: var(--pg-muted);
	text-align: center;
}

.fingerprint__numbers p {
	margin: 0;
	font-family: ui-monospace, Menlo, Consolas, monospace;
	font-size: 17px;
	letter-spacing: .04em;
	font-variant-numeric: tabular-nums;
}
</style>
