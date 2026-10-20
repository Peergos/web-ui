<template>
	<div class="app-login pg-auth recover-account">
		<h2>{{ translate("RECOVER.TITLE") }}</h2>
		<template v-if="step == 1">
			<p>{{ translate("RECOVER.BLURB") }}</p>
			<FormUsername v-model="username" :placeholder="translate('LOGIN.USERNAME')" autocomplete="username"/>
			<input class="recover-account__key" type="text" v-model="recoveryKey" autocomplete="off"
				:placeholder="translate('RECOVER.KEY')"/>
			<button type="button" class="pg-btn generate-password" @click="newPassword()">{{ translate("PASSWORD.GENERATE") }}</button>
			<FormPassword v-model="password" :placeholder="translate('PASSWORD.NEW')" :passwordIsVisible="showPasswords" firstOfTwo/>
			<FormPassword v-model="password2" :placeholder="translate('PASSWORD.REENTER')" :passwordIsVisible="showPasswords"/>
			<button type="button" class="pg-btn pg-btn--primary" :disabled="network == null" @click="next()">{{ translate("RECOVERY.CONTINUE") }}</button>
		</template>
		<template v-if="step == 2">
			<p>{{ translate("RECOVER.NEW.KEY") }}</p>
			<div class="recovery-key">{{ nextRecoveryKey }}</div>
			<p v-if="! downloaded">{{ translate("RECOVERY.DOWNLOAD.FIRST") }}</p>
			<div class="recover-account__actions">
				<button type="button" class="pg-btn" @click="copyRecoveryKey(nextRecoveryKey)">{{ translate("RECOVERY.COPY") }}</button>
				<button type="button" class="pg-btn" @click="download()">{{ translate("RECOVERY.DOWNLOAD") }}</button>
			</div>
			<Spinner v-if="recovering"></Spinner>
			<button type="button" class="pg-btn pg-btn--primary" :disabled="! downloaded || recovering" @click="recover()">{{ translate("RECOVER.BUTTON") }}</button>
		</template>
		<a class="pg-btn pg-btn--quiet" href="/" v-if="! recovering">{{ translate("RECOVER.BACK") }}</a>
	</div>
</template>
<script>
const FormPassword = require("../form/FormPassword.vue");
const FormUsername = require("../form/FormUsername.vue");
const Spinner = require("../spinner/Spinner.vue");
const UriDecoder = require('../../mixins/uridecoder/index.js');
const i18n = require("../../i18n/index.js");
const passwordMixin = require("../../mixins/password/index.js");
const recoveryMixin = require("../../mixins/recovery/index.js");

module.exports = {
    components: {
        FormPassword,
        FormUsername,
        Spinner,
    },
    data: function() {
        return {
            step: 1,
            username: '',
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
    mixins:[i18n, passwordMixin, recoveryMixin, UriDecoder],
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
            this.$toast.dismiss('recover');
            this.nextRecoveryKey = this.generateWords();
            this.step = 2;
        },
        download: function() {
            this.downloadRecoveryKey(this.username, this.nextRecoveryKey);
            this.downloaded = true;
        },
        recover: function() {
            let that = this;
            this.recovering = true;
            const start = Date.now();
            peergos.shared.user.UserContext.recoverAccount(this.username, this.recoveryKey.trim(), this.password,
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
    }
}
</script>
<style>
.recover-account__key {
	width: 100%;
	font-family: monospace;
}
.recover-account__actions {
	display: flex;
	gap: 8px;
}
</style>
