<template>
	<transition name="modal" appear>
		<div class="pg-dialog__mask" @click="close()">
			<div class="pg-dialog pg-dialog--prompt" role="dialog" aria-modal="true" :aria-label="translate('MFA.BACKUP.TITLE')" @click.stop>
				<header class="pg-dialog__head">
					<h3 class="pg-dialog__title">{{ translate("MFA.BACKUP.TITLE") }}</h3>
					<DialogClose @close="close()"/>
				</header>
				<Spinner v-if="showSpinner"></Spinner>
				<div class="pg-dialog__body">
					<p>{{ translate("MFA.BACKUP.BLURB") }}</p>
					<div class="backup-codes" v-if="codes.length > 0">
						<div class="backup-code" v-for="code in codes">{{ code }}</div>
					</div>
				</div>
				<footer class="pg-dialog__foot">
					<div class="pg-dialog__actions">
						<button type="button" class="pg-btn" @click="copy()" :disabled="codes.length == 0">{{ translate("MFA.BACKUP.COPY") }}</button>
						<button type="button" class="pg-btn" @click="download()" :disabled="codes.length == 0">{{ translate("MFA.BACKUP.DOWNLOAD") }}</button>
						<span class="pg-dialog__spacer"></span>
						<button type="button" id='prompt-button-id' class="pg-btn pg-btn--primary" @click="close()">{{ translate("MFA.BACKUP.DONE") }}</button>
					</div>
				</footer>
			</div>
		</div>
	</transition>
</template>
<script>
const DialogClose = require("../dialog/DialogClose.vue");
const Spinner = require("../spinner/Spinner.vue");
const i18n = require("../../i18n/index.js");

module.exports = {
    components: {
        DialogClose,
        Spinner,
    },
    data: function() {
        return {
            credentialId: '',
            codes: [],
            showSpinner: false,
        }
    },
    props: ['consumer_func'],
    computed: {
        ...Vuex.mapState([
            'context'
        ]),
    },
    mixins:[i18n],
    created: function() {
        let that = this;
        this.showSpinner = true;
        this.context.network.account.generateBackupCodes(this.context.username, this.context.signer).thenApply(backupCodes => {
            that.credentialId = backupCodes.credentialId;
            that.codes = backupCodes.formatted().toArray([]);
            that.showSpinner = false;
        }).exceptionally(function (throwable) {
            that.$toast.error(that.translate("MFA.BACKUP.ERROR"), {timeout:false});
            console.log('Unable to generate backup codes: ' + throwable);
            that.showSpinner = false;
            that.close();
        });
    },
    methods: {
        asText: function() {
            return this.codes.join("\n") + "\n";
        },
        copy: function() {
            let that = this;
            navigator.clipboard.writeText(this.asText()).then(function() {
                that.$toast(that.translate("MFA.BACKUP.COPIED"));
            }, function() {
                console.error("Unable to write to clipboard.");
            });
        },
        download: function() {
            // a blob: url never reaches the android app's DownloadListener, so hand it the text
            if (typeof window.Android !== "undefined" && window.Android
                    && typeof window.Android.saveToDownloads === "function") {
                window.Android.saveToDownloads('peergos-backup-codes.txt', 'text/plain', this.asText());
                return;
            }
            let blob = new Blob([this.asText()], { type: 'octet/stream' });
            let link = document.getElementById('downloadAnchor');
            link.href = window.URL.createObjectURL(blob);
            link.type = 'text/plain';
            link.download = 'peergos-backup-codes.txt';
            link.click();
        },
        close: function() {
            this.$emit("hide-backup-codes");
            this.consumer_func(this.credentialId, this.codes.length);
        },
    }
}
</script>
<style>
/* two columns of codes to copy down, on the field surface so they read as data */
.backup-codes {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 6px 16px;
	margin: 12px 0 4px;
	padding: 12px 16px;
	background-color: var(--pg-surface-2);
	border-radius: var(--radius-field);
}

.backup-code {
	font-family: monospace;
	font-size: 15px;
	text-align: center;
}
</style>
