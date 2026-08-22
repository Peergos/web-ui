
<template>
	<article class="app-view pg-view mount-view">
		<AppHeader>
			<template #primary>
				<h1>{{ translate("MOUNT.TITLE") }}</h1>
			</template>
		</AppHeader>
		<main>
			<!-- first, not last: the spinner is fixed with no offset, so it covers the
			     viewport only from where it flows -->
			<Spinner v-if="showSpinner"></Spinner>


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
				<section class="pg-summary" :class="'pg-tone--' + (isMounted ? 'ok' : 'pending')">
					<span class="pg-summary__icon" aria-hidden="true">
						<svg v-if="isMounted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
						<svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/></svg>
					</span>
					<div class="pg-summary__text">
						<h2>{{ isMounted ? translate("MOUNT.SUMMARY.MOUNTED") : translate("MOUNT.SUMMARY.NOTMOUNTED") }}</h2>
					</div>
					<div class="pg-summary__actions">
						<template v-if="isMounted">
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
				<template v-if="isMounted">
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
											<a class="pg-endpoint__value pg-endpoint__value--link" href="#"
													:title="driveRoot" @click.prevent="navigateTo(driveRoot)"
													>{{ config.peergosUsername }}</a>
										</span>
									</div>
								</div>
								<span class="pg-pill pg-tone--ok">
									<span class="pg-pill__dot" aria-hidden="true"></span>{{ translate("MOUNT.STATE.MOUNTED") }}
								</span>
							</div>

							<p v-if="offline" class="pg-callout">{{ translate("MOUNT.OFFLINE") }}</p>

				<p v-if="error" class="pg-errorbox">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 16.5v.01"/></svg>
								<span>{{ error }}</span>
							</p>

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
								v-model="form.peergosPassword" @keyup.enter="onAddMount()" v-focus />
					</div>

					<label class="pg-switch">
						<input type="checkbox" v-model="form.autoMount" />
						<span class="pg-switch__track" aria-hidden="true"></span>
						<span>{{ translate("MOUNT.AUTO_MOUNT") }}</span>
					</label>

					<p v-if="error" class="pg-errorbox">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6"/><path d="M12 16.5v.01"/></svg>
						<span>{{ error }}</span>
					</p>

					<button type="button" class="pg-btn pg-btn--primary" :disabled="showSpinner || ! form.peergosPassword"
							@click="onAddMount()">
						{{ translate("MOUNT.ENABLE") }}
					</button>
				</section>
			</template>

			<!-- The mount signs in on its own, so it gets its own second factor on the account -->
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

		</main>
	</article>
