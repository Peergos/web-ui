<template>
    <transition name="modal">
        <div class="modal-mask" @click="$emit('hide-modal')">
            <div style="height:30%"></div>
            <div class="modal-container" @click.stop>
                <Spinner v-if="showSpinner"></Spinner>
                <div class="modal-header">
                    <h3 id="modal-header-id">{{ title }}</h3>
                </div>
                
                <div class="modal-body">
                    <div class="container"><p style="word-wrap;break-all;">
                            <div style="font-size: 1.2em;">
                                <div v-if="link.isFile" style="padding: 10px;">
                                    <input type="checkbox" @change="onChange()" v-model="link.autoOpen">
                                    <label style="font-weight: normal;">{{ translate("DRIVE.LINK.OPEN") }}</label>
                                </div>
                                <div style="padding: 10px;">
                                    <input type="checkbox" @change="onChange()" v-model="isWritable" :disabled="existingProps != null">
                                    <label style="font-weight: normal;">{{ translate("DRIVE.LINK.WRITABLE") }}</label>
                                </div>
                                <div style="padding: 10px;">
                                    <input type="checkbox" @change="onChange()" v-model="hasExpiry">
                                    <label style="font-weight: normal;">{{ translate("DRIVE.LINK.EXPIRE.ON") }}</label>
                                    <input id="expiry-date-picker" type="date" @change="onChange(link.id)">
                                    <label style="font-weight: normal;">{{ translate("DRIVE.LINK.AT.TIME") }}</label>
                                    <input id="expiry-time-picker" type="time" @change="onChange(link.id)">
                                </div>
                                <div style="padding: 10px;">
                                    <input type="checkbox" @change="onChange()" v-model="hasMaxRetreivals">
                                    <label style="font-weight: normal;">{{ translate("DRIVE.LINK.LIMIT.RETRIEVALS") }}</label>
                                    <input @change="onChange()" v-model="maxRetrievals">
                                </div>
                                <div style="padding: 10px;">
                                    <input type="checkbox" @change="onChange()" v-model="hasPassword">
                                    <label style="font-weight: normal;">{{ translate("DRIVE.LINK.PASSWORD") }}</label>
                                    <input @change="onChange()" v-model="userPassword">
                                </div>
                                <div style="padding: 10px;">
                                    <button
                                        id='modal-button-id'
                                        class="btn btn-success"
                                        @click="createOrUpdateLink">
                                        {{ existingProps == null ? translate("DRIVE.LINK.CREATE") : translate("DRIVE.LINK.UPDATE") }}
                                    </button>
                                </div>
                                <div v-if="showLink()" style="padding: 10px;">
                                    <strong><a v-bind:href="this.urlLink.href">{{ urlLink.name }}</a></strong>
                                    <input type="text" v-bind:value="this.urlLink.href" style="display: none">
                                    <button class="fa fa-clipboard" style="padding: 6px 12px; background-color:var(--bg);" @click="copyUrlToClipboard($event)">&nbsp;{{ translate("DRIVE.LINK.COPY") }}</button>
                                    <button class="fa fa-envelope" style="padding: 6px 12px; background-color:var(--bg);" @click="email($event)">&nbsp;{{ translate("DRIVE.LINK.EMAIL") }}</button>
                                </div>
                        </p>
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
                urlLink:null,
                isWritable: false,
                hasExpiry: false,
                expireDateString: "",
                expireTimeString: "",
                hasMaxRetreivals: false,
                maxRetrievals: "",
                hasPassword: false,
                userPassword: "",
                showSpinner: false
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
        ],
        created: function() {
            let that = this;
            if (this.existingProps != null) {
                Vue.nextTick(function() {
                    that.isWritable = that.existingProps.isWritable;
                    that.userPassword = that.existingProps.userPassword
                    that.hasPassword = that.existingProps.userPassword.length > 0;
                    that.maxRetrievals = that.existingProps.maxRetrievals.ref == null ?
                            "": that.existingProps.maxRetrievals.ref.toString();
                    that.hasMaxRetrievals = that.maxRetrievals.length > 0;
                    if (that.existingProps.expiry.ref != null) {
                        let date = that.existingProps.expiry.ref.date;
                        let time = that.existingProps.expiry.ref.time;
                        let jsDate = new Date(that.existingProps.expiry.ref.toString() + "+00:00"); //adding UTC TZ in ISO_OFFSET_DATE_TIME ie 2021-12-03T10:25:30+00:00
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
                if (autoOpenOverride || link.autoOpen) {
                    args = "?open=true";
                    if (link.shareFolderWithFile) {
                        json.path = link.path.substring(1);// do not pass starting '/'
                        json.args = {};
                        json.args.filename = link.filename;
                    } else if (link.isFile) {
                        args += "&filename=" + link.filename;
                    } else {
                        args += "&path=" + link.path;
                    }
                }
                return window.location.origin + "/" + link.baseUrl + args;
            },
            showLink: function() {
                return this.urlLink != null;
            },
            createOrUpdateLink: function() {
                let create = this.existingProps == null;
                let that = this;
                this.showSpinner = true;
                if (create) {
                    this.context.createSecretLink(this.getLinkPath(), this.isWritable, this.getExpiry(),
                        this.maxRetrievals, this.hasPassword ? this.userPassword : "").thenApply(props => {
                          that.existingProps = props;
                          that.updateHref();
                          that.showSpinner = false;
                    }).exceptionally(t => {
                        console.log(t);
                        that.$toast.error(that.translate("DRIVE.LINK.ERROR.CREATE"), {timeout:false});
                        that.showSpinner = false;
                    });
                } else {
                    let newLinkProps = this.existingProps.with(this.hasPassword ? this.userPassword : "", this.maxRetrievals, this.getExpiry());
                    this.context.updateSecretLink(this.getLinkPath(), newLinkProps).thenApply(props => {
                        that.existingProps = props;
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
                if (timeExpiry != null) {
                    expireTimeString = timeExpiry.value;
                }
                let year = parseInt(dateS.split("-")[0]);
                let month = parseInt(dateS.split("-")[1]);
                let day = parseInt(dateS.split("-")[2]);
                let hour = parseInt(expireTimeString.split(":")[0]);
                let minute = parseInt(expireTimeString.split(":")[1]);
                return java.util.Optional.of(java.time.LocalDateTime.of(year, month, day, hour, minute, 0));
            },
            updateHref: function() {
                let that = this;
                let linkString = that.context.getLinkString(that.existingProps);
                this.link.baseUrl = linkString;
                let href = that.buildHref(this.link, true);
                that.urlLink = {href : href,
                                name: this.link.name, isFile: this.link.isFile, autoOpen: true};
            },
            getLinkPath: function() {
                var path = this.link.path;
                if (! path.endsWith("/"))
                    path = path+"/";
                return path + this.link.filename;
            },
            onChange: function () {
                if (this.urlLink != null)
                    this.urlLink.href = this.buildHref(this.urlLink);
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
                this.links.forEach(link => {
                    let href = that.buildHref(link, true);
                    body += link.name + ": " + href + "\n";
                    if (link.isFile)
                        type = "file";
                    else
                        type = "folder";
                });
                body = "Click on the following link to view the " + type + "\n\n" + body;
                var subject = this.username + " shared a "+type+" with you!";
                var link = document.getElementById('downloadAnchor')
                link.href = "mailto:?body="+encodeURIComponent(body)+"&subject="+encodeURIComponent(subject);
                link.click()
            },
        }
    }
</script>
