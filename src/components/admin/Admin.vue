<template>
<transition name="modal">
<div class="pg-dialog__mask" @click="close">
    <div class="pg-dialog admin-panel" role="dialog" aria-modal="true" aria-labelledby="admin-panel-title" tabindex="-1" @click.stop>
        <header class="pg-dialog__head">
            <h2 class="pg-dialog__title" id="admin-panel-title">Admin panel</h2>
            <DialogClose @close="close"/>
        </header>

        <div class="pg-dialog__body admin-panel__body">
            <section class="admin-panel__section">
                <h3 class="admin-panel__heading">Space requests</h3>
                <p v-if="data.pending.length == 0" class="pg-note">No one is waiting for more space.</p>
                <ul v-else class="admin-panel__requests">
                    <li v-for="req in data.pending" class="admin-panel__request">
                        <span class="admin-panel__who">
                            <span class="admin-panel__name">{{ req.getUsername() }}</span>
                            <span class="pg-note">{{ req.getSizeInMiB() }} MiB</span>
                        </span>
                        <button type="button" class="pg-btn pg-btn--danger" :disabled="showSpinner" @click="reject(req)">Deny</button>
                        <button type="button" class="pg-btn pg-btn--primary" :disabled="showSpinner" @click="approve(req)">Approve</button>
                    </li>
                </ul>
            </section>

            <section class="admin-panel__section admin-invites">
                <h3 class="admin-panel__heading">
                    Signup invites<span v-if="invites.length > 0" class="admin-invites__count"> · {{ invites.length }} unused</span>
                </h3>
                <p class="pg-note">Each link lets one new user sign up, even while this server is not accepting signups. It stays here until someone uses it or you cancel it.</p>
                <div class="admin-invites__create">
                    <div class="admin-invites__stepper">
                        <button type="button" class="admin-invites__step" aria-label="One fewer invite" :disabled="invitesBusy || ! (inviteCount > 1)" @click="step(-1)">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>
                        </button>
                        <input id="admin-invite-count" type="number" inputmode="numeric" min="1" :max="maxInvites" aria-label="How many invites" v-model.number="inviteCount" @keyup.enter="createInvites()">
                        <button type="button" class="admin-invites__step" aria-label="One more invite" :disabled="invitesBusy || ! (inviteCount < maxInvites)" @click="step(1)">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
                        </button>
                    </div>
                    <button type="button" class="pg-btn pg-btn--primary admin-invites__submit" :disabled="invitesBusy" @click="createInvites()">{{ createLabel }}</button>
                </div>
                <p v-if="invitesError" class="pg-note">Couldn't load the unused invites: {{ invitesError }}</p>
                <p v-else-if="invitesLoaded && invites.length == 0" class="pg-note">No unused invites.</p>
                <ul v-if="invites.length > 0" class="admin-invites__list">
                    <li v-for="invite in invites" :key="invite.token">
                        <input type="text" class="pg-input" readonly :value="invite.link" aria-label="Invite link" @focus="$event.target.select()">
                        <button type="button" class="pg-btn admin-invites__copy" aria-label="Copy invite link" @click="copy(invite.link)">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
                            <span class="admin-invites__copy-text">Copy</span>
                        </button>
                        <button type="button" class="admin-invites__cancel" aria-label="Cancel invite" title="Cancel invite" :disabled="invitesBusy" @click="cancelInvite(invite)">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
                        </button>
                    </li>
                </ul>
            </section>
        </div>
        <div v-if="showSpinner" class="pg-dialog__loading"><Spinner></Spinner></div>
    </div>
</div>
</transition>
</template>
<script>
const Spinner = require("../spinner/Spinner.vue");
const DialogClose = require("../dialog/DialogClose.vue");

