<template>
    <div v-if="!showAppSandbox" class="pg-viewer__mask">
        <!-- while its manifest is read: the frame the app opens in, with a way out should the read
             not finish. The app's own frame then takes its place rather than opening inside a mask
             of this one's, so a click beside an app reaches only the app's mask, which leaves it open -->
        <section class="pg-viewer" role="dialog" aria-modal="true" :aria-label="translate('DRIVE.RUN')">
            <header class="pg-viewer__bar">
                <span class="pg-viewer__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
                </span>
                <h2 class="pg-viewer__title">{{ translate("DRIVE.RUN") }}</h2>
                <DialogClose @close="close"/>
            </header>
            <div class="pg-viewer__body">
                <Spinner :absolutePosition="true"></Spinner>
            </div>
        </section>
    </div>
    <AppSandbox
        v-else
        v-on:hide-app-sandbox="closeAppSandbox"
        :sandboxAppName="sandboxAppName"
        :currentProps="currentProps">
    </AppSandbox>
</template>

<script>
const sandboxMixin = require("../../mixins/sandbox/index.js");
const i18n = require("../../i18n/index.js");
const AppSandbox = require("./AppSandbox.vue");
const DialogClose = require("../dialog/DialogClose.vue");
const Spinner = require("../spinner/Spinner.vue");

module.exports = {
    components: {
		AppSandbox,
		DialogClose,
		Spinner
    },
    data: function() {
        return {
            showAppSandbox: false,
            sandboxAppName: '',
            currentProps: null
        }
    },
    props: ['appPropsFile'],
    mixins:[sandboxMixin, i18n],
    computed: {
        ...Vuex.mapState([
            'context',
        ])
    },
    created: function() {
        this.loadAppProperties();
    },
    methods: {
        close: function () {
            this.$emit("hide-app-run");
        },
        loadAppProperties: function() {
            let that = this;
            that.verifyJSONFile(this.appPropsFile).thenApply((res) => {
                if (res.errors.length > 0) {
                    that.showError("Unable to run App: " + res.errors.join(', '));
                    that.close();
                } else {
                    let messagePermission = res.props.permissions.filter(p => (p === "EXCHANGE_MESSAGES_WITH_FRIENDS" || p === "USE_MAILBOX")).length > 0;
                    let editPermission = res.props.permissions.filter(p => p == 'EDIT_CHOSEN_FILE').length > 0;
                    let hasFileExtensions = res.props.fileExtensions.length > 0;
                    let createFile = editPermission && hasFileExtensions;
                    let templateApp = res.props.template.length > 0;
                    if (!res.props.launchable || messagePermission || templateApp) {
                        that.showError("App must be installed first!");
                        that.close();
                    } else {
                        that.runApp(res.props);
                    }
                }
            });
        },
        showError: function(message) {
            this.$toast.error(message, {timeout:false});
        },
        runApp: function(props) {
            this.showAppSandbox = true;
            this.sandboxAppName = props.name;
            this.currentProps = props;
        },
        closeAppSandbox() {
            this.showAppSandbox = false;
            this.$emit("hide-app-run");
        },
    }
}
</script>
