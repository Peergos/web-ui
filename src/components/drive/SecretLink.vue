<template>
    <transition name="modal">
        <div class="modal-mask" @click="$emit('hide-modal')">
            <div style="height:30%"></div>
            <div class="modal-container" style="transform: translateY(-30%);" @click.stop>
                <Spinner v-if="showSpinner"></Spinner>
                <div class="modal-header">
                    <h3 id="modal-header-id">{{ title }}</h3>
                </div>
                
                <div class="modal-body">
                    <div class="secret-link-container scrollable"><p style="word-wrap;break-all;">
                            <div>
                                <div class="link-members">
                                    <h4 style="margin-bottom: 4px;">{{ translate("DRIVE.LINK.MEMBERS") }}</h4>
                                    <div v-for="(m, i) in members" :key="m.path" class="link-member">
                                        <span class="link-member__path" :title="m.path">{{ m.path }}</span>
                                        <label class="checkbox__group link-member__writable" :title="m.writableReason">
                                            {{ translate("DRIVE.LINK.WRITABLE") }}
                                            <input type="checkbox" :disabled="!m.canBeWritable" v-model="m.writable" @change="onChange()"/>
                                            <span class="checkmark"></span>
                                        </label>
                                        <button class="fa fa-times link-member__remove"
                                                :disabled="members.length < 2"
                                                :title="translate('DRIVE.LINK.MEMBER.REMOVE.HINT')"
                                                @click="removeMember(i)"></button>
                                    </div>
                                    <div style="margin: 6px 0;">
                                        <button class="btn btn-success" :disabled="members.length >= maxMembers" @click="showPicker = true">
                                            {{ translate("DRIVE.LINK.MEMBER.ADD") }}
                                        </button>
                                        <span v-if="members.length >= maxMembers - 10" style="margin-left: 8px; font-size: 0.9em;">
                                            {{ members.length }} / {{ maxMembers }}
                                        </span>
                                    </div>
                                    <p v-if="currentProps != null" class="link-members__note">
                                        {{ translate("DRIVE.LINK.MEMBERS.SAME.URL") }}
                                    </p>
                                    <p v-if="spansDirectories" class="link-members__note">
                                        {{ translate("DRIVE.LINK.MEMBERS.PATHS.VISIBLE") }}
                                    </p>
                                </div>
                                <div v-if="members.length > 1">
                                    <label style="font-weight: normal;">{{ translate("DRIVE.LINK.OPENS.WITH") }}</label>
                                    <select v-model="openSelector" @change="onChange()"
                                            style="border: 2px solid var(--green-500); color: var(--color); background-color: var(--bg);">
                                        <option value="">{{ translate("DRIVE.LINK.OPENS.NOTHING") }}</option>
                                        <option v-for="m in members" :key="m.path" :value="m.selector">{{ m.path }}</option>
                                    </select>
                                </div>
                                <div v-if="link.isFile && members.length < 2">
                                    <label class="checkbox__group">
                                        {{ translate("DRIVE.LINK.OPEN") }}
                                        <input
                                            type="checkbox"
                                            name=""
                                            v-model="autoOpen"
                                            @change="onChange()"
                                        />
                                        <span class="checkmark"></span>
                                    </label>
                                </div>
                                <div>
                                    <span>
                                        <label class="checkbox__group" style="display:inline-block">
                                            {{ translate("DRIVE.LINK.EXPIRE.ON") }}
                                            <input
                                                type="checkbox"
                                                name=""
                                                v-model="hasExpiry"
                                                @change="onChange()"
                                            />
                                            <span class="checkmark"></span>
                                        </label>
                                        <input style="border: 2px solid var(--green-500);color: var(--color); background-color: var(--bg);" id="expiry-date-picker" :disabled="!hasExpiry" type="date" @change="onChange(link.id)">
                                        <label style="font-weight: normal;">{{ translate("DRIVE.LINK.AT.TIME") }}</label>
                                        <input style="border: 2px solid var(--green-500);color: var(--color); background-color: var(--bg);" id="expiry-time-picker" :disabled="!hasExpiry" type="time" @change="onChange(link.id)">
                                    </span>
                                </div>
                                <div>
                                    <span>
                                        <label class="checkbox__group" style="display:inline-block">
                                            {{ translate("DRIVE.LINK.LIMIT.RETRIEVALS") }}
                                            <input
                                                type="checkbox"
                                                name=""
                                                v-model="hasMaxRetrievals"
                                                @change="onChange()"
                                            />
                                            <span class="checkmark"></span>
                                        </label>
                                        <input style="border: 2px solid var(--green-500);color: var(--color); background-color: var(--bg);" @change="onChange()" :disabled="!hasMaxRetrievals" v-model="maxRetrievals" type="number" min="1" max="999">
                                    </span>
                                </div>
                                <div>
                                    <span>
                                        <label class="checkbox__group" style="display:inline-block">
                                            {{ translate("DRIVE.LINK.PASSWORD") }}
                                            <input
                                                type="checkbox"
                                                name=""
                                                v-model="hasPassword"
                                            />
                                            <span class="checkmark"></span>
                                        </label>
                                        <input style="all: revert; border: 2px solid var(--green-500);color: var(--color); background-color: var(--bg); font-family: inherit; font-size: inherit; line-height: inherit;" :disabled="!hasPassword" type="text" size="15" v-model="userPassword">
                                    </span>
                                </div>
                                <div style="padding: 10px;">
                                    <button
                                        id='modal-button-id'
                                        class="btn btn-success"
                                        @click="createOrUpdateLink">
                                        {{ currentProps == null ? translate("DRIVE.LINK.CREATE") : translate("DRIVE.LINK.UPDATE") }}
                                    </button>
                                </div>
                                <div v-if="showLink()" style="padding: 10px;">
                                    <input type="text" v-bind:value="this.href" style="display: none">
                                    <button class="fa fa-clipboard" style="padding: 6px 12px; background-color:var(--bg);" @click="copyUrlToClipboard($event)">&nbsp;{{ translate("DRIVE.LINK.COPY") }}</button>
                                    <button class="fa fa-envelope" style="padding: 6px 12px; background-color:var(--bg);" @click="email($event)">&nbsp;{{ translate("DRIVE.LINK.EMAIL") }}</button>
                                    <img
                                        style="width: 150px;"
                                        v-if="base64QrCode"
                                        :src="base64QrCode"
                                        alt="qr-code"
                                    />
                                </div>
                        </div>
                    </div>
                </div>
                
                <div class="modal-footer">
                    <slot name="footer">
                        <button
                            id='modal-button-id'
                            class="btn btn-success"
                            @click="$emit('hide-modal')">
                            {{ translate("DRIVE.LINK.OK") }}
                        </button>
                    </slot>
                </div>
            </div>
        </div>
        <FilePicker
            v-if="showPicker"
            :baseFolder="'/' + username"
            :pickerAllowWriteMode="true"
            :pickerSelectFolders="true"
            :selectedFile_func="addMember"
        />
    </transition>
