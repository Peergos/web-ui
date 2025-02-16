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
                                <div v-if="link.isFile">
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
                                    <label class="checkbox__group">
                                        {{ translate("DRIVE.LINK.WRITABLE") }}
                                        <input
                                            :disabled="currentProps != null"
                                            type="checkbox"
                                            name=""
                                            v-model="isLinkWritable"
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
    </transition>
</template>

<script>
const Spinner = require("../spinner/Spinner.vue");
const i18n = require("../../i18n/index.js");
module.exports = {
    components:{
        Spinner
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
            };
	},
    computed: {
        ...Vuex.mapState([
            'context',
        ]),
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
                    this.context.createSecretLink(this.getLinkPath(), this.isLinkWritable, this.getExpiry(),
                        maxRetrievalsStr, this.hasPassword ? this.userPassword : "", this.autoOpen).thenApply(props => {
                          that.currentProps = props;
                          that.updateHref();
                          that.showSpinner = false;
                    }).exceptionally(t => {
                        console.log(t);
                        that.$toast.error(that.translate("DRIVE.LINK.ERROR.CREATE"), {timeout:false});
                        that.showSpinner = false;
                    });
                } else {
                    let newLinkProps = this.currentProps.with(this.hasPassword ? this.userPassword : "", maxRetrievalsStr, this.getExpiry(), this.autoOpen);
                    this.context.updateSecretLink(this.getLinkPath(), newLinkProps).thenApply(props => {
                        that.currentProps = props;
                        that.updateHref();
                        that.showSpinner = false;
                    }).exceptionally(t => {
                        console.log(t);
                        that.$toast.error(that.translate("DRIVE.LINK.ERROR.UPDATE"), {timeout:false});
                        that.showSpinner = false;
                    });
                }
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
.secret-link-container{
    padding-right:15px;
    padding-left:15px;
    margin-right:auto;
    margin-left:auto}
</style>