<template>
	<RecoveryKey v-if="status == 'unset'" closable v-on:hide-recovery-key="close()"/>
	<AppModal v-else :title="translate('RECOVERY.TITLE')">
		<template #body>
			<Spinner v-if="status == null"></Spinner>
			<p v-else>{{ translate("RECOVERY.STATUS." + status.toUpperCase()) }}</p>
			<p v-if="status == 'set' && ! isLocalhost">{{ recoveryUrl }}</p>
		</template>
		<template #footer>
			<button type="button" class="pg-btn pg-btn--primary" @click="close()">{{ translate("VERSION.CLOSE") }}</button>
		</template>
	</AppModal>
</template>

<script>
const AppModal = require("AppModal.vue");
const RecoveryKey = require("../auth/RecoveryKey.vue");
const Spinner = require("../spinner/Spinner.vue");
const i18n = require("../../i18n/index.js");
const loopback = require("../../mixins/loopback/index.js");

module.exports = {
    components: {
        AppModal,
        RecoveryKey,
        Spinner,
    },
    mixins:[i18n],
    data() {
        return {
            status: null,
        };
    },
    computed: {
        ...Vuex.mapState([
            'context'
        ]),
        isLocalhost() {
            return loopback.isLoopbackHost(window.location.hostname);
        },
        recoveryUrl() {
            return window.location.origin + "/recovery";
        },
    },
    mounted() {
        let that = this;
        this.context.recoveryKeyStatus().thenApply(s => {
            that.status = s;
        });
    },
    methods: {
        close() {
            this.$store.commit("SET_MODAL", false);
        }
    },
};
</script>
