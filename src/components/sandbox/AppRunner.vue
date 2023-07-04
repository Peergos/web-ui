<template>
<transition name="modal">
<div class="modal-mask" @click="close">
    <meta http-equiv="content-type" content="text/html; charset=utf-8" />
        <span @click="close" tabindex="0" v-on:keyup.enter="close" aria-label="close" class="close">&times;</span>
        <div class="modal-body">
            <Spinner v-if="showSpinner"></Spinner>
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
import sandboxMixin from "../../mixins/sandbox/index.js";
import AppSandbox from "./AppSandbox.vue";
import Spinner from "../spinner/Spinner.vue";

import { mapState } from 'vuex'
import { toast } from 'vue3-toastify';
import 'vue3-toastify/dist/index.css';

export default {
    components: {
		AppSandbox,
		Spinner
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
        ...mapState([
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
                    let messagePermission = res.props.permissions.filter(p => p === "EXCHANGE_MESSAGES_WITH_FRIENDS");
                    let editPermission = res.props.permissions.filter(p => p == 'EDIT_CHOSEN_FILE').length > 0;
                    let hasFileExtensions = res.props.fileExtensions.length > 0;
                    let createFile = editPermission && hasFileExtensions;
                    if (!res.props.launchable || (res.props.launchable && createFile) || messagePermission.length > 0) {
                        that.showError("App must be installed first!");
                        that.close();
                    } else {
                        that.runApp(res.props);
                    }
                }
            });
        },
        showError: function(message) {
            toast.error(message, {autoClose:false});
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
