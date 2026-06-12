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
                        <input class="form-control" type="password" v-model="form.peergosPassword" @keyup.enter="onAddMount()" />
                    </div>
                    <div style="margin-bottom:1em;">
                        <label>
                            <input type="checkbox" v-model="form.autoMount" />
                            {{ translate("MOUNT.AUTO_MOUNT") }}
                        </label>
                    </div>
                    <button class="btn btn-success" @click="onAddMount()">{{ translate("MOUNT.ENABLE") }}</button>
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

            <!-- Confirmation modal: shown only when the user has existing 2FA and we
                 need to provision a dedicated TOTP for the mount. -->
            <div v-if="showTotpConfirm" class="modal" style="display:block; background:rgba(0,0,0,0.4);">
                <div class="modal-dialog" role="document">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">{{ translate("MOUNT.TOTP.TITLE") }}</h5>
                        </div>
                        <div class="modal-body">
                            <p>{{ translate("MOUNT.TOTP.EXPLAIN") }}</p>
                            <p>
                                <strong>{{ translate("MOUNT.TOTP.NAME_LABEL") }}:</strong>
                                <code>{{ proposedTotpName }}</code>
                            </p>
                            <p>{{ translate("MOUNT.TOTP.CLEANUP") }}</p>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary" @click="cancelTotpConfirm()">{{ translate("MOUNT.TOTP.CANCEL") }}</button>
                            <button class="btn btn-primary" @click="confirmTotpAndEnable()">{{ translate("MOUNT.TOTP.CONFIRM") }}</button>
                        </div>
                    </div>
                </div>
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

// ---------- helpers (TOTP code generation, byte/hex, OS detection) ----------

function bytesToHex(bytes) {
    // Accepts ArrayBuffer, TypedArray or a plain array; emits lowercase hex.
    let u8;
    if (bytes instanceof ArrayBuffer) u8 = new Uint8Array(bytes);
    else if (bytes.buffer) u8 = new Uint8Array(bytes.buffer, bytes.byteOffset || 0, bytes.byteLength);
    else u8 = Uint8Array.from(bytes);
    let out = "";
    for (let i = 0; i < u8.length; i++) {
        out += u8[i].toString(16).padStart(2, "0");
    }
    return out;
}

function toUint8(maybeSigned) {
    // Java byte[] crossing the GWT JS boundary often arrives as Int8Array.
    // Convert to Uint8Array without copying bytes (just reinterprets the view).
    if (maybeSigned instanceof Uint8Array) return maybeSigned;
    if (maybeSigned && maybeSigned.buffer) {
        return new Uint8Array(maybeSigned.buffer, maybeSigned.byteOffset || 0, maybeSigned.byteLength);
    }
    return Uint8Array.from(maybeSigned);
}

// RFC 6238 TOTP, 30 s step, 6 digits, HMAC-SHA1 — same parameters Peergos
// enforces server-side (see TotpKey.ALGORITHM and JdbcAccount line ~307).
async function generateTotpCode(keyBytes) {
    const u8 = toUint8(keyBytes);
    const epoch = Math.floor(Date.now() / 1000 / 30);
    const counter = new ArrayBuffer(8);
    const view = new DataView(counter);
    view.setUint32(0, 0);
    view.setUint32(4, epoch);
    const key = await window.crypto.subtle.importKey(
        "raw", u8, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]
    );
    const hmacBuf = await window.crypto.subtle.sign("HMAC", key, counter);
    const hmac = new Uint8Array(hmacBuf);
    const offset = hmac[19] & 0x0f;
    const bin = ((hmac[offset] & 0x7f) << 24)
              | (hmac[offset + 1] << 16)
              | (hmac[offset + 2] << 8)
              | hmac[offset + 3];
    return String(bin % 1000000).padStart(6, "0");
}

function detectOs() {
    const ua = navigator.userAgent || "";
    if (/Android/i.test(ua))                          return "Android";
    if (/Windows/i.test(ua))                          return "Windows";
    if (/Mac OS X|Macintosh|Mac_PowerPC/i.test(ua))   return "macOS";
    return "Linux";
}

// Lowest free integer N >= 1 such that "Drive mount - <os> N" is not already
// in `existingNames`. Matches the user spec: deleting a mount frees N for reuse.
function nextFreeMountIndex(existingNames, os) {
    const prefix = "Drive mount - " + os + " ";
    const taken = new Set();
    for (const name of existingNames) {
        if (typeof name !== "string") continue;
        if (!name.startsWith(prefix)) continue;
        const rest = name.slice(prefix.length);
        const n = parseInt(rest, 10);
        if (!isNaN(n) && n > 0 && String(n) === rest) taken.add(n);
    }
    let n = 1;
    while (taken.has(n)) n++;
    return n;
}

module.exports = {
    components: { AppHeader, Spinner },
    data() {
        return {
            config: { enabled: false, mountPoint: "", webdavPort: 8090, authType: "digest" },
            form: { peergosPassword: "", autoMount: true },
            showSpinner: false,
            spinnerMessage: "",
            error: null,
            // Modal state for the TOTP confirmation prompt.
            showTotpConfirm: false,
            proposedTotpName: "",
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
        // NOTE: we intentionally do NOT query 2FA methods here. Per design, the
        // 2FA lookup runs only after the user clicks "Add Mount" — keeps the
        // page load cheap and matches user expectation that nothing security-
        // sensitive happens until they ask for it.
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
        // Entry point for the "Add Mount" button. Decides whether to detour
        // through the TOTP-provisioning modal based on the user's current 2FA.
        onAddMount() {
            let that = this;
            this.error = null;
            this.showSpinner = true;
            this.spinnerMessage = this.translate("MOUNT.CHECKING_MFA");
            this.context.network.account.getSecondAuthMethods(
                this.context.username, this.context.signer
            ).thenApply(mfaMethods => {
                that.showSpinner = false;
                const methods = mfaMethods.toArray([]);
                if (methods.length === 0) {
                    // No existing 2FA → password-only mount, as today.
                    that.enableInternal("", "");
                    return;
                }
                // 2FA present → propose a name, show the confirmation modal.
                const os = detectOs();
                const existingNames = methods.map(m => m.name);
                const n = nextFreeMountIndex(existingNames, os);
                that.proposedTotpName = "Drive mount - " + os + " " + n;
                that.showTotpConfirm = true;
            }).exceptionally(function(err) {
                that.showSpinner = false;
                that.error = err && err.detailMessage
                        ? err.detailMessage
                        : ("Unable to query 2FA methods: " + err);
            });
        },
        cancelTotpConfirm() {
            this.showTotpConfirm = false;
            this.proposedTotpName = "";
        },
        async confirmTotpAndEnable() {
            let that = this;
            this.showTotpConfirm = false;
            this.showSpinner = true;
            this.spinnerMessage = this.translate("MOUNT.PROVISIONING_TOTP");
            try {
                // 1) Ask the server to mint a new TOTP credential.
                const totpKey = await new Promise((resolve, reject) => {
                    that.context.network.account.addTotpFactor(
                        that.context.username, that.context.signer
                    ).thenApply(resolve).exceptionally(reject);
                });
                const credentialId = totpKey.credentialId;
                const secret       = totpKey.key;

                // 2) Generate the current code from the freshly-issued secret so we
                //    can prove possession to enableTotpFactor.
                const code = await generateTotpCode(secret);

                // 3) Activate the new factor server-side.
                const enabled = await new Promise((resolve, reject) => {
                    that.context.network.account.enableTotpFactor(
                        that.context.username, credentialId, code, that.context.signer
                    ).thenApply(resolve).exceptionally(reject);
                });
                if (enabled !== true && enabled !== "true") {
                    throw new Error(that.translate("MOUNT.TOTP.ENABLE_FAILED"));
                }

                // 4) Hand the credential to the mount handler so subsequent mount
                //    logins use the dedicated TOTP non-interactively.
                that.enableInternal(bytesToHex(credentialId), bytesToHex(secret));
            } catch (err) {
                that.showSpinner = false;
                that.error = err && err.message ? err.message : String(err);
            }
        },
        enableInternal(totpCredentialIdHex, totpSecretHex) {
            let that = this;
            this.showSpinner = true;
            this.spinnerMessage = this.translate("MOUNT.ENABLING");
            let body = JSON.stringify({
                peergosUsername: this.context.username,
                peergosPassword: this.form.peergosPassword,
                autoMount: this.form.autoMount,
                totpCredentialId: totpCredentialIdHex,
                totpSecret: totpSecretHex,
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
        async disable() {
            let that = this;
            this.showSpinner = true;
            this.spinnerMessage = this.translate("MOUNT.DISABLING");
            try {
                // If the mount has a dedicated TOTP credential, remove it from the
                // user's second-factor set so we don't leave it orphaned.
                const credentialHex = this.config && this.config.totpCredentialId;
                if (credentialHex && credentialHex.length > 0) {
                    const credBytes = new Int8Array(credentialHex.length / 2);
                    for (let i = 0; i < credBytes.length; i++) {
                        credBytes[i] = parseInt(credentialHex.substr(i * 2, 2), 16) | 0;
                        // Map 0..255 → signed -128..127 so the byte[] matches what
                        // the server stored when addTotpFactor returned it.
                        if (credBytes[i] > 127) credBytes[i] -= 256;
                    }
                    await new Promise((resolve, reject) => {
                        that.context.network.account.deleteSecondFactor(
                            that.context.username, credBytes, that.context.signer
                        ).thenApply(resolve).exceptionally(reject);
                    });
                }
                await this.localPost("/peergos/v0/mount/disable");
                this.config = { enabled: false, mountPoint: "" };
                this.showSpinner = false;
            } catch (err) {
                this.showSpinner = false;
                this.error = err && err.message ? err.message : String(err);
            }
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
