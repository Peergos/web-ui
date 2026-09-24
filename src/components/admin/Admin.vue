<template>
<transition name="modal">
<div class="pg-dialog__mask" @click="closeFromMask">
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
                <h3 class="admin-panel__heading">Signup invites</h3>
                <p class="pg-note">Each link lets one new user sign up, even while this server is not accepting signups.</p>
                <div class="admin-invites__create">
                    <label for="admin-invite-count" class="admin-panel__label">How many</label>
                    <input id="admin-invite-count" class="pg-input" type="number" min="1" :max="maxInvites" v-model.number="inviteCount" @keyup.enter="createInvites()">
                    <button type="button" class="pg-btn pg-btn--primary" :disabled="showSpinner" @click="createInvites()">Create invites</button>
                </div>
                <template v-if="invites.length > 0">
                    <ul class="admin-invites__list">
                        <li v-for="link in invites" :key="link">
                            <input type="text" class="pg-input" readonly :value="link" aria-label="Invite link" @focus="$event.target.select()">
                            <button type="button" class="pg-btn" @click="copy(link)">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
                                Copy
                            </button>
                        </li>
                    </ul>
                    <p class="pg-callout">Copy them now: they are not shown again once this panel is closed.</p>
                    <div v-if="invites.length > 1" class="pg-dialog__actions">
                        <span class="pg-dialog__spacer"></span>
                        <button type="button" class="pg-btn" @click="copy(invites.join('\n'))">Copy all</button>
                    </div>
                </template>
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
            invites: []
        }
    },
    props: ['data', 'context'],
    created: function() {
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
        createInvites: function() {
            // enter in the count field gets here too, past the disabled button
            if (this.showSpinner)
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
                    const base = (host.startsWith("localhost:") ? "http://" : "https://") + host + "/?signup=true&token=";
                    that.invites = that.invites.concat(tokens.toArray().map(t => base + t));
                    that.showSpinner = false;
                    return true;
                });
            }).exceptionally(function(t) {
                that.showSpinner = false;
                // the server's message arrives url encoded
                let reason = String(t && t.message ? t.message : t);
                try { reason = decodeURIComponent(reason.replace(/\+/g, " ")); } catch (e) {}
                that.$toast.error("Couldn't create invites: " + reason, {timeout: false});
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
        /** Invites that have not been copied are gone once the panel closes, and the tokens behind
         *  them are already made: a stray tap beside the dialog should not be what loses them. */
        closeFromMask: function() {
            if (this.invites.length == 0)
                this.close();
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
.admin-panel__label {
    margin: 0;
    font-size: 13px;
    font-weight: 500;
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
.admin-invites__create {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
}
/* three digits at most: narrow enough that the button stays beside it on a phone */
.admin-invites__create input.pg-input {
    width: 72px;
}
.admin-invites__list {
    gap: 8px;
}
.admin-invites__list li {
    display: flex;
    gap: 8px;
}
.admin-invites__list .pg-btn {
    flex: none;
}
@media (max-width: 600px) {
    .admin-panel {
        width: 100%;
    }
}
</style>