</template>

<script>
const Spinner = require("../spinner/Spinner.vue");
const FilePicker = require("../picker/FilePicker.vue");
const i18n = require("../../i18n/index.js");
module.exports = {
    components:{
        Spinner,
        FilePicker
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
                openSelector: "",
                showPicker: false,
                maxMembers: 100,
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
    },
    mixins:[i18n],
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
            this.openSelector = this.currentProps == null ? "" : this.currentProps.getOpenSelector();
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
                        let dateExpiry = document.getElementById("expiry-date-picker");
                        dateExpiry.value = datePart;
                        let timeExpiry = document.getElementById("expiry-time-picker");
                        timeExpiry.value = timePart;
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
                        path: m.getPath(), writable: m.isWritable(), selector: m.getSelector(),
                        canBeWritable: true, writableReason: ""
                    }));
                }
                return [{
                    path: this.getLinkPath(),
                    writable: this.currentProps != null && this.currentProps.isLinkWritable,
                    selector: null,
                    canBeWritable: true,
                    writableReason: "",
                }];
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
                this.members.push({path: path, writable: openForEditing === true, selector: null,
                                   canBeWritable: true, writableReason: ""});
                this.onChange();
            },
            removeMember: function(i) {
                // removing is not revoking: anyone who already opened the link keeps that
                // capability, and only rotating the item's keys takes it back
                if (! confirm(this.translate("DRIVE.LINK.MEMBER.REMOVE.CONFIRM").replace("%s", this.members[i].path)))
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
                if (this.members.length > 1) {
                    // a link with several items opens one of them by name, or none at all, and
                    // either way the others stay reachable
                    if (this.openSelector != "")
                        args = "?open=" + encodeURIComponent(this.openSelector);
                } else if (autoOpenOverride || this.autoOpen) {
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
                          that.members = that.initialMembers();
                          that.updateHref();
                          that.showSpinner = false;
                    }).exceptionally(t => {
                        console.log(t);
                        that.$toast.error(that.linkError(t, "DRIVE.LINK.ERROR.CREATE"), {timeout:false});
                        that.showSpinner = false;
                    });
                } else {
                    let newLinkProps = this.currentProps.with(this.hasPassword ? this.userPassword : "", maxRetrievalsStr, this.getExpiry(), this.autoOpen)
                        .withAutoOpenMember(this.openSelector);
                    this.context.setSecretLinkMembers(this.memberPaths(), this.writableMemberPaths(), newLinkProps).thenApply(props => {
                        that.currentProps = props;
                        that.members = that.initialMembers();
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
                let dateExpiry = document.getElementById("expiry-date-picker");
                let dateS = dateExpiry.value;
                if (! this.hasExpiry || dateS == "")
                    return java.util.Optional.empty();
                let timeExpiry = document.getElementById("expiry-time-picker");
                let expireTimeString = "00:00";
                if (timeExpiry != null && timeExpiry.value.length > 0) {
                    expireTimeString = timeExpiry.value;
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
            copyUrlToClipboard: function (clickEvent) {
                var text = clickEvent.srcElement.previousElementSibling.value.toString();
                navigator.clipboard.writeText(text).then(function() {}, function() {
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
.modal-body {
    margin: 0px 0;
}
.scrollable
{
    max-height: 450px;
    overflow-y: scroll;
}
.link-member {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 2px 0;
}
.link-member__path {
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    direction: rtl;
    text-align: left;
}
.link-member__writable {
    flex: 0 0 auto;
    margin: 0;
}
.link-member__remove {
    flex: 0 0 auto;
    background-color: var(--bg);
    padding: 4px 8px;
}
.link-members__note {
    font-size: 0.9em;
    opacity: 0.8;
    margin: 4px 0;
}
.secret-link-container{
    padding-right:15px;
    padding-left:15px;
    margin-right:auto;
    margin-left:auto}
</style>