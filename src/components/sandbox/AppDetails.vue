<template>
<transition name="modal">
<div class="modal-mask" @click="close">
    <meta http-equiv="content-type" content="text/html; charset=utf-8" />
    <div @click.stop class="app-details-container">
        <span @click="close" tabindex="0" v-on:keyup.enter="close" aria-label="close" class="close">&times;</span>
        <div class="modal-header">
            <h2>App Details</h2>
        </div>
        <div class="modal-body">
            <spinner v-if="showSpinner"></spinner>
            <div v-if="appProperties != null">
                <div class="app-details-view">
                    <p>
                        <span class="app-details-span">Name:</span><span>{{appProperties.details.displayName}}&nbsp;
                        {{appProperties.details.majorVersion}}.{{appProperties.details.minorVersion}}
                        </span>
                    </p>
                    <p>
                        <span class="app-details-span">Description:</span><span class="app-details-text">{{appProperties.details.description}}</span>
                    </p>
                    <p>
                        <span class="app-details-span">Support:</span><span class="app-details-text">{{appProperties.details.supportAddress}}</span>
                    </p>
                    <p>
                        <span v-if="appProperties.details.fileExtensions.length > 0" class="app-install-span">Associated File extensions:</span><span class="app-install-text">{{appProperties.details.fileExtensions.join(", ")}}</span>
                    </p>
                    <p>
                        <span v-if="appProperties.details.mimeTypes.length > 0" class="app-install-span">Associated Mime types:</span><span class="app-install-text">{{appProperties.details.mimeTypes.join(", ")}}</span>
                    </p>
                    <p>
                        <span v-if="appProperties.details.fileTypes.length > 0" class="app-install-span">Associated File types:</span><span class="app-install-text">{{appProperties.details.fileTypes.join(", ")}}</span>
                    </p>
                    <p>
                        <span v-if="appProperties.details.folderAction==true" class="app-install-span">Is a Folder Action</span>
                    </p>
                    <p v-if="appProperties.permissions.length == 0">
                        <span class="app-install-span">Permissions:</span><span class="app-install-text">None Required</span>
                    </p>
                    <p v-if="appProperties.permissions.length > 0">
                        <span class="app-install-span">Permissions:</span><span class="app-install-text"></span>
                    </p>
                    <p v-if="appProperties.permissions.length > 0">
                        <li v-for="permission in appProperties.permissions">
                          {{ convertPermissionToHumanReadable(permission) }}
                        </li>
                    </p>
                </div>
            </div>
        </div>
    </div>
</div>
</transition>
</template>

<script>
const sandboxMixin = require("../../mixins/sandbox/index.js");

module.exports = {
    data: function() {
        return {
            showSpinner: false,
            spinnerMessage: '',
            appProperties: null
        }
    },
    props: ['appPropsFile'],
    mixins:[sandboxMixin],
    created: function() {
        this.loadAppProperties();
    },
    methods: {
        close: function () {
            this.$emit("hide-app-details");
        },
        loadAppProperties: function() {
            let that = this;
            this.showSpinner = true;
            that.readJSONFile(this.appPropsFile).thenApply((res) => {
                that.showSpinner = false;
                that.appProperties = res.app;
            });
        },
    }
}
</script>
<style>
.app-details-container {
    width: 40%;
    overflow-y: auto;
    position: fixed;
    left: 50%;
    transform: translate(-50%, 0);
    padding: 20px 30px;
    background-color: var(--bg);
    border-radius: 2px;
    box-shadow: 0 2px 8px rgba(0,0,0,.33);
    transition: all .3s ease;
}

.app-details-view {
    font-size: 1.3em;
}
.app-details-text {
    font-size: 1.0em;
}
.app-details-span {
    font-weight: bold;
    padding-right: 10px;
}
</style>
