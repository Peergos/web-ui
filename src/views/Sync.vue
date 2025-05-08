<template>
   	<article class="app-view sync-view">
	   	<AppHeader>
			<template #primary>
				<h1>{{ translate("SYNC.TITLE") }}</h1>
			</template>
		</AppHeader>
		<main>

            <div>
                <div class="hspace-5">
		    <button class="btn btn-success" @click="addSyncPair()">{{ translate("SYNC.ADDPAIR") }}</button>
                </div>
                <table class="drive-table">
                <thead><tr>
                    <th>{{ translate("SYNC.LOCAL") }}</th>
                    <th>{{ translate("SYNC.REMOTE") }}</th>
                    <th></th>
                </tr></thead>
                <tbody>
                   <tr v-for="pair in syncPairs" tabindex="1" role="row" class="table__item">
                      <td>{{ pair.localpath }}</td>
                      <td>{{ pair.remotepath }}</td>
                      <td><button class="btn btn-success" @click="removeSyncPair(pair.label)">{{ translate("SYNC.STOPPAIR") }}</button></td>
                   </tr>
                </tbody>
                </table>
            </div>
            <SimpleFolderPicker
              v-if="showFolderPicker"
              :baseFolder="folderPickerBaseFolder"
              :selectedFolder_func="selectedFoldersFromPicker"
              :preloadFolders_func="preloadFolders"
              :multipleFolderSelection="multipleFolderSelection">
            </SimpleFolderPicker>
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
const SimpleFolderPicker = require('../components/picker/SimpleFolderPicker.vue');

const i18n = require("../i18n/index.js");

const routerMixins = require("../mixins/router/index.js");

module.exports = {
	components: {
		AppHeader,
		SimpleFolderPicker,
	},
    data() {
        return {
            syncPairs: [],
            showFolderPicker: false,
            folderPickerBaseFolder: "",
            multipleFolderSelection: false,
            initiallySelectedPaths: [],
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
	    let that = this;
            this.getSyncState();
        //this.getHostDir().thenApply(hostDir => {
        //    console.log('hostDir=' + hostDir);
        //});
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
                future.completeExceptionally(new java.net.ConnectException("Unable to connect"));
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

        getHostDirTree() {
           return this.localPost("/peergos/v0/sync/get-host-paths?prefix=%2F").then(function(result, err) {
               console.log(result);
               return ["/storage/emulated/0/DCIM", "/storage/emulated/0/Pictures", "/storage/emulated/0/Movies", "/storage/emulated/0/Documents", "/storage/emulated/0/Downloads"]
            });
        },

        getHostDir() {
            let future = peergos.shared.util.Futures.incomplete();
            this.getHostDirTree().then(function(result, err) {
               future.complete("/storage/emulated/0/DCIM/Camera");
            });
            return future;
        },

        getPeergosDir() {
           return this.openFolderPicker();
        },

        addSyncPair() {
            const that = this;
            this.getHostDir().thenCompose(hostDir => {
                return that.getPeergosDir().thenCompose(peergosDir => {
                    if (peergosDir == null) {
                        return;
                    }
                    
                    if (peergosDir.substring(1).split("/").length < 2) {
                       throw "You cannot sync to your home dir, please make a sub folder";
                    }
                    const peergosPath = peergos.client.PathUtils.directoryToPath(peergosDir.substring(1).split("/"));
                    return that.context.shareWriteAccessWith(peergosPath, peergos.client.JsUtil.asSet([])).thenCompose(done => {
                       return that.context.createSecretLink(peergosDir, true, java.util.Optional.empty(), "", "", false);
                    }).thenCompose(link => {
                       const cap = link.toLinkString(that.context.signer.publicKeyHash)
                       const label = cap.substring(cap.lastIndexOf("/", cap.indexOf("#")) + 1, cap.indexOf("#"))
                       that.localPost("/peergos/v0/sync/add-pair?label="+label, JSON.stringify({link:cap, dir:hostDir})).then(function(result, err) {
                           if (err != null)
                              return
                          that.syncPairs.push({localpath:hostDir, remotepath:peergosDir.toString(), label:label});
                       })
                    }).exceptionally(t => console.log(t));
                });
            });
        },

        removeSyncPair(label) {
            var that = this;
            localPost("/peergos/v0/sync/remove-pair?label="+label).then(function(result, err) {
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
        openFolderPicker() {
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
        preloadFolders: function(path, callback) {
            var that = this;
            let folderTree = {};
            this.context.getByPath(path).thenApply(function(dirOpt){
                let dir = dirOpt.get();
                let folderProperties = dir.getFileProperties();
                if (folderProperties.isDirectory && !folderProperties.isHidden) {
                    that.walkFolder(dir, path, folderTree).thenApply( () => {
                        callback(folderTree);
                    });
                } else {
                    callback(folderTree);
                }
            }).exceptionally(function(throwable) {
                this.spinnerMessage = 'Unable to preload folders...';
                throwable.printStackTrace();
            });
        },

        walkFolder: function(file, path, currentTreeData) {
            currentTreeData.path = path.substring(0, path.length -1);
            currentTreeData.children = [];
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            file.getChildren(that.context.crypto.hasher, that.context.network).thenApply(function(children) {
                let arr = children.toArray();
                let funcArray = [];
                arr.forEach(function(child, index){
                    let childProps = child.getFileProperties();
                    let newPath = childProps.isDirectory ? path + child.getFileProperties().name + '/' : path;
                    if (childProps.isDirectory && !childProps.isHidden) {
                        let node = {};
                        currentTreeData.children.push(node);
                        funcArray.push(() => {
                            return that.walkFolder(child, newPath, node);
                        });
                    }
                });
                if (funcArray.length > 0) {
                    let completed = {count: 0};
                    funcArray.forEach((func, idx) => {
                        func().thenApply(() => {
                            completed.count ++;
                            if (completed.count == funcArray.length) {
                                future.complete(true);
                            }
                        });
                    });
                } else {
                    future.complete(true);
                }
            });
            return future;
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
