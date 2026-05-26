<template>
    <article class="app-view mount-view">
        <AppHeader>
            <template #primary>
                <h1>{{ translate("MOUNT.TITLE") }}</h1>
            </template>
        </AppHeader>
        <main>
            <div v-if="enabled" style="width:100%;">
                <div v-if="config.enabled" style="padding:1em;">
                    <p><label>{{ translate("MOUNT.PEERGOS_USER") }}</label> <strong>{{ config.peergosUsername }}</strong></p>
                    <p><label>{{ translate("MOUNT.MOUNT_PATH") }}</label> <strong>{{ config.mountPoint }}</strong></p>
                    <button class="btn btn-warning" @click="disable()">{{ translate("MOUNT.DISABLE") }}</button>
                </div>
                <div v-if="!config.enabled" style="max-width:480px; padding:1em;">
                    <div style="margin-bottom:1em;">
                        <label>{{ translate("MOUNT.PEERGOS_USER") }}</label>
                        <input class="form-control" type="text" :value="context.username" readonly />
                    </div>
                    <div style="margin-bottom:1em;">
                        <label>{{ translate("MOUNT.PEERGOS_PASSWORD") }}</label>
                        <input class="form-control" type="password" v-model="form.peergosPassword" @keyup.enter="enable()" />
                    </div>
                    <div style="margin-bottom:1em;">
                        <label>
                            <input type="checkbox" v-model="form.autoMount" />
                            {{ translate("MOUNT.AUTO_MOUNT") }}
                        </label>
                    </div>
                    <button class="btn btn-success" @click="enable()">{{ translate("MOUNT.ENABLE") }}</button>
                    <p v-if="error" style="color:red;">{{ error }}</p>
                </div>
            </div>
            <div v-if="!enabled" style="width:100%;">
                <center>
                <div class="hspace-5" style="max-width:600px;">
                    <h1>{{ translate("MOUNT.DISABLED.TITLE") }}</h1>
                    {{ translate("MOUNT.DISABLED") }}
                    <br/>
                    <a href="https://peergos.org/download" target="_blank">https://peergos.org/download</a>
                </div>
                </center>
            </div>
            <Spinner v-if="showSpinner" :message="spinnerMessage"></Spinner>
        </main>
    </article>
</template>

<script>
const AppHeader = require("../components/AppHeader.vue");
const Spinner = require("../components/spinner/Spinner.vue");
const i18n = require("../i18n/index.js");
const loopback = require("../mixins/loopback/index.js");

module.exports = {
    components: { AppHeader, Spinner },
    data() {
        return {
            config: { enabled: false, mountPoint: "", webdavPort: 8090, authType: "digest" },
            form: { peergosPassword: "", autoMount: true },
            showSpinner: false,
            spinnerMessage: "",
            error: null,
        };
    },
    mixins: [i18n],
    computed: {
        ...Vuex.mapState(['context']),
        enabled() {
            return loopback.isLoopbackHost(window.location.hostname);
        },
    },
    created() {
        if (this.enabled) this.getConfig();
    },
    methods: {
        localPost(url, body) {
            return new Promise(function(resolve, reject) {
                var req = new XMLHttpRequest();
                req.open('POST', url);
                req.responseType = 'json';
                req.onload = function() {
                    if (req.status == 200) resolve(req.response);
                    else {
                        let trailer = req.getResponseHeader("Trailer");
                        reject(trailer || 'Unexpected error from server');
                    }
                };
                req.onerror = function() { reject(Error("Unable to connect")); };
                req.send(body != null ? body : new Int8Array(0));
            });
        },
        getConfig() {
            let that = this;
            this.localPost("/peergos/v0/mount/get-config").then(function(result) {
                that.config = result;
            });
        },
        enable() {
            let that = this;
            this.error = null;
            this.showSpinner = true;
            this.spinnerMessage = that.translate("MOUNT.ENABLING");
            let body = JSON.stringify({
                peergosUsername: this.context.username,
                peergosPassword: this.form.peergosPassword,
                autoMount: this.form.autoMount,
            });
            this.localPost("/peergos/v0/mount/enable", body).then(function() {
                that.pollForMount();
            }).catch(function(err) {
                that.showSpinner = false;
                that.error = err;
            });
        },
        pollForMount() {
            let that = this;
            this.localPost("/peergos/v0/mount/get-config").then(function(result) {
                if (result.error) {
                    that.showSpinner = false;
                    that.error = result.error;
                } else if (result.enabled && result.mountPoint) {
                    that.showSpinner = false;
                    that.config = result;
                } else {
                    setTimeout(() => that.pollForMount(), 1000);
                }
            }).catch(function() {
                setTimeout(() => that.pollForMount(), 1000);
            });
        },
        disable() {
            let that = this;
            this.localPost("/peergos/v0/mount/disable").then(function() {
                that.config = { enabled: false, mountPoint: "" };
            });
        },
    },
};
</script>

<style>
.mount-view main {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-height: 100vh;
    padding: var(--app-margin);
}
</style>