module.exports = {
	components: {
	    Spinner,
	    DialogClose
	},
    data: function() {
        return {
            showSpinner: false,
            inviteCount: 1,
            // the server makes at most this many in one request
            maxInvites: 100,
            // the unused ones, as {token, link}
            invites: [],
            invitesLoaded: false,
            invitesError: null
        }
    },
    props: ['data', 'context'],
    computed: {
        // until the list first arrives, a change made here could be overwritten by it
        invitesBusy: function() {
            return this.showSpinner || ! (this.invitesLoaded || this.invitesError != null);
        },
        createLabel: function() {
            const n = this.inviteCount;
            if (! Number.isInteger(n) || n < 1 || n > this.maxInvites)
                return "Create invites";
            return n == 1 ? "Create 1 invite" : "Create " + n + " invites";
        }
    },
    created: function() {
        this.loadInvites();
    },
    methods: {
        showMessage: function(body) {
            this.$toast(body);
        },
        approve: function(req) {
            var that = this;
            this.showSpinner = true;
            this.context.approveSpaceRequest(req)
                .thenApply(function(success) {
		    that.showSpinner = false;
                    that.showMessage("User: " + req.getUsername() + ". Space request approved!");
                    that.$emit("recalc-admin");
                });
        },

        reject: function(req) {
            var that = this;
            this.showSpinner = true;
            this.context.rejectSpaceRequest(req)
                .thenApply(function(success) {
                    that.showMessage("User: " + req.getUsername() + ". Space request rejected!");
                    that.showSpinner = false;
                    that.$emit("recalc-admin");
                });
        },

        /** Invites are signup links to this server's public address, the one secret links use:
         *  a desktop or phone app is served from localhost, which is no use to anyone else. */
        invitesFrom: function(host, tokens) {
            const base = (host.startsWith("localhost:") ? "http://" : "https://") + host + "/?signup=true&token=";
            return tokens.toArray().map(t => ({token: t, link: base + t}));
        },
        // the server's message arrives url encoded
        reasonOf: function(t) {
            let reason = String(t && t.message ? t.message : t);
            try { reason = decodeURIComponent(reason.replace(/\+/g, " ")); } catch (e) {}
            return reason;
        },
        loadInvites: function() {
            const that = this;
            this.context.getLinkHost().thenCompose(function(host) {
                return that.context.listSignupTokens().thenApply(function(tokens) {
                    that.invites = that.invitesFrom(host, tokens);
                    that.invitesLoaded = true;
                    return true;
                });
            }).exceptionally(function(t) {
                that.invitesError = that.reasonOf(t);
                return false;
            });
        },
        step: function(by) {
            const n = Number.isInteger(this.inviteCount) ? this.inviteCount : 1;
            this.inviteCount = Math.min(this.maxInvites, Math.max(1, n + by));
        },
        createInvites: function() {
            // enter in the count field gets here too, past the disabled button
            if (this.invitesBusy)
                return;
            const count = this.inviteCount;
            if (! Number.isInteger(count) || count < 1 || count > this.maxInvites) {
                this.$toast.error("Choose between 1 and " + this.maxInvites + " invites");
                return;
            }
            const that = this;
            this.showSpinner = true;
            this.context.getLinkHost().thenCompose(function(host) {
                return that.context.createSignupTokens(count).thenApply(function(tokens) {
                    const made = that.invitesFrom(host, tokens);
                    const fresh = new Set(made.map(i => i.token));
                    that.invites = made.concat(that.invites.filter(i => ! fresh.has(i.token)));
                    that.showSpinner = false;
                    return true;
                });
            }).exceptionally(function(t) {
                that.showSpinner = false;
                that.$toast.error("Couldn't create invites: " + that.reasonOf(t), {timeout: false});
                return false;
            });
        },
        cancelInvite: function(invite) {
            if (this.invitesBusy)
                return;
            const that = this;
            this.showSpinner = true;
            this.context.revokeSignupToken(invite.token).thenApply(function(removed) {
                that.invites = that.invites.filter(i => i.token != invite.token);
                that.showSpinner = false;
                // nothing to remove means someone signed up with it since the list was loaded
                if (removed)
                    that.$toast("Invite cancelled");
                else
                    that.$toast("That invite had already been used");
                return true;
            }).exceptionally(function(t) {
                that.showSpinner = false;
                that.$toast.error("Couldn't cancel the invite: " + that.reasonOf(t), {timeout: false});
                return false;
            });
        },
        copy: function(text) {
            const that = this;
            navigator.clipboard.writeText(text).then(function() {
                that.$toast("Copied");
            }, function() {
                that.$toast.error("Couldn't copy to the clipboard");
            });
        },
        close: function () {
            this.$emit("hide-admin");
        }
    }
}
</script>
<style>
.admin-panel {
    position: relative;
    width: 600px;
}
/* the panel opens inside .user-settings, whose buttons take a left margin: here the rows space
   them with their gaps */
