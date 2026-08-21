
<template>
	<article class="app-view pg-view mount-view">
		<AppHeader>
			<template #primary>
				<h1>{{ translate("MOUNT.TITLE") }}</h1>
			</template>
		</AppHeader>
		<main>

			<section v-if="isMac" class="pg-empty">
				<h2>{{ translate("MOUNT.TITLE") }}</h2>
				<p>Coming soon to macOS.</p>
			</section>

			<section v-else-if="! enabled" class="pg-empty">
				<h2>{{ translate("MOUNT.DISABLED.TITLE") }}</h2>
				<p>{{ translate("MOUNT.DISABLED") }}
					<a href="https://peergos.org/download" target="_blank" rel="noopener">https://peergos.org/download</a></p>
			</section>

			<template v-else>
				<!-- The state you came to find out, and the action that changes it -->
				<section class="pg-summary" :class="'pg-tone--' + (config.enabled ? 'ok' : 'pending')">
					<span class="pg-summary__icon" aria-hidden="true">
						<svg v-if="config.enabled" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
						<svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>
					</span>
					<div class="pg-summary__text">
						<h2>{{ config.enabled ? translate("MOUNT.SUMMARY.MOUNTED") : translate("MOUNT.SUMMARY.NOTMOUNTED") }}</h2>
					</div>
					<div class="pg-summary__actions">
						<template v-if="config.enabled">
							<button type="button" class="pg-btn pg-btn--onTone" @click="openInExplorer()">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>
								{{ translate("MOUNT.OPEN") }}
							</button>
							<button type="button" class="pg-btn pg-btn--pause" @click="disable()">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>
								{{ translate("MOUNT.UNMOUNT") }}
							</button>
						</template>
					</div>
				</section>

				<!-- Mounted: the same endpoint pair the sync page uses -->
				<template v-if="config.enabled">
					<ul class="pg-cards">
						<li class="pg-card">
							<div class="pg-card__head">
								<div class="pg-route">
									<div class="pg-endpoint">
										<span class="pg-endpoint__icon" aria-hidden="true">
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>
										</span>
										<span class="pg-endpoint__text">
											<span class="pg-endpoint__label">{{ translate("SYNC.THISDEVICE") }}</span>
											<span class="pg-endpoint__value" :class="{ 'pg-endpoint__value--open': showFullPath }"
													:title="config.mountPoint" @click="showFullPath = ! showFullPath">
												<span class="pg-path__head">{{ pathHead(config.mountPoint) }}</span
												><span class="pg-path__tail">{{ pathTail(config.mountPoint) }}</span>
											</span>
										</span>
									</div>
									<span class="pg-route__arrow" aria-hidden="true">
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4 3 8l4 4"/><path d="M3 8h13"/><path d="m17 20 4-4-4-4"/><path d="M21 16H8"/></svg>
									</span>
									<div class="pg-endpoint">
										<span class="pg-endpoint__icon" aria-hidden="true">
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19a4.5 4.5 0 0 0 .5-8.97A6 6 0 0 0 6.1 11.1 3.5 3.5 0 0 0 6.5 19Z"/></svg>
										</span>
										<span class="pg-endpoint__text">
											<span class="pg-endpoint__label">{{ translate("SYNC.DRIVE") }}</span>
											<span class="pg-endpoint__value">{{ config.peergosUsername }}</span>
										</span>
									</div>
								</div>
								<span class="pg-pill pg-tone--ok">
									<span class="pg-pill__dot" aria-hidden="true"></span>{{ translate("MOUNT.STATE.MOUNTED") }}
								</span>
							</div>

							<p v-if="error" class="pg-errorbox">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 16.5v.01"/></svg>
								<span>{{ error }}</span>
							</p>

							<div class="pg-card__foot">
								<div class="pg-chips">
									<span class="pg-chip">{{ translate("MOUNT.PORT") }} {{ config.webdavPort }}</span>
									<span class="pg-chip">{{ translate("MOUNT.AUTH_TYPE") }} {{ config.authType }}</span>
								</div>
							</div>
						</li>
					</ul>
					<p class="pg-note">{{ translate("MOUNT.UNMOUNTED.LOCAL_FILES") }}</p>
				</template>

				<!-- Not mounted: say what it costs before they commit, not after -->
				<section v-else class="pg-card mount-setup">
					<p class="pg-note">{{ translate("MOUNT.BODY") }}</p>

					<div class="mount-field">
						<label for="mount-user">{{ translate("MOUNT.PEERGOS_USER") }}</label>
						<input id="mount-user" class="pg-input" type="text" autocomplete="username"
								:value="context.username" readonly />
					</div>
					<div class="mount-field">
						<label for="mount-pass">{{ translate("MOUNT.PEERGOS_PASSWORD") }}</label>
						<input id="mount-pass" class="pg-input" type="password" autocomplete="current-password"
								v-model="form.peergosPassword" @keyup.enter="onAddMount()" />
					</div>

					<label class="mount-check">
						<input type="checkbox" v-model="form.autoMount" />
						<span>{{ translate("MOUNT.AUTO_MOUNT") }}</span>
					</label>

					<div class="pg-callout">
						<strong>{{ translate("MOUNT.TWOFA.HEADING") }}</strong>
						<span>{{ translate("MOUNT.TWOFA.BODY") }}</span>
					</div>

					<p v-if="error" class="pg-errorbox">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 16.5v.01"/></svg>
						<span>{{ error }}</span>
					</p>

					<button type="button" class="pg-btn pg-btn--primary" :disabled="showSpinner"
							@click="onAddMount()">
						{{ translate("MOUNT.ENABLE") }}
					</button>
				</section>
			</template>

			<!-- Shown only when the account already has 2FA and the mount needs its own TOTP -->
			<div v-if="showTotpConfirm" class="mount-modal" role="dialog" aria-modal="true"
					tabindex="-1" ref="totpDialog" @keydown.esc="cancelTotpConfirm()">
				<div class="pg-card mount-modal__panel">
					<h2>{{ translate("MOUNT.TOTP.TITLE") }}</h2>
					<p class="pg-note">{{ translate("MOUNT.TOTP.EXPLAIN") }}</p>
					<p class="pg-note"><strong>{{ translate("MOUNT.TOTP.NAME_LABEL") }}:</strong> <code>{{ proposedTotpName }}</code></p>
					<div class="pg-callout">{{ translate("MOUNT.TOTP.CLEANUP") }}</div>
					<div class="mount-modal__actions">
						<button type="button" class="pg-btn" @click="cancelTotpConfirm()">{{ translate("MOUNT.TOTP.CANCEL") }}</button>
						<button type="button" class="pg-btn pg-btn--primary" @click="confirmTotpAndEnable()">{{ translate("MOUNT.TOTP.CONFIRM") }}</button>
					</div>
				</div>
			</div>

			<Spinner v-if="showSpinner" :message="spinnerMessage"></Spinner>
		</main>
	</article>
