<template>
<transition name="modal">
<div class="modal-mask" @click="close">
    <meta http-equiv="content-type" content="text/html; charset=utf-8" />
        <span @click="close" tabindex="0" v-on:keyup.enter="close" aria-label="close" class="close">&times;</span>
        <div class="modal-body">
            <spinner v-if="showSpinner"></spinner>
        </div>
        <AppSandbox
            v-if="showAppSandbox"
            v-on:hide-app-sandbox="closeAppSandbox"
            :sandboxAppName="sandboxAppName"
            :currentProps="currentProps">
        </AppSandbox>
</div>
</transition>
</template>

<script>
const sandboxMixin = require("../../mixins/sandbox/index.js");
const AppSandbox = require("./AppSandbox.vue");

module.exports = {
    components: {
		AppSandbox
    },
    data: function() {
        return {
            showSpinner: false,
            spinnerMessage: '',
            showAppSandbox: false,
            sandboxAppName: '',
            currentProps: null
        }
    },
    props: ['appPropsFile'],
    mixins:[sandboxMixin],
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
            this.showSpinner = true;
            that.verifyJSONFile(this.appPropsFile).thenApply((res) => {
                that.showSpinner = false;
                if (res.errors.length > 0) {
                    that.showError("Unable to run App: " + res.errors.join(', '));
                    that.close();
                } else {
                    if (!res.props.launchable) {
                        that.showError("App must be installed first! Launchable property==false");
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
<style>
</style>
