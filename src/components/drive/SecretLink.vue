<template>
    <transition name="modal">
        <div class="pg-dialog__mask" @click="$emit('hide-modal')">
            <div class="pg-dialog secret-link" role="dialog" aria-modal="true" aria-labelledby="secret-link-title" tabindex="-1" @click.stop>
                <header class="pg-dialog__head">
                    <h2 class="pg-dialog__title" id="secret-link-title">{{ title }}</h2>
                    <DialogClose @close="$emit('hide-modal')"/>
                </header>

                <div class="pg-dialog__body secret-link__body">
                    <template v-if="showLink()">
                        <div v-if="justCreated" class="secret-link__done" role="status">
                            <span class="secret-link__done-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                            </span>
                            {{ translate("DRIVE.LINK.CREATED") }}
                        </div>
                        <div class="secret-link__field">
                            <label for="secret-link-url" class="secret-link__label">{{ translate("DRIVE.LINK.URL") }}</label>
                            <div class="secret-link__copy">
                                <input id="secret-link-url" class="pg-input" type="text" readonly :value="href" @focus="$event.target.select()">
                                <button type="button" class="pg-btn pg-btn--primary" @click="copyUrlToClipboard()">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>
                                    {{ translate("DRIVE.LINK.COPY.BUTTON") }}
                                </button>
                            </div>
                        </div>
                        <div class="secret-link__share">
                            <img v-if="base64QrCode" class="secret-link__qr" :src="base64QrCode" :alt="translate('DRIVE.LINK.QR')"/>
                            <div class="secret-link__share-text">
                                <p class="pg-note">{{ translate("DRIVE.LINK.QR.HINT") }}</p>
                                <button type="button" class="pg-btn" @click="email()">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
                                    {{ translate("DRIVE.LINK.EMAIL") }}
                                </button>
                            </div>
                        </div>
                    </template>

                    <section class="link-members secret-link__section">
                        <h3 class="secret-link__heading">{{ translate("DRIVE.LINK.MEMBERS") }}</h3>
                        <ul class="secret-link__members">
                            <li v-for="(m, i) in members" :key="m.path" class="link-member">
                                <span class="link-member__path" :title="m.path">
                                    <span class="link-member__name">{{ pathLeaf(m.path) }}</span>
                                    <span class="link-member__dir">{{ memberFolder(m.path) }}</span>
                                </span>
                                <label class="pg-switch link-member__writable" :title="m.writableReason">
                                    <input type="checkbox" :disabled="!m.canBeWritable" v-model="m.writable" @change="onChange()"/>
                                    <span class="pg-switch__track" aria-hidden="true"></span>
                                    <span>{{ translate("DRIVE.LINK.CAN.EDIT") }}</span>
                                </label>
                                <button type="button" class="link-member__remove"
                                        :disabled="members.length < 2"
                                        :title="translate('DRIVE.LINK.MEMBER.REMOVE.HINT')"
                                        :aria-label="translate('DRIVE.LINK.MEMBER.REMOVE.HINT')"
                                        @click="removeMember(i)">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
                                </button>
                            </li>
                        </ul>
                        <p v-if="anyWritable" class="pg-callout">{{ translate("DRIVE.LINK.WRITABLE.WARN") }}</p>
                        <div class="secret-link__add">
                            <button type="button" class="pg-btn link-members__add" :disabled="members.length >= maxMembers" @click="showPicker = true">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
                                {{ translate("DRIVE.LINK.MEMBER.ADD") }}
                            </button>
                            <span v-if="members.length >= maxMembers - 10" class="pg-note">
                                {{ members.length }} / {{ maxMembers }}
                            </span>
                        </div>
                        <p v-if="currentProps != null" class="pg-note">{{ translate("DRIVE.LINK.MEMBERS.SAME.URL") }}</p>
                        <p v-if="spansDirectories" class="pg-note">{{ translate("DRIVE.LINK.MEMBERS.PATHS.VISIBLE") }}</p>
                    </section>

                    <section class="secret-link__section secret-link__options">
                        <h3 class="secret-link__heading">{{ translate("DRIVE.LINK.OPTIONS") }}</h3>
                        <label v-if="link.isFile || members.length > 1" class="pg-switch">
                            <input type="checkbox" v-model="autoOpen" @change="onChange()"/>
                            <span class="pg-switch__track" aria-hidden="true"></span>
                            <span>{{ translate("DRIVE.LINK.OPEN") }}</span>
                        </label>

                        <label class="pg-switch">
                            <input type="checkbox" v-model="hasExpiry" @change="onChange()"/>
                            <span class="pg-switch__track" aria-hidden="true"></span>
                            <span>{{ translate("DRIVE.LINK.EXPIRE.ON") }}</span>
                        </label>
                        <div v-if="hasExpiry" class="secret-link__reveal">
                            <div class="secret-link__field">
                                <label for="expiry-date-picker" class="secret-link__label">{{ translate("DRIVE.LINK.DATE") }}</label>
                                <input id="expiry-date-picker" class="pg-input" type="date" v-model="expireDateString" @change="onChange()">
                            </div>
                            <div class="secret-link__field secret-link__field--narrow">
                                <label for="expiry-time-picker" class="secret-link__label">{{ translate("DRIVE.LINK.TIME") }}</label>
                                <input id="expiry-time-picker" class="pg-input" type="time" v-model="expireTimeString" @change="onChange()">
                            </div>
                        </div>

                        <label class="pg-switch">
                            <input type="checkbox" v-model="hasMaxRetrievals" @change="onChange()"/>
                            <span class="pg-switch__track" aria-hidden="true"></span>
                            <span>{{ translate("DRIVE.LINK.LIMIT.RETRIEVALS") }}</span>
                        </label>
                        <div v-if="hasMaxRetrievals" class="secret-link__reveal">
                            <div class="secret-link__field secret-link__field--narrow">
                                <label for="secret-link-uses" class="secret-link__label">{{ translate("DRIVE.LINK.USES") }}</label>
                                <input id="secret-link-uses" class="pg-input" type="number" min="1" max="999" v-model="maxRetrievals" @change="onChange()">
                            </div>
                        </div>

                        <label class="pg-switch">
                            <input type="checkbox" v-model="hasPassword"/>
                            <span class="pg-switch__track" aria-hidden="true"></span>
                            <span>{{ translate("DRIVE.LINK.PASSWORD") }}</span>
                        </label>
                        <div v-if="hasPassword" class="secret-link__reveal">
                            <div class="secret-link__field">
                                <label for="secret-link-password" class="secret-link__label">{{ translate("DRIVE.LINK.PASSWORD.FIELD") }}</label>
                                <div class="secret-link__copy">
                                    <input id="secret-link-password" class="pg-input" :type="showPassword ? 'text' : 'password'"
                                           autocomplete="new-password" v-model="userPassword">
                                    <button type="button" class="pg-btn" @click="showPassword = ! showPassword">
                                        {{ showPassword ? translate("DRIVE.LINK.HIDE") : translate("DRIVE.LINK.SHOW") }}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                </div>

                <footer class="pg-dialog__foot">
                    <div class="pg-dialog__actions">
                        <span class="pg-dialog__spacer"></span>
                        <template v-if="currentProps == null">
                            <button type="button" class="pg-btn" @click="$emit('hide-modal')">{{ translate("PROMPT.CANCEL") }}</button>
                            <button type="button" id="modal-button-id" class="pg-btn pg-btn--primary" :disabled="showSpinner" @click="createOrUpdateLink">
                                {{ translate("DRIVE.LINK.CREATE") }}
                            </button>
                        </template>
                        <template v-else>
                            <button type="button" id="modal-button-id" class="pg-btn" :disabled="showSpinner" @click="createOrUpdateLink">
                                {{ translate("DRIVE.LINK.UPDATE") }}
                            </button>
                            <button type="button" class="pg-btn pg-btn--primary" @click="$emit('hide-modal')">{{ translate("DRIVE.LINK.OK") }}</button>
                        </template>
                    </div>
                </footer>
                <div v-if="showSpinner" class="pg-dialog__loading"><Spinner/></div>

                <FilePicker
                    v-if="showPicker"
                    :baseFolder="'/' + username"
                    :pickerTitle="translate('DRIVE.LINK.MEMBER.ADD')"
                    :pickerAllowWriteMode="true"
                    :pickerSelectFolders="true"
                    :selectedFile_func="addMember"
                />
                <Confirm
                    v-if="showRemoveConfirm"
                    :confirm_message="removeConfirm.message"
                    :confirm_body="removeConfirm.body"
                    :consumer_cancel_func="keepMember"
                    :consumer_func="confirmRemoveMember"
                    @hide-confirm="showRemoveConfirm = false"
                />
            </div>
        </div>
    </transition>
