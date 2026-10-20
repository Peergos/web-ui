const loopback = require("../loopback/index.js");

module.exports = {
    methods: {
        copyRecoveryKey: function(key) {
            let that = this;
            navigator.clipboard.writeText(key).then(function() {
                that.$toast(that.translate("RECOVERY.COPIED"));
            }, function() {
                console.error("Unable to write to clipboard.");
            });
        },
        downloadRecoveryKey: function(username, key) {
            let filename = 'peergos-recovery-key-' + username + '.txt';
            let text = this.translate("RECOVERY.FILE.HEADER") + " " + username + "\n\n"
                + key + "\n\n"
                + this.translate("RECOVERY.BLURB") + "\n";
            // the desktop and android apps' local address is no use from another device
            if (! loopback.isLoopbackHost(window.location.hostname))
                text += "\n" + this.translate("RECOVERY.FILE.USE") + " " + window.location.origin + "/recovery\n";
            // a blob: url never reaches the android app's DownloadListener, so hand it the text
            if (typeof window.Android !== "undefined" && window.Android
                    && typeof window.Android.saveToDownloads === "function") {
                window.Android.saveToDownloads(filename, 'text/plain', text);
                return;
            }
            let blob = new Blob([text], { type: 'octet/stream' });
            let link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.type = 'text/plain';
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        },
    }
};
