<template>
   	<article class="app-view sync-view">
	   	<AppHeader>
			<template #primary>
				<h1>{{ translate("SYNC.TITLE") }}</h1>
			</template>
		</AppHeader>
		<main>

            <div style="width:100%;">
                <center><div class="hspace-5">
		    <button class="btn btn-success" @click="addSyncPair()">{{ translate("SYNC.ADDPAIR") }}</button>
                </div>
                <div style="padding:1em">Status: {{ status }}</div>
                </center>
                <div style="display:flex; flex-direction:column">
                   <div v-for="pair in syncPairs" style="display:flex; flex-direction:row; flex-wrap:wrap; padding:1em; margin:.5em; border:solid #16a98a;">
                      <label style="padding:1em; flex-grow:1; text-align:center;"> Syncing </label>
                      <label style="padding:1em; flex-grow:1; text-align:center;">{{ prettifyHostFolder(pair.localpath) }}</label>
                      <label style=" flex-grow:1; text-align:center; padding:1em;"> to and from </label>
                      <a v-on:click="navigateTo(pair.remotepath)" style="cursor:pointer; padding:1em; flex-grow:1; text-align:center;">{{ pair.remotepath }}</a>
                      <label style="padding:1em; flex-grow:1; text-align:center;"> Syncing local deletes: {{ pair.syncLocalDeletes }}</label>
                      <label style="padding:1em; flex-grow:1; text-align:center;"> Syncing remote deletes: {{ pair.syncRemoteDeletes }}</label>
                      <button class="btn btn-success" @click="syncNow(pair.label)" style="flex-grow:1;margin:10px;">{{ translate("SYNC.NOW") }}</button>
                      <button class="btn btn-warning" @click="removeSyncPair(pair.label)" style="flex-grow:1;margin:10px;">{{ translate("SYNC.STOPPAIR") }}</button>
                   </div>
                </div>
            </div>
            <FolderPicker
                v-if="showFolderPicker"
                :baseFolder="folderPickerBaseFolder" :selectedFolder_func="selectedFoldersFromPicker"
                :multipleFolderSelection="multipleFolderSelection"
                :initiallySelectedPaths="initiallySelectedPaths"
                :noDriveSelection="true"
                :pickerTitle="pickerTitle">
            </FolderPicker>

            <SimpleFolderPicker
              v-if="showSimpleFolderPicker"
              :baseFolder="folderSimplePickerBaseFolder"
              :selectedFolder_func="selectedFoldersFromSimplePicker"
              :preloadFolders_func="preloadHostFolders"
              :multipleFolderSelection="multipleFolderSelectionSimplePicker"
              :pickerTitle="simplePickerTitle">
            </SimpleFolderPicker>
            <Spinner v-if="showSpinner" :message="spinnerMessage"></Spinner>
            <Select
                v-if="showSelect"
                v-on:hide-select="showSelect = false"
                :select_message='select_message'
                :select_body="select_body"
                :select_consumer_func="select_consumer_func"
                :select_options="select_options">
            </Select>
            <!--<input
               type="file"
                id="uploadDirectoriesInput"
                @change="uploadFiles"
                style="display: none"
                multiple
                directory
                mozDirectory
                webkitDirectory
            />!-->
        </main>
   </article>
</template>

<script>
const AppHeader = require("../components/AppHeader.vue");
const FolderPicker = require('../components/picker/FolderPicker.vue');
const Select = require('../components/choice/Select.vue');

const SimpleFolderPicker = require('../components/picker/SimpleFolderPicker.vue');
const Spinner = require("../components/spinner/Spinner.vue");

const i18n = require("../i18n/index.js");

const routerMixins = require("../mixins/router/index.js");