</template>
<script>
const AppHeader = require("../components/AppHeader.vue");
const localServer = require("../mixins/localserver/index.js");
const paths = require("../mixins/paths/index.js");
const Spinner = require("../components/spinner/Spinner.vue");
const i18n = require("../i18n/index.js");
const loopback = require("../mixins/loopback/index.js");

// a mount that has not appeared in a minute is not going to
const MOUNT_POLL_LIMIT = 60;

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

// RFC 6238 TOTP: 30s step, 6 digits, HMAC-SHA1, matching what the server enforces.
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

// Lowest free N such that "Drive mount - <os> N" is unused, so removing a mount frees
// its number for the next one.
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
            showFullPath: false,
            pollTimeoutId: null,
        };
    },
    mixins: [i18n, localServer, paths],
    destroyed() {
        clearTimeout(this.pollTimeoutId);
    },
    computed: {
        ...Vuex.mapState(['context']),
        enabled() {
            return loopback.isLoopbackHost(window.location.hostname);
        },
        isMac() {
            return detectOs() === "macOS";
        },
    },
    created() {
        // the 2FA lookup waits for the user to ask to mount: nothing security sensitive
        // should happen just because the page was opened
        if (this.enabled) this.getConfig();
    },
    methods: {
        /** rejections arrive as a string, an Error, or the server's own object */
        problem(err) {
            if (err == null)
                return null;
            return err.detailMessage || err.message || String(err);
        },


        getConfig() {
            let that = this;
            this.localPost("/peergos/v0/mount/get-config").then(function(result) {
                that.config = result;
            }).catch(function(err) {
                that.error = that.problem(err);
            });
        },
        /** Detours through the TOTP modal when the account already has 2FA. */
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
                that.error = that.problem(err);
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
                clearRootKeyCacheFully(() => {});

                // 4) Hand the credential to the mount handler so subsequent mount
                //    logins use the dedicated TOTP non-interactively.
                that.enableInternal(bytesToHex(credentialId), bytesToHex(secret));
            } catch (err) {
                that.showSpinner = false;
                that.error = that.problem(err);
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
                that.error = that.problem(err);
            });
        },
        /** @param attempt counts up so a mount that never arrives stops asking rather than
         *  polling for as long as the tab is open */
        pollForMount(attempt) {
            let that = this;
            let next = (attempt == null ? 0 : attempt) + 1;
            let again = () => {
                if (next > MOUNT_POLL_LIMIT) {
                    that.showSpinner = false;
                    that.error = that.translate("MOUNT.TIMEOUT");
                    return;
                }
                that.pollTimeoutId = setTimeout(() => that.pollForMount(next), 1000);
            };
            this.localPost("/peergos/v0/mount/get-config").then(function(result) {
                if (result.error) {
                    that.showSpinner = false;
                    that.error = result.error;
                } else if (result.enabled && result.mountPoint) {
                    that.showSpinner = false;
                    that.config = result;
                    that.form.peergosPassword = "";
                } else {
                    again();
                }
            }).catch(again);
        },
        openInExplorer() {
            // On Android there's no filesystem mount path, and the server-side JVM has
            // no Context to fire an Intent. The host app exposes a JS bridge that opens
            // the SAF root in the system Files app — use that when present.
            if (typeof window.Android !== "undefined"
                    && typeof window.Android.openMountInFiles === "function") {
                window.Android.openMountInFiles();
                return;
            }
            let that = this;
            this.localPost("/peergos/v0/mount/open").catch(function(err) {
                that.$toast.error(that.translate("MOUNT.OPEN.FAILED") + ": " + err);
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
                    // Int8Array so the bytes arrive signed, as java stored them
                    const credBytes = new Int8Array(credentialHex.length / 2);
                    for (let i = 0; i < credBytes.length; i++) {
                        credBytes[i] = parseInt(credentialHex.substr(i * 2, 2), 16);
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
                const os = detectOs();
                if (os === "Windows" || os === "macOS") {
                    this.$toast.info(this.translate("MOUNT.UNMOUNTED.LOCAL_FILES"), {timeout: false});
                }
            } catch (err) {
                this.showSpinner = false;
                this.error = this.problem(err);
            }
        },
    },
};
</script>

<style>
.mount-view main {
	display: flex;
	flex-direction: column;
	gap: 18px;
	max-width: 900px;
	padding: 20px;
}

.mount-setup {
	max-width: 520px;
}

.mount-field {
	display: flex;
	flex-direction: column;
	gap: 6px;
}

.mount-field label {
	margin: 0;
	font-size: 10px;
	text-transform: uppercase;
	letter-spacing: .07em;
	color: var(--pg-muted);
}

.mount-check {
	display: flex;
	align-items: center;
	gap: 9px;
	margin: 0;
	font-weight: normal;
}

.mount-modal {
	position: fixed;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 20px;
	background-color: rgba(0, 0, 0, .45);
	z-index: 1050;
}

.mount-modal__panel {
	max-width: 520px;
}

.mount-modal__actions {
	display: flex;
	justify-content: flex-end;
	gap: 10px;
}
</style>
