<template>
    <transition name="modal">
        <div class="modal-mask" @click="$emit('hide-modal')">
            <div style="height:30%"></div>
            <div class="modal-container" @click.stop>
                
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
                                    <input type="checkbox" @change="onChange()" v-model="isWritable">
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
const i18n = require("../../i18n/index.js");
    module.exports = {
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
                userPassword: ""
            };
	},
        mixins:[i18n],
	props: [
	    "title",
	    "link",
            "username",
            "existingProps",
            "context"
        ],
        created: function() {
            let that = this;
            if (this.existingProps != null) {
                this.isWritable = this.existingProps.isWritable;
                // TODO load remaining fields from existingProps
                this.updateHref();
            };
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
                if (create) {
                    this.context.createSecretLink(this.getLinkPath(), this.isWritable, this.getExpiry(),
                                                  this.maxRetrievals, this.hasPassword ? this.userPassword : "").thenApply(props => {
                                                      that.existingProps = props;
                                                      that.updateHref();
                                                  }).exceptionally(t => {
                                                      console.log(t);
                                                  });
                } else {
                    let newLinkProps = this.existingProps.with(this.hasPassword ? this.userPassword : "", this.maxRetrievals, this.getExpiry());
                    this.context.updateSecretLink(this.getLinkPath(), newLinkProps).thenApply(props => {
                        that.existingProps = props;
                        that.updateHref();
                    }).exceptionally(t => {
                        console.log(t);
                    });
                }
            },
            getExpiry: function() {
                if (! this.hasExpiry)
                    return java.util.Optional.empty();
                let dateExpiry = document.getElementById("expiry-date-picker");
                if (dateExpiry != null) {
                    this.expireDateString = dateExpiry.value;
                }
                let timeExpiry = document.getElementById("expiry-time-picker");
                if (timeExpiry != null) {
                    this.expireTimeString = dateExpiry.value;
                }
                // TODO fix datetime format
                return java.util.Optional.of();
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
