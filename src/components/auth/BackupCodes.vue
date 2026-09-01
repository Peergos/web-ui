<template>
	<transition name="modal" appear>
		<div class="app-prompt app-modal__overlay" @click="close()">

			<div class="app-prompt__container" @click.stop>
				<header class="prompt__header">
					<AppButton class="close" icon="close" @click.native="close()"/>
					<h3>{{ translate("MFA.BACKUP.TITLE") }}</h3>
				</header>
                <Spinner v-if="showSpinner"></Spinner>
                <div class="prompt__body">
                    <center>{{ translate("MFA.BACKUP.BLURB") }}</center>
                    <div class="backup-codes" v-if="codes.length > 0">
                        <div class="backup-code" v-for="code in codes">{{ code }}</div>
                    </div>
                </div>
				<footer class="prompt__footer">
					<AppButton outline @click.native="copy()" :disabled="codes.length == 0">
						{{ translate("MFA.BACKUP.COPY") }}
					</AppButton>

					<AppButton outline @click.native="download()" :disabled="codes.length == 0">
						{{ translate("MFA.BACKUP.DOWNLOAD") }}
					</AppButton>

					<AppButton
						id='prompt-button-id'
						type="primary"
						accent
						@click.native="close()"
					>
					{{ translate("MFA.BACKUP.DONE") }}
					</AppButton>
				</footer>
			</div>
		</div>
	</transition>
</template>
<script>
const AppButton = require("../AppButton.vue");
const Spinner = require("../spinner/Spinner.vue");
const i18n = require("../../i18n/index.js");

module.exports = {
    components: {
        AppButton,
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
.backup-codes {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    margin: 20px 0;
}
.backup-code {
    font-family: monospace;
    font-size: 1.1em;
    padding: 5px 15px;
    width: 50%;
    text-align: center;
}
</style>
