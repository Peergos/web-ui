<template>
<transition name="modal">
<div class="pg-dialog__mask" @click="close">
    <div class="pg-dialog pg-dialog--prompt app-details-container" role="dialog" aria-modal="true" aria-label="App Details" @click.stop>
        <header class="pg-dialog__head">
            <h3 class="pg-dialog__title">App Details</h3>
            <DialogClose @close="close"/>
        </header>
        <div class="pg-dialog__body">
            <Spinner v-if="showSpinner" :absolutePosition="spinnerAbsolutePosition"></Spinner>
            <!-- one column with one gap, whether or not the notes come between the two lists -->
            <div v-if="appProperties != null" class="app-details__all">
                <dl class="app-details">
                    <div class="app-details__fact">
                        <dt>Name</dt>
                        <dd>{{appProperties.displayName}} <span class="app-details__version">{{appProperties.version}}</span></dd>
                    </div>
                    <div class="app-details__fact">
                        <dt>Description</dt>
                        <dd>{{appProperties.description}}</dd>
                    </div>
                    <div v-if="appProperties.author.length > 0" class="app-details__fact">
                        <dt>Author</dt>
                        <dd>{{appProperties.author}}</dd>
                    </div>
                    <div v-if="appProperties.source.length > 0" class="app-details__fact">
                        <dt>Source</dt>
                        <dd><a class="app-details__link" @click="navigateToInstallFolder()">{{appProperties.source}}</a></dd>
                    </div>
                    <div v-if="appProperties.fileExtensions.length > 0" class="app-details__fact">
                        <dt>Associated File extensions</dt>
                        <dd>{{appProperties.fileExtensions.join(", ")}}</dd>
                    </div>
                    <div v-if="appProperties.mimeTypes.length > 0" class="app-details__fact">
                        <dt>Associated Mime types</dt>
                        <dd>{{appProperties.mimeTypes.join(", ")}}</dd>
                    </div>
                    <div v-if="appProperties.fileTypes.length > 0" class="app-details__fact">
                        <dt>Associated File types</dt>
                        <dd>{{appProperties.fileTypes.join(", ")}}</dd>
                    </div>
                </dl>
                <!-- notes with no label of their own, between the facts and the permissions -->
                <p v-if="appProperties.folderAction==true" class="app-details__note">Is a Folder Action</p>
                <p v-if="appProperties.template.length > 0 && !appProperties.template.includes('instance')" class="app-details__note">Multiple instances of App can be installed</p>
                <dl v-if="appProperties.permissions.length > 0 || !appHasFileAssociation" class="app-details">
                    <div v-if="!appHasFileAssociation && appProperties.permissions.length == 0" class="app-details__fact">
                        <dt>Permissions</dt>
                        <dd>None Required</dd>
                    </div>
                    <div v-if="appProperties.permissions.length > 0" class="app-details__fact">
                        <dt>Permissions</dt>
                        <dd>
                            <ul class="app-details__permissions">
                                <li v-for="permission in appProperties.permissions">
                                    <span>{{ convertPermissionToHumanReadable(permission) }}</span>
                                    <button v-if="permission === 'STORE_APP_DATA'" type="button" class="pg-btn" @click="displayDataFolder()">Show Data Folder</button>
                                </li>
                            </ul>
                        </dd>
                    </div>
                </dl>
            </div>
        </div>
    </div>
</div>
</transition>
</template>

<script>
const Spinner = require("../spinner/Spinner.vue");
const DialogClose = require("../dialog/DialogClose.vue");
const sandboxMixin = require("../../mixins/sandbox/index.js");
const routerMixins = require("../../mixins/router/index.js");
module.exports = {
	components: {
	    Spinner,
	    DialogClose
	},
    data: function() {
        return {
            showSpinner: false,
            appProperties: null,
            appHasFileAssociation: false,
            spinnerAbsolutePosition: true,
        }
    },
    props: ['appPropsFile'],
    mixins:[sandboxMixin, routerMixins],
    created: function() {
        this.loadAppProperties();
    },
    methods: {
        displayDataFolder() {
            let path = '/' + this.context.username + '/.apps/' + this.appProperties.name + '/data';
            this.openFileOrDir("Drive", path, {filename:""});
        },
        close: function () {
            this.$emit("hide-app-details");
        },
        loadAppProperties: function() {
            let that = this;
            this.showSpinner = true;
            that.readJSONFile(this.appPropsFile).thenApply((res) => {
                that.showSpinner = false;
                that.appHasFileAssociation = res.fileExtensions.length > 0 || res.mimeTypes.length > 0 || res.fileTypes.length > 0;
                that.appProperties = res;
            });
        },
        navigateToInstallFolder: function() {
            this.openFileOrDir("Drive", this.appProperties.source, {filename:""});
        }
    }
}
</script>
<style>
/* What an app is and may do, on the surface the confirm and prompt dialogs use: each fact a
   small label over its value, as the sync and mount views label theirs. */

.app-details {
	display: flex;
	flex-direction: column;
	gap: 14px;
	margin: 0;
}

.app-details__fact {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-width: 0;
}

.app-details__fact dt {
	font-size: 10px;
	font-weight: var(--regular);
	text-transform: uppercase;
	letter-spacing: .07em;
	color: var(--pg-muted);
}

.app-details__fact dd {
	margin: 0;
	font-size: 15px;
	overflow-wrap: anywhere;
}

.app-details__all {
	display: flex;
	flex-direction: column;
	gap: 14px;
}

.app-details__note {
	margin: 0;
	font-size: 15px;
}

.app-details__version {
	color: var(--pg-muted);
	font-size: var(--text-small);
}

.app-details__link {
	color: var(--pg-link);
	cursor: pointer;
}

.app-details__permissions {
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin: 0;
	padding: 0;
	list-style: none;
}

.app-details__permissions li {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 8px 12px;
}
</style>
