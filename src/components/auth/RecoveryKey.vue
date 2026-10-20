<template>
	<transition name="modal" appear>
		<div class="pg-dialog__mask">
			<div class="pg-dialog pg-dialog--prompt" role="dialog" aria-modal="true" :aria-label="translate('RECOVERY.TITLE')">
				<header class="pg-dialog__head">
					<h3 class="pg-dialog__title">{{ translate("RECOVERY.TITLE") }}</h3>
					<DialogClose v-if="! showSpinner" @close="$emit('hide-recovery-key')"/>
				</header>
				<Spinner v-if="showSpinner"></Spinner>
				<div class="pg-dialog__body">
					<p>{{ translate("RECOVERY.BLURB") }}</p>
					<div class="recovery-key">{{ password }}</div>
					<p v-if="! downloaded">{{ translate("RECOVERY.DOWNLOAD.FIRST") }}</p>
				</div>
				<footer class="pg-dialog__foot">
					<div class="pg-dialog__actions">
						<button type="button" class="pg-btn" @click="copyRecoveryKey(password)">{{ translate("RECOVERY.COPY") }}</button>
						<button type="button" class="pg-btn" @click="download()">{{ translate("RECOVERY.DOWNLOAD") }}</button>
						<span class="pg-dialog__spacer"></span>
						<button type="button" class="pg-btn pg-btn--primary" :disabled="! downloaded || showSpinner" @click="commit()">{{ translate("RECOVERY.CONTINUE") }}</button>
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
const passwordMixin = require("../../mixins/password/index.js");
const recoveryMixin = require("../../mixins/recovery/index.js");

module.exports = {
    components: {
        DialogClose,
        Spinner,
    },
    data: function() {
        return {
            password: '',
            downloaded: false,
            showSpinner: false,
        }
    },
    computed: {
        ...Vuex.mapState([
            'context'
        ]),
    },
    mixins:[i18n, passwordMixin, recoveryMixin],
    created: function() {
        this.generatePassword();
    },
    methods: {
        download: function() {
            this.downloadRecoveryKey(this.context.username, this.password);
            this.downloaded = true;
        },
        commit: function() {
            let that = this;
            this.showSpinner = true;
            this.context.commitRecoveryKey(this.password).thenApply(function(res) {
                that.showSpinner = false;
                that.$toast(that.translate("RECOVERY.SAVED"));
                that.$emit("hide-recovery-key");
            }).exceptionally(function(throwable) {
                that.showSpinner = false;
                let msg = throwable.getMessage();
                console.log('Unable to commit recovery key: ' + msg);
                if (msg != null && msg.includes("different recovery key")) {
                    that.$toast.error(that.translate("RECOVERY.ALREADY"), {timeout:false});
                    that.$emit("hide-recovery-key");
                } else
                    that.$toast.error(that.translate("RECOVERY.ERROR") + ": " + msg, {timeout:false});
            });
        },
    }
}
</script>
<style>
.recovery-key {
	margin: 12px 0 4px;
	padding: 12px 16px;
	background-color: var(--pg-surface-2);
	border-radius: var(--radius-field);
	font-family: monospace;
	font-size: 15px;
	text-align: center;
	overflow-wrap: anywhere;
}
</style>