</template>
<script>
const AppHeader = require("../components/AppHeader.vue");
const localServer = require("../mixins/localserver/index.js");
const paths = require("../mixins/paths/index.js");
const routerMixins = require("../mixins/router/index.js");
const network = require("../mixins/network/index.js");
const errors = require("../mixins/errors/index.js");
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
// its number for the next one. This is the name the user sees in their 2FA settings.
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
            config: { enabled: false, mountPoint: "" },
            form: { peergosPassword: "", autoMount: true },
            showSpinner: false,
            progressToastId: null,
            error: null,
            // Modal state for the TOTP confirmation prompt.
            showTotpConfirm: false,
            proposedTotpName: "",
            showFullPath: false,
            pollTimeoutId: null,
        };
    },
    mixins: [routerMixins, i18n, localServer, paths, errors, network],
    destroyed() {
        clearTimeout(this.pollTimeoutId);
        this.stopWorking();
    },
    computed: {
        ...Vuex.mapState(['context']),
        /** enabled says a mount was asked for; without a mount point there is no mount,
         *  which is what a restore that failed on startup leaves behind */
        /** The drive's own root, which is what the mounted folder is a window onto. */
        driveRoot() {
            return "/" + this.config.peergosUsername;
        },
        isMounted() {
            return this.config.enabled === true && !! this.config.mountPoint;
        },
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
            return this.cleanError(this.errText(err));
        },

        /** The spinner blocks the form while a step runs; the step itself says what it
         *  is doing in a toast, so only one of them is ever on screen per step. */
        startWorking(key) {
            this.showSpinner = true;
            this.stopWorking(true);
            this.progressToastId = this.$toast.info(this.translate(key), { timeout: false });
        },
        /** @param keepSpinner while one step hands over to the next */
        stopWorking(keepSpinner) {
            if (keepSpinner !== true) this.showSpinner = false;
            if (this.progressToastId != null) {
                this.$toast.dismiss(this.progressToastId);
                this.progressToastId = null;
            }
        },
        navigateTo(path) {
            this.openFileOrDir("Drive", path, { filename: "" });
        },
        getConfig() {
            let that = this;
            this.localPost("/peergos/v0/mount/get-config").then(function(result) {
                that.config = result;
                // the server reports a failed restore here and nowhere else, so a
                // dropped error leaves the page claiming a mount that is not there
                if (result != null && result.error)
                    that.error = that.cleanError(result.error);
                // a saved mount is restored in the background as the app starts: enabled
                // with no mount point yet means that is still running, so wait for it
                // rather than offering the form as though nothing were mounted
                else if (that.config.enabled === true && ! that.config.mountPoint) {
                    that.startWorking("MOUNT.ENABLING");
                    that.pollForMount();
                }
            }).catch(function(err) {
                that.error = that.problem(err);
            });
        },
        /** Every mount gets its own second factor, whether or not the account has 2FA today:
         *  that way turning 2FA on later doesn't break a mount that is already running. */
        onAddMount() {
            let that = this;
            this.error = null;
            this.startWorking("MOUNT.CHECKING_MFA");
            this.context.network.account.getSecondAuthMethods(
                this.context.username, this.context.signer
            ).thenApply(mfaMethods => {
                that.stopWorking();
                // only other mounts' names matter - the number distinguishes them from each other
                const existingNames = mfaMethods.toArray([]).map(m => m.name);
                const os = detectOs();
                that.proposedTotpName = "Drive mount - " + os + " " + nextFreeMountIndex(existingNames, os);
                that.showTotpConfirm = true;
            }).exceptionally(function(err) {
                that.stopWorking();
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
            this.startWorking("MOUNT.PROVISIONING_TOTP");
            try {
                // 1) Ask the server to mint this mount a credential of its own. This is a
                //    MOUNT factor, not a TOTP, so it never replaces the user's authenticator.
                const mountKey = await new Promise((resolve, reject) => {
                    that.context.network.account.addMountFactor(
                        that.context.username, that.proposedTotpName, that.context.signer
                    ).thenApply(resolve).exceptionally(reject);
                });
                const credentialId = mountKey.credentialId;
                const secret       = mountKey.key;

                // 2) Generate the current code from the freshly-issued secret so we
                //    can prove possession to enableMountFactor.
                const code = await generateTotpCode(secret);

                // 3) Activate the new factor server-side.
                const enabled = await new Promise((resolve, reject) => {
                    that.context.network.account.enableMountFactor(
                        that.context.username, credentialId, code, that.context.signer
                    ).thenApply(resolve).exceptionally(reject);
                });
                if (enabled !== true && enabled !== "true") {
                    throw new Error(that.translate("MOUNT.TOTP.ENABLE_FAILED"));
                }

                // 4) Hand the credential to the mount handler so subsequent mount
                //    logins answer the 2FA challenge non-interactively.
                that.enableInternal(bytesToHex(credentialId), bytesToHex(secret));
            } catch (err) {
                that.stopWorking();
                that.error = that.problem(err);
            }
        },
        enableInternal(totpCredentialIdHex, totpSecretHex) {
            let that = this;
            this.startWorking("MOUNT.ENABLING");
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
                that.stopWorking();
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
                    that.stopWorking();
                    that.error = that.translate("MOUNT.TIMEOUT");
                    return;
                }
                that.pollTimeoutId = setTimeout(() => that.pollForMount(next), 1000);
            };
            this.localPost("/peergos/v0/mount/get-config").then(function(result) {
                if (result.error) {
                    that.stopWorking();
                    that.error = that.cleanError(result.error);
                } else if (result.enabled && result.mountPoint) {
                    that.stopWorking();
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
            this.startWorking("MOUNT.DISABLING");
            try {
                // the mount revokes its own second factor as it tears down - it still holds the
                // credentials to do so, and it works even if this tab goes away mid-unmount
                await this.localPost("/peergos/v0/mount/disable");
                this.config = { enabled: false, mountPoint: "" };
                this.stopWorking();
                const os = detectOs();
                if (os === "Windows" || os === "macOS") {
                    this.$toast.info(this.translate("MOUNT.UNMOUNTED.LOCAL_FILES"), {timeout: false});
                }
            } catch (err) {
                this.stopWorking();
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

.mount-setup .pg-switch {
	/* hugs its label, rather than stretching to the width of the card */
	align-self: flex-start;
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
