<template>
    <transition name="modal">
        <div class="modal-mask" @click="$emit('hide-overview')">
            <div style="height:15%"></div>
            <div class="modal-container" style="transform: translateY(-15%);" @click.stop>
                <Spinner v-if="showSpinner"></Spinner>
                <div class="modal-header">
                    <h3>{{ translate("DRIVE.LINKS.TITLE") }}</h3>
                </div>

                <div class="modal-body">
                    <div class="links-overview scrollable">
                        <p v-if="!showSpinner && links.length == 0">{{ translate("DRIVE.LINKS.NONE") }}</p>
                        <table v-if="links.length > 0" class="table">
                            <thead>
                                <tr>
                                    <th>{{ translate("DRIVE.LINKS.CONTAINS") }}</th>
                                    <th>{{ translate("DRIVE.LINKS.ACCESS") }}</th>
                                    <th>{{ translate("DRIVE.LINKS.PASSWORD") }}</th>
                                    <th>{{ translate("DRIVE.LINKS.MAXCOUNT") }}</th>
                                    <th>{{ translate("DRIVE.LINKS.EXPIRY") }}</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr v-for="l in links" :key="l.getLabel()">
                                    <td>
                                        <div class="links-overview__count">
                                            {{ l.itemCount() }}
                                            {{ l.itemCount() == 1 ? translate("DRIVE.LINKS.ITEM") : translate("DRIVE.LINKS.ITEMS") }}
                                        </div>
                                        <div class="links-overview__paths" :title="l.paths().join('\n')">
                                            {{ l.paths().join(", ") }}
                                        </div>
                                    </td>
                                    <td>{{ l.isWritable() ? translate("DRIVE.LINKS.WRITABLE") : translate("DRIVE.LINKS.READONLY") }}</td>
                                    <td>{{ l.hasPassword() ? "✓" : "-" }}</td>
                                    <td>{{ l.maxRetrievalsString() == "" ? "-" : l.maxRetrievalsString() }}</td>
                                    <td>{{ l.expiryString() == "" ? "-" : l.expiryString() }}</td>
                                    <td>
                                        <button class="fa fa-clipboard btn" :title="translate('DRIVE.LINK.COPY')"
                                                @click="copy(l)"></button>
                                        <button class="btn btn-success" @click="edit(l)">
                                            {{ translate("DRIVE.LINK.VIEWEDIT") }}
                                        </button>
                                        <button class="btn btn-success" @click="remove(l)">
                                            {{ translate("DRIVE.LINKS.DELETE") }}
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <SecretLink
                    v-if="editing != null"
                    v-on:hide-modal="closeEditor"
                    :title="translate('DRIVE.LINKS.TITLE')"
                    :link="editorLink"
                    :host="linkHost"
                    :existingProps="editing.getProps()"
                    :username="context.username"
                />

                <div class="modal-footer">
                    <button class="btn btn-success" @click="$emit('hide-overview')">
                        {{ translate("DRIVE.LINK.OK") }}
                    </button>
                </div>
            </div>
        </div>
    </transition>
</template>

<script>
const Spinner = require("../spinner/Spinner.vue");
const SecretLink = require("./SecretLink.vue");
const i18n = require("../../i18n/index.js");

module.exports = {
    components: { Spinner, SecretLink },
    mixins: [i18n],
    data() {
        return {
            links: [],
            showSpinner: false,
            editing: null,
            editorLink: null,
            linkHost: "",
        };
    },
    computed: {
        ...Vuex.mapState(['context']),
    },
    created: function() {
        this.load();
        let that = this;
        this.context.getLinkHost().thenApply(host => { that.linkHost = host; });
    },
    methods: {
        load() {
            let that = this;
            this.showSpinner = true;
            this.context.getAllSecretLinks().thenApply(links => {
                that.links = links.toArray([]);
                that.showSpinner = false;
            }).exceptionally(t => {
                console.log(t);
                that.showSpinner = false;
                that.$toast.error(that.translate("DRIVE.LINKS.ERROR.LOAD"), {timeout:false});
                return null;
            });
        },
        // the editor is anchored to a path so it can fall back to one for a link that predates
        // member lists; a link that knows its members ignores it
        edit(summary) {
            let path = summary.paths()[0];
            let lastSlash = path.lastIndexOf('/');
            this.editorLink = {
                path: path.substring(0, lastSlash),
                filename: path.substring(lastSlash + 1),
                isFile: true,
                name: path.substring(lastSlash + 1),
                shareFolderWithFile: false,
            };
            this.editing = summary;
        },
        closeEditor() {
            this.editing = null;
            this.editorLink = null;
            this.load();
        },
        copy(summary) {
            let linkString = this.context.getLinkString(summary.getProps());
            let href = (this.linkHost.startsWith("localhost:") ? "http://" : "https://")
                + this.linkHost + "/" + linkString;
            navigator.clipboard.writeText(href).then(() => {
                this.$toast.success(this.translate("DRIVE.LINKS.COPIED"));
            }, () => console.error("Unable to write to clipboard."));
        },
        remove(summary) {
            // deleting the link takes it away from every item in it, which is not the same as
            // removing one item from the link
            let paths = summary.paths();
            if (! confirm(this.translate("DRIVE.LINKS.DELETE.CONFIRM")
                    .replace("%n", paths.length).replace("%s", paths.join("\n"))))
                return;
            let that = this;
            this.showSpinner = true;
            this.context.deleteSecretLinkFrom(summary.getLabel(), peergos.client.JsUtil.asList(paths))
                .thenApply(() => {
                    that.showSpinner = false;
                    that.load();
                }).exceptionally(t => {
                    console.log(t);
                    that.showSpinner = false;
                    that.$toast.error(that.translate("DRIVE.LINKS.ERROR.DELETE"), {timeout:false});
                    return null;
                });
        },
    }
}
</script>
<style>
.links-overview {
    max-height: 60vh;
    overflow-y: auto;
    padding: 0 15px;
}
.links-overview__count {
    font-weight: bold;
}
.links-overview__paths {
    font-size: 0.85em;
    opacity: 0.8;
    max-width: 30em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
