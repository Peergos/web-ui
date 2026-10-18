<template>
	<transition name="modal" appear>
		<div class="pg-dialog__mask">
			<div class="pg-dialog pg-dialog--prompt" role="dialog" aria-modal="true" :aria-label="translate('RECOVER.TITLE')">
				<header class="pg-dialog__head">
					<h3 class="pg-dialog__title">{{ translate("RECOVER.TITLE") }}</h3>
					<DialogClose v-if="! recovering" @close="close()"/>
				</header>
				<Spinner v-if="recovering"></Spinner>
				<div class="pg-dialog__body" v-if="step == 1">
					<p>{{ translate("RECOVER.BLURB") }}</p>
					<FormUsername v-model="username" :placeholder="translate('LOGIN.USERNAME')" autocomplete="username"/>
					<input class="recover-account__key" type="text" v-model="recoveryKey" autocomplete="off"
						:placeholder="translate('RECOVER.KEY')"/>
					<button type="button" class="pg-btn pg-btn--primary generate-password" @click="newPassword()">{{ translate("PASSWORD.GENERATE") }}</button>
					<FormPassword v-model="password" :placeholder="translate('PASSWORD.NEW')" :passwordIsVisible="showPasswords" firstOfTwo/>
					<FormPassword v-model="password2" :placeholder="translate('PASSWORD.REENTER')" :passwordIsVisible="showPasswords"/>
				</div>
				<div class="pg-dialog__body" v-if="step == 2">
					<p>{{ translate("RECOVER.NEW.KEY") }}</p>
					<div class="recovery-key">{{ nextRecoveryKey }}</div>
					<p v-if="! downloaded">{{ translate("RECOVERY.DOWNLOAD.FIRST") }}</p>
				</div>
				<footer class="pg-dialog__foot">
					<div class="pg-dialog__actions" v-if="step == 1">
						<span class="pg-dialog__spacer"></span>
						<button type="button" class="pg-btn pg-btn--primary" @click="next()">{{ translate("RECOVERY.CONTINUE") }}</button>
					</div>
					<div class="pg-dialog__actions" v-if="step == 2">
						<button type="button" class="pg-btn" @click="copy()">{{ translate("RECOVERY.COPY") }}</button>
						<button type="button" class="pg-btn" @click="download()">{{ translate("RECOVERY.DOWNLOAD") }}</button>
						<span class="pg-dialog__spacer"></span>
						<button type="button" class="pg-btn pg-btn--primary" :disabled="! downloaded || recovering" @click="recover()">{{ translate("RECOVER.BUTTON") }}</button>
					</div>
				</footer>
			</div>
		</div>
	</transition>
</template>
<script>
const DialogClose = require("../dialog/DialogClose.vue");
const FormPassword = require("../form/FormPassword.vue");
const FormUsername = require("../form/FormUsername.vue");
const Spinner = require("../spinner/Spinner.vue");
const UriDecoder = require('../../mixins/uridecoder/index.js');
const i18n = require("../../i18n/index.js");
const passwordMixin = require("../../mixins/password/index.js");

module.exports = {
    components: {
        DialogClose,
        FormPassword,
        FormUsername,
        Spinner,
    },
    props: ['initialUsername'],
    data: function() {
        return {
            step: 1,
            username: this.initialUsername || '',
            recoveryKey: '',
            password: '',
            password2: '',
            showPasswords: false,
            nextRecoveryKey: '',
            downloaded: false,
            recovering: false,
        }
    },
    computed: {
        ...Vuex.mapState([
            'crypto',
            'network',
        ]),
    },
    mixins:[i18n, passwordMixin, UriDecoder],
    methods: {
        newPassword: function() {
            this.password = this.generateWords();
            this.password2 = this.password;
            this.showPasswords = true;
        },
        next: function() {
            if (this.username.length == 0 || this.recoveryKey.trim().length == 0 || this.password.length == 0) {
                this.$toast.error(this.translate("RECOVER.FIELDS"), {timeout:false, id: 'recover'});
                return;
            }
            if (this.password != this.password2) {
                this.$toast.error(this.translate("PASSWORD.MATCH"), {timeout:false, id: 'recover'});
                return;
            }
            this.nextRecoveryKey = this.generateWords();
            this.step = 2;
        },
        asText: function() {
            return this.translate("RECOVERY.FILE.HEADER") + " " + this.username + "\n\n"
                + this.nextRecoveryKey + "\n\n"
                + this.translate("RECOVERY.BLURB") + "\n";
        },
        filename: function() {
            return 'peergos-recovery-key-' + this.username + '.txt';
        },
        copy: function() {
            let that = this;
            navigator.clipboard.writeText(this.nextRecoveryKey).then(function() {
                that.$toast(that.translate("RECOVERY.COPIED"));
            }, function() {
                console.error("Unable to write to clipboard.");
            });
        },
        download: function() {
            // a blob: url never reaches the android app's DownloadListener, so hand it the text
            if (typeof window.Android !== "undefined" && window.Android
                    && typeof window.Android.saveToDownloads === "function") {
                window.Android.saveToDownloads(this.filename(), 'text/plain', this.asText());
            } else {
                // the login page has no download anchor of its own
                let blob = new Blob([this.asText()], { type: 'octet/stream' });
                let link = document.createElement('a');
                link.href = window.URL.createObjectURL(blob);
                link.type = 'text/plain';
                link.download = this.filename();
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
            this.downloaded = true;
        },
        recover: function() {
            let that = this;
            this.recovering = true;
            const start = Date.now();
            peergos.shared.user.UserContext.recoverAccount(this.username, this.recoveryKey, this.password,
                this.nextRecoveryKey, this.network, this.crypto,
                { accept: (x) => (that.$toast.info(x, { id: 'recover', timeout:false })) }
            ).thenApply(function(context) {
                that.recovering = false;
                that.$toast.dismiss('recover');
                that.$toast(that.translate("RECOVER.DONE"));
                that.$emit("recovered", start, context);
            }).exceptionally(function(throwable) {
                that.recovering = false;
                that.$toast.error(that.translate("RECOVER.ERROR") + ": " + that.uriDecode(throwable.getMessage()), {timeout:false, id: 'recover'});
            });
        },
        close: function() {
            this.$emit("hide-recover");
        },
    }
}
</script>
<style>
.recover-account__key {
	width: 100%;
	font-family: monospace;
}
</style>