module.exports = {
	components: {
		AppHeader,
		FolderPicker,
		Select,
		SimpleFolderPicker,
        Spinner,
	},
    data() {
        return {
            syncPairs: [],
            showSimpleFolderPicker: false,
            folderSimplePickerBaseFolder: "",
            multipleFolderSelectionSimplePicker: false,
            showFolderPicker: false,
            showHostFolderPicker: false,
            folderPickerBaseFolder: "",
            multipleFolderSelection: false,
            initiallySelectedPaths: [],
            hostFolderTree: null,
            pickerTitle: "Remote Folder",
            simplePickerTitle: "Local Folder",
            showSpinner: false,
            spinnerMessage: '',
            showSelect: false,
            select_message: '',
            select_body: '',
            select_consumer_func: () => {},
            select_options: [],
            status: "",
            mounted: true,
        }
    },
    props: [],
	mixins:[routerMixins, i18n],

	computed: {
		...Vuex.mapState([
			'context',
		]),
		...Vuex.mapGetters([
			'getPath'
		]),
    },
	created() {
        this.getSyncState();
        var that = this;
        setInterval(() => {
        if (that.mounted)
            that.updateStatus();
        }, 1000);
    },
    destroyed() {
        this.mounted = false;
    },
    methods: {
		...Vuex.mapActions([
			'updateSocial'
		]),
        localPost(url, body) {
            return new Promise(function(resolve, reject) {
                var req = new XMLHttpRequest();
                req.open('POST', url);
                req.responseType = 'json';

                req.onload = function() {
                    // This is called even on 404 etc
                    // so check the status
                    if (req.status == 200) {
                        resolve(req.response);
                    }
                    else {
                        try {
                            let trailer = req.getResponseHeader("Trailer");
                            if (trailer == null) {
                                reject('Unexpected error from server');
                            } else {
                                reject(trailer);
                            }
                        } catch (e) {
                            reject(e);
                        }
                    }
	            };
	    
	            req.onerror = function(e) {
                    reject(Error("Unable to connect"));
	            };
            
                req.ontimeout = function() {
                    reject(Error("Network timeout"));
                };
            
	            req.send(body != null ? body : new Int8Array(0));
            })
        },

        getSyncState() {
            let that = this;
            this.localPost("/peergos/v0/sync/get-pairs").then(function(result, err) {
               that.syncPairs = result.pairs;
            })
        },

        updateStatus() {
            let that = this;
            this.localPost("/peergos/v0/sync/status").then(function(result, err) {
               that.status = result.msg;
            })
        },

        prettifyHostFolder(uri) {
           if (! uri.startsWith("content://") && ! uri.startsWith("//"))
              return uri;
           // e.g. content://com.android.externalstorage.documents/tree/primary%3ADocuments
           // e.g. //com.android.externalstorage.documents/tree/primary%3ADocuments
           var res = new URL(uri);
           var path = res.pathname;
           const prefix = "/tree/primary%3A"
           if (path.startsWith(prefix))
              return path.substring(prefix.length).replaceAll("%2F", "/");
           return path.replaceAll("%2F", "/");
        },

        getHostDirTree() {
            let future = peergos.shared.util.Futures.incomplete();
            this.localPost("/peergos/v0/sync/get-host-paths?prefix=%2F").then(function(result, err) {
               future.complete(result);
            });
            return future;
        },

        openNativeHostDirChooser() {
            let future = peergos.shared.util.Futures.incomplete();
            this.localPost("/peergos/v0/sync/get-host-dir").then(function(result, err) {
               future.complete(result.root);
            })
            return future;
        },

        getHostDir() {
            let isAndroid = navigator.userAgent.indexOf("android") > -1;
            if (isAndroid)
               return this.openNativeHostDirChooser();
            return this.openHostFolderPicker();
        },

        getPeergosDir() {
           return this.openPeergosFolderPicker();
        },
        getDeleteBehaviour() {
            let future = peergos.shared.util.Futures.incomplete();
            let that = this;
            this.select_message = this.translate("SYNC.SELECT.DELETION.BEHAVIOUR");
            this.select_body = '';
            let syncLocalDeletesLabel = this.translate("SYNC.SELECT.DELETION.LOCAL");
            let syncRemoteDeletesLabel = this.translate("SYNC.SELECT.DELETION.REMOTE");
            this.select_consumer_func = (picked) => {
                let syncLocalDeletes = picked.indexOf(syncLocalDeletesLabel) > -1;
                let syncRemoteDeletes = picked.indexOf(syncRemoteDeletesLabel) > -1;
                future.complete({syncLocalDeletes: syncLocalDeletes, syncRemoteDeletes: syncRemoteDeletes});
            };
            this.select_options = [syncLocalDeletesLabel, syncRemoteDeletesLabel];
            this.showSelect = true;
            return future;
        },
        addSyncPair() {
            const that = this;
            this.getHostDir().thenCompose(hostDir => {
                if (hostDir == null) {
                    return;
                }
                return that.getPeergosDir().thenCompose(peergosDir => {
                    if (peergosDir == null) {
                        return;
                    }
                    if (peergosDir.substring(1).split("/").length < 2) {
                       throw "You cannot sync to your home dir, please make a sub folder";
                    }
                    return that.getDeleteBehaviour().thenCompose(deleteSelection => {
                        const syncLocalDeletes = deleteSelection.syncLocalDeletes;
                        const syncRemoteDeletes = deleteSelection.syncRemoteDeletes;
                        const peergosPath = peergos.client.PathUtils.directoryToPath(peergosDir.substring(1).split("/"));
                        return that.context.shareWriteAccessWith(peergosPath, peergos.client.JsUtil.asSet([])).thenCompose(done => {
                           return that.context.createSecretLink(peergosDir, true, java.util.Optional.empty(), "", "", false);
                        }).thenCompose(link => {
                           const cap = link.toLinkString(that.context.signer.publicKeyHash)
                           const label = cap.substring(cap.lastIndexOf("/", cap.indexOf("#")) + 1, cap.indexOf("#"))
                           that.localPost("/peergos/v0/sync/add-pair?label="+label, JSON.stringify({link:cap, dir:hostDir, syncLocalDeletes:syncLocalDeletes,syncRemoteDeletes:syncRemoteDeletes})).then(function(result, err) {
                               if (err != null)
                                  return
                              that.syncPairs.push({localpath:hostDir, remotepath:peergosDir.toString(), label:label, syncLocalDeletes:syncLocalDeletes, syncRemoteDeletes:syncRemoteDeletes});
                           })
                           let future = peergos.shared.util.Futures.incomplete();
                           future.complete(true);
                           return future;
                        }).exceptionally(t => console.log(t));
                    });
                });
            });
        },

        syncNow(label) {
            var that = this;
            this.localPost("/peergos/v0/sync/sync-now?label="+label).then(function(result, err) {
            })
        },

        removeSyncPair(label) {
            var that = this;
            this.localPost("/peergos/v0/sync/remove-pair?label="+label).then(function(result, err) {
               if (err != null)
                   return
               var index = 0;
               for (; index< that.syncPairs.length; index++) {
                   if (that.syncPairs[index].label == label)
                       break;
               }
               that.syncPairs.splice(index, 1);
            })
        },

        close () {
            this.$emit("hide-sync");
        },
        openPeergosFolderPicker() {
            let future = peergos.shared.util.Futures.incomplete();
            let that = this;
            this.folderPickerBaseFolder = "/" + this.context.username;
            this.selectedFoldersFromPicker = function (chosenFolders) {
                if (chosenFolders.length == 0) {
                    future.complete(null);
                } else {
                    let selectedFolder = chosenFolders[0];
                    future.complete(selectedFolder);
                }
                that.showFolderPicker = false;
            };
            this.showFolderPicker = true;
            return future;
        },
        setInitialState(state) {
            state.initiallyOpen = state.children.length == 1;
            if (state.initiallyOpen) {
                this.setInitialState(state.children[0]);
            } else {
                state.initiallyOpen = true;
            }
        },
        openHostFolderPicker() {
            let future = peergos.shared.util.Futures.incomplete();
            let that = this;
            this.showSpinner = true;
            this.getHostDirTree().thenApply(hostFolders => {
                let sortedHostFolders = hostFolders.sort((a, b) => a.localeCompare(b, 'en', {'sensitivity': 'base'}));
                let final = {result:[]};
                for (const path of sortedHostFolders) {
                    let context = final;
                    let sep = path.indexOf("/") >= 0 ? '/' : '\\';
                    let names = path.split(sep).filter(n => n.length > 0);
                    for (var i = 0; i < names.length; i++) {
                        let fullPath = "";
                        for(var j = 0; j <= i && j < names.length; j++) {
                            fullPath = fullPath + (fullPath == "" && sep == '\\' ? "" : sep) + names[j];
                        }
                        let name = names[i];
                        if (!context[name]) {
                            context[name] = {result:[]};
                            context.result.push({path: fullPath, children: context[name].result});
                        }
                        context = context[name];
                    }
                }
                that.setInitialState(final.result[0]);
                let rootPath = final.result[0].path;
                that.hostFolderTree = {"path":rootPath, "initiallyOpen": final.result[0].children.length == 1, "children":final.result[0].children};
                that.folderSimplePickerBaseFolder = rootPath;
                that.showSpinner = false;
                that.selectedFoldersFromSimplePicker = function (chosenFolders) {
                    if (chosenFolders.length == 0) {
                        future.complete(null);
                    } else {
                        let selectedFolder = chosenFolders[0];
                        if (selectedFolder == that.folderSimplePickerBaseFolder) {
                            future.complete(null);
                        } else {
                            future.complete(selectedFolder);
                        }
                    }
                    that.showSimpleFolderPicker = false;
                };
                that.showSimpleFolderPicker = true;
            });
            return future;
        },
        preloadHostFolders: function(path, callback) {
            callback(this.hostFolderTree);
        },
        navigateTo: function (path) {
            this.openFileOrDir("Drive", path, {filename:""});
        },
    },

}
</script>

<style>
.sync-view main{
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    min-height: 100vh;
    padding: var(--app-margin);
}

</style>