.pg-dialog.admin-panel button {
    margin-left: 0;
}
.admin-panel__body {
    display: flex;
    flex-direction: column;
    gap: 22px;
    padding-bottom: 20px;
}
.admin-panel__section {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
/* the same small caps the secret link dialog heads its sections with */
.admin-panel__heading {
    margin: 0;
    font-size: 11px;
    font-weight: var(--bold);
    letter-spacing: .07em;
    text-transform: uppercase;
    color: var(--pg-muted);
}
.admin-panel__requests,
.admin-invites__list {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
}
.admin-panel__request {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 0;
    border-bottom: 1px solid var(--border-color);
}
.admin-panel__request:first-child {
    border-top: 1px solid var(--border-color);
}
.admin-panel__who {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-width: 0;
}
.admin-panel__name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
}
.admin-invites__count {
    font-weight: normal;
    letter-spacing: normal;
    text-transform: none;
}
.admin-invites__create {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
}
/* one control, the height of a field: the native arrows are too small to hit on a phone */
.admin-invites__stepper {
    display: inline-flex;
    align-items: stretch;
    height: 44px;
    border: 1px solid var(--pg-track);
    border-radius: var(--radius-field);
    background-color: var(--pg-surface-2);
    overflow: hidden;
}
.admin-invites__stepper:focus-within {
    border-color: var(--green-500);
    box-shadow: 0 0 0 3px var(--pg-tint-ok);
}
.admin-invites__stepper input[type=number] {
    width: 48px;
    min-width: 0;
    height: auto;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    outline: none;
    box-shadow: none;
    background-color: transparent;
    color: var(--color);
    font-family: inherit;
    font-size: 15px;
    font-weight: 600;
    text-align: center;
    -moz-appearance: textfield;
    appearance: textfield;
}
.admin-invites__stepper input::-webkit-outer-spin-button,
.admin-invites__stepper input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
}
.admin-invites__step {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    padding: 0;
    border: 0;
    background-color: transparent;
    color: var(--pg-muted);
    cursor: pointer;
}
.admin-invites__step svg {
    width: 16px;
    height: 16px;
}
.admin-invites__step:not(:disabled):hover {
    background-color: var(--border-color);
    color: var(--color);
}
.admin-invites__step:disabled {
    opacity: .4;
    cursor: default;
}
.admin-invites__submit {
    min-height: 44px;
}
.admin-invites__list {
    gap: 8px;
}
.admin-invites__list li {
    display: flex;
    align-items: center;
    gap: 8px;
}
.admin-invites__list .pg-btn {
    flex: none;
}
/* the remove control the secret link dialog puts beside each member */
.admin-invites__cancel {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background-color: transparent;
    color: var(--pg-muted);
    cursor: pointer;
}
.admin-invites__cancel svg {
    width: 18px;
    height: 18px;
}
.admin-invites__cancel:not(:disabled):hover {
    background-color: var(--pg-surface-2);
    color: var(--color);
}
.admin-invites__cancel:focus-visible,
.admin-invites__step:focus-visible {
    outline: 2px solid var(--green-500);
    outline-offset: -2px;
}
@media (pointer: coarse) {
    .admin-invites__step {
        width: 44px;
    }
}
/* the link gets the room: copy keeps its icon */
@media (max-width: 420px) {
    .admin-invites__copy-text {
        display: none;
    }
    .admin-invites__copy {
        padding: 9px 12px;
    }
}
@media (max-width: 600px) {
    .admin-panel {
        width: 100%;
    }
}
</style>