</template>

<script>
const Spinner = require("../spinner/Spinner.vue");
const FilePicker = require("../picker/FilePicker.vue");
const Confirm = require("../confirm/Confirm.vue");
const DialogClose = require("../dialog/DialogClose.vue");
const i18n = require("../../i18n/index.js");
const paths = require("../../mixins/paths/index.js");
module.exports = {
    components:{
        Spinner,
        FilePicker,
        Confirm,
        DialogClose
    },
	data() {
	    return {
                isLinkWritable: false,
                hasExpiry: false,
                expireDateString: "",
                expireTimeString: "",
                hasMaxRetrievals: false,
                maxRetrievals: "0",
                hasPassword: false,
                userPassword: "",
                showSpinner: false,
                autoOpen: false,
                currentProps: null,
                baseUrl:null,
                href:null,
                base64QrCode: "",
                members: [],
                showPicker: false,
                maxMembers: 100,
                showPassword: false,
                // only a link made in this dialog gets the banner; one opened to edit has nothing new to announce
                justCreated: false,
                // Confirm hides itself before it calls back, so whether it is up and which member it
                // asks about are kept apart: clearing the member on hide lost it before Yes landed
                showRemoveConfirm: false,
                removeIndex: null,
            };
	},
    computed: {
        ...Vuex.mapState([
            'context',
        ]),
        // every member's full path is visible to whoever opens the link, including the
        // directories above it, which is easy to forget when the items are scattered
        spansDirectories: function() {
            let dirs = new Set(this.members.map(m => m.path.substring(0, m.path.lastIndexOf('/'))));
            return dirs.size > 1;
        },
        anyWritable: function() {
            return this.members.some(m => m.writable);
        },
        /** the confirmation's first paragraph is the question, the rest is why it matters */
        removeConfirm: function() {
            if (this.removeIndex == null || this.members[this.removeIndex] == null)
                return {message: "", body: ""};
            let parts = this.translate("DRIVE.LINK.MEMBER.REMOVE.CONFIRM")
                .replace("%s", this.members[this.removeIndex].path).split("\n\n");
            return {message: parts[0], body: parts.slice(1).join(" ")};
        },
    },
    mixins:[i18n, paths],
	props: [
	    "title",
	    "link",
            "username",
            "existingProps",
            "host"
        ],
        created: function() {
            let that = this;
            this.currentProps = this.existingProps;
            this.autoOpen = this.link.autoOpen || (this.currentProps != null && this.currentProps.autoOpen());
            this.members = this.initialMembers();
            this.refreshMembersFromLink();
            if (this.currentProps != null) {
                Vue.nextTick(function() {
                    that.isLinkWritable = that.currentProps.isLinkWritable;
                    that.userPassword = that.currentProps.userPassword
                    that.hasPassword = that.currentProps.userPassword.length > 0;
                    that.maxRetrievals = that.currentProps.maxRetrievals.ref == null ?
                            "0": that.currentProps.maxRetrievals.ref.toString();
                    that.hasMaxRetrievals = that.maxRetrievals != "0";
                    if (that.currentProps.expiry.ref != null) {
                        that.hasExpiry = true;
                        let date = that.currentProps.expiry.ref.date;
                        let time = that.currentProps.expiry.ref.time;
                        let jsDate = new Date(that.currentProps.expiry.ref.toString() + "+00:00"); //adding UTC TZ in ISO_OFFSET_DATE_TIME ie 2021-12-03T10:25:30+00:00
                        let datePart = jsDate.getFullYear()
                        + '-' + ( (jsDate.getMonth() + 1) < 10 ? '0' : '') + (jsDate.getMonth() + 1)
                        + '-' + (jsDate.getDate() < 10 ? '0' : '') + jsDate.getDate();
                        let timePart =  (jsDate.getHours() < 10 ? '0' : '') + jsDate.getHours()
                                        + ':' + (jsDate.getMinutes() < 10 ? '0' : '') + jsDate.getMinutes();
                        that.expireDateString = datePart;
                        that.expireTimeString = timePart;
                    }
                    that.updateHref();
                });
            }
        },
        methods: {
            /**
             * A link that already exists knows its own members; a new one starts with the file
             * the modal was opened from.
             */
            initialMembers: function() {
                if (this.currentProps != null && this.currentProps.memberCount() > 0) {
                    // a gwt List is not indexable from js; toArray is how the rest of the app reads one
                    return this.currentProps.getMembers().toArray().map(m => ({
                        path: m.getPath(), writable: m.isWritable(), canBeWritable: true, writableReason: ""
                    }));
                }
                if (this.link.paths != null)
                    return this.link.paths.map(p => ({path: p, writable: false, canBeWritable: true, writableReason: ""}));
                return [{
                    path: this.getLinkPath(),
                    writable: this.currentProps != null && this.currentProps.isLinkWritable,
                    canBeWritable: true,
                    writableReason: "",
                }];
            },
            /**
             * The recorded paths are only what they were when the link was last written; the
             * payload is what it actually holds. Read them from there so a renamed or moved item
             * shows where it is now - and so saving does not fail resolving a path that moved.
             */
            refreshMembersFromLink: function() {
                if (this.currentProps == null)
                    return;
                let that = this;
                this.context.getSecretLinkMembers(this.currentProps).thenApply(members => {
                    that.members = members.toArray().map(m => ({
                        path: m.getPath(), writable: m.isWritable(), canBeWritable: true, writableReason: ""
                    }));
                    return true;
                }).exceptionally(t => { console.log(t); return null; });
            },
            addMember: function(path, openForEditing) {
                this.showPicker = false;
                if (path == null)
                    return;
                if (this.members.some(m => m.path == path)) {
                    this.$toast.error(this.translate("DRIVE.LINK.MEMBER.DUPLICATE"));
                    return;
                }
                if (this.members.length >= this.maxMembers) {
                    this.$toast.error(this.translate("DRIVE.LINK.MEMBER.TOO.MANY"));
                    return;
                }
                this.members.push({path: path, writable: openForEditing === true,
                                   canBeWritable: true, writableReason: ""});
                this.onChange();
            },
            removeMember: function(i) {
                // removing is not revoking: anyone who already opened the link keeps that
                // capability, and only rotating the item's keys takes it back
                this.removeIndex = i;
                this.showRemoveConfirm = true;
            },
            /** marked left to right, or the rtl that ellipsises its start moves the leading slash to the end */
            memberFolder: function(path) {
                return "\u200e" + this.pathHead(path) + "\u200e";
            },
            keepMember: function() {
                this.removeIndex = null;
            },
            confirmRemoveMember: function() {
                let i = this.removeIndex;
                this.removeIndex = null;
                if (i == null || i >= this.members.length)
                    return;
                this.members.splice(i, 1);
                this.onChange();
            },
            memberPaths: function() {
                return peergos.client.JsUtil.asList(this.members.map(m => m.path));
            },
            writableMemberPaths: function() {
                return peergos.client.JsUtil.asList(this.members.filter(m => m.writable).map(m => m.path));
            },
            buildHref: function (link, autoOpenOverride) {
                let args = "";
                if (autoOpenOverride || this.autoOpen) {
                    args = "?open=true";
                    if (link.shareFolderWithFile) {
                        args += "&path=" + link.path;
                        args += "&args=%7B%22filename%22:%22" + link.filename + "%22%7D";
                    } 
                }
                let href = (this.host.startsWith("localhost:") ? "http://" : "https://") + this.host + "/" + this.baseUrl + args;
                let secretLinkQrCode = peergos.shared.SecretLinkQRCode.generate(href);
                this.base64QrCode = secretLinkQrCode.getBase64Thumbnail();
                return href;
            },
            showLink: function() {
                return this.currentProps != null;
            },
            createOrUpdateLink: function() {
                let create = this.currentProps == null;
                let that = this;
                this.showSpinner = true;
                let maxRetrievalsStr = this.maxRetrievals == "0" ? "" : "" + this.maxRetrievals;
                if (create) {
                    this.context.createSecretLinkTo(this.memberPaths(), this.writableMemberPaths(), this.getExpiry(),
                        maxRetrievalsStr, this.hasPassword ? this.userPassword : "", this.autoOpen).thenApply(props => {
                          that.currentProps = props;
                          that.justCreated = true;
                          that.members = that.initialMembers();
                          that.refreshMembersFromLink();
                          that.updateHref();
                          that.showSpinner = false;
                    }).exceptionally(t => {
                        console.log(t);
                        that.$toast.error(that.linkError(t, "DRIVE.LINK.ERROR.CREATE"), {timeout:false});
                        that.showSpinner = false;
                    });
                } else {
                    let newLinkProps = this.currentProps.with(this.hasPassword ? this.userPassword : "", maxRetrievalsStr, this.getExpiry(), this.autoOpen);
                    this.context.setSecretLinkMembers(this.memberPaths(), this.writableMemberPaths(), newLinkProps).thenApply(props => {
                        that.currentProps = props;
                        that.members = that.initialMembers();
                        that.refreshMembersFromLink();
                        that.updateHref();
                        that.showSpinner = false;
                    }).exceptionally(t => {
                        console.log(t);
                        that.$toast.error(that.linkError(t, "DRIVE.LINK.ERROR.UPDATE"), {timeout:false});
                        that.showSpinner = false;
                    });
                }
            },
            /**
             * The server side refusals here are things the user can act on - someone else's file,
             * too many items, a file that cannot be made writable - so show what it said rather
             * than a generic failure.
             */
            linkError: function(t, fallbackKey) {
                let msg = t == null ? null : ("" + (t.message || t));
                if (msg != null && (msg.indexOf("your own files") >= 0 || msg.indexOf("at most") >= 0
                        || msg.indexOf("writing space") >= 0 || msg.indexOf("too large") >= 0))
                    return msg.substring(msg.lastIndexOf(":") + 1).trim();
                return this.translate(fallbackKey);
            },
            getExpiry: function() {
                let dateS = this.expireDateString;
                if (! this.hasExpiry || dateS == null || dateS == "")
                    return java.util.Optional.empty();
                let expireTimeString = "00:00";
                if (this.expireTimeString != null && this.expireTimeString.length > 0) {
                    expireTimeString = this.expireTimeString;
                }
                let year = parseInt(dateS.split("-")[0]);
                let month = parseInt(dateS.split("-")[1]);
                let day = parseInt(dateS.split("-")[2]);
                let hour = parseInt(expireTimeString.split(":")[0]);
                let minute = parseInt(expireTimeString.split(":")[1]);
                let jsDate = new Date(year, month-1, day, hour, minute);
                let ldt = peergos.client.JsUtil.fromUtcMillis(jsDate.getTime());
                return java.util.Optional.of(ldt);
            },
            updateHref: function() {
                let that = this;
                let linkString = that.context.getLinkString(that.currentProps);
                this.baseUrl = linkString;
                let href = that.buildHref(this.link);
                this.href = href;
            },
            getLinkPath: function() {
                var path = this.link.path;
                if (this.link.shareFolderWithFile)
                    return path;
                if (! path.endsWith("/"))
                    path = path+"/";
                return path + this.link.filename;
            },
            onChange: function () {
                this.href = this.buildHref(this.link);
            },
            copyUrlToClipboard: function () {
                let that = this;
                navigator.clipboard.writeText(this.href).then(function() {
                    that.$toast.success(that.translate("DRIVE.LINK.COPIED"));
                }, function() {
                    console.error("Unable to write to clipboard.");
                });
            },
            email: function() {
                var that = this;
                var body = "";
                var type;
                let href = that.buildHref(this.link, true);
                body += this.link.name + ": " + href + "\n";
                if (this.link.isFile)
                    type = "file";
                else
                    type = "folder";
                body = "Click on the following link to view the " + type + "\n\n" + body;
                var subject = this.username + " shared a "+type+" with you!";
                var link = document.getElementById('downloadAnchor')
                link.href = "mailto:?body="+encodeURIComponent(body)+"&subject="+encodeURIComponent(subject);
                link.click()
            },
        }
    }
</script>
<style>
/* unscoped, and every other modal's body has come to rely on it: kept as it was */
.modal-body {
    margin: 0px 0;
}
.secret-link {
    position: relative;
    width: 560px;
}
.secret-link__body {
    display: flex;
    flex-direction: column;
    gap: 22px;
    padding-bottom: 16px;
}
.secret-link__section {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 0;
}
.secret-link__options {
    gap: 12px;
}
/* the same small caps the sync and mount cards label their endpoints with */
.secret-link__heading {
    margin: 0;
    font-size: 11px;
    font-weight: var(--bold);
    letter-spacing: .07em;
    text-transform: uppercase;
    color: var(--pg-muted);
}
.secret-link__members {
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
    border: 1px solid var(--border-color);
    border-radius: 12px;
}
.link-member {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 4px 10px 14px;
}
.link-member + .link-member {
    border-top: 1px solid var(--pg-track);
}
.link-member__path {
    display: flex;
    flex-direction: column;
    flex: 1 1 0;
    min-width: 0;
    gap: 2px;
}
.link-member__name,
.link-member__dir {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.link-member__name {
    font-size: 15px;
    font-weight: var(--bold);
}
/* the start of a deep path is the least telling part, so that is where it gives way */
.link-member__dir {
    direction: rtl;
    text-align: left;
    font-size: 13px;
    color: var(--pg-muted);
}
.link-member__writable {
    flex: none;
}
.link-member__remove {
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
.link-member__remove svg {
    width: 18px;
    height: 18px;
}
.link-member__remove:not(:disabled):hover {
    background-color: var(--pg-surface-2);
    color: var(--color);
}
.link-member__remove:focus-visible {
    outline: 2px solid var(--green-500);
    outline-offset: 2px;
}
.link-member__remove:disabled {
    opacity: .35;
    cursor: default;
}
.secret-link__add {
    display: flex;
    align-items: center;
    gap: 10px;
}
.secret-link .pg-callout {
    margin: 0;
}
/* what a switch turns on sits under it, indented so it reads as belonging to it */
.secret-link__reveal {
    display: flex;
    gap: 10px;
    padding-left: 12px;
}
.secret-link__field {
    display: flex;
    flex-direction: column;
    flex: 1 1 0;
    min-width: 0;
    gap: 6px;
}
.secret-link__field--narrow {
    flex: 0 0 130px;
}
.secret-link__label {
    margin: 0;
    font-size: 13px;
    font-weight: 500;
    color: var(--pg-muted);
}
.secret-link__copy {
    display: flex;
    gap: 8px;
}
.secret-link__copy .pg-btn {
    flex: none;
}
.secret-link__done {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    font-weight: var(--bold);
    color: var(--pg-on-ok);
    background-color: var(--pg-tint-ok);
    border-radius: 12px;
}
.secret-link__done-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    color: #ffffff;
    background-color: var(--pg-disc-ok);
}
.secret-link__done-icon svg {
    width: 18px;
    height: 18px;
}
.secret-link__share {
    display: flex;
    align-items: center;
    gap: 16px;
}
/* the code is drawn dark on light, and a scanner needs that contrast in either theme */
.secret-link__qr {
    flex: none;
    width: 152px;
    height: 152px;
    padding: 6px;
    background-color: #ffffff;
    border-radius: 10px;
}
.secret-link__share-text {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    min-width: 0;
}
@media (max-width: 600px) {
    .secret-link {
        width: 100%;
    }
    /* no room for the switch beside the name: it drops under it */
    .link-member {
        flex-wrap: wrap;
        row-gap: 8px;
    }
    .link-member__path {
        flex-basis: calc(100% - 56px);
    }
    .link-member__remove {
        order: 2;
    }
    .link-member__writable {
        order: 3;
    }
}
</style>
