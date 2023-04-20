<template>
<transition name="modal">
<div class="modal-mask" @click="close">
    <meta http-equiv="content-type" content="text/html; charset=utf-8" />
    <div @click.stop class="folder-picker-container">
        <span @click="close" tabindex="0" v-on:keyup.enter="close" aria-label="close" class="close">&times;</span>
        <div class="modal-header">
            <h2>Folder Picker</h2>
        </div>
        <div class="modal-body">
            <spinner v-if="showSpinner"></spinner>
            <div class="folder-picker-view" class="scroll-style">
              <ul>
                <TreeItem class="item" :model="treeData" :selectFolder_func="selectFolder"></TreeItem>
              </ul>
            </div>
            <h4>Selected:</h4>
            <div v-if="selectedFoldersList.length == 0">
            No folders selected...
            </div>
            <div v-if="selectedFoldersList.length != 0">
                <div class="selected-folders-view" class="scroll-style">
                    <ul>
                        <li v-for="selectedFolder in selectedFoldersList">
                            {{ selectedFolder }}
                        </li>
                    </ul>
                </div>
            </div>
            <div class="flex-line-item">
                <div>
                    <button class="btn btn-success" style = "width:80%" @click="foldersSelected()">Done</button>
                </div>
            </div>
        </div>
    </div>
</div>
</transition>
</template>

<script>

const TreeItem = require("TreeItem.vue");

module.exports = {
    components: {
        TreeItem
    },
    data: function() {
        return {
            showSpinner: true,
            spinnerMessage: 'Loading folders...',
            treeData: {},
            selectedFoldersList: [],
            walkCounter: 0,
        }
    },
    props: ['baseFolder', 'selectedFolder_func'],
    mixins:[],
    computed: {
        ...Vuex.mapState([
            'context',
        ]),
    },
    created: function() {
        this.loadFolders();
    },
    methods: {
        loadFolders: function() {
            var that = this;
            let path = this.baseFolder + "/";
            this.walkCounter = 0;
            let baseOfFolderTree = {};
            this.context.getByPath(path).thenApply(function(dir){
                that.walk(dir.get(), path, baseOfFolderTree, () => that.ready(baseOfFolderTree));
            }).exceptionally(function(throwable) {
                that.showSpinner = false;
                this.spinnerMessage = 'Unable to load folders...';
                throwable.printStackTrace();
            });
        },
        ready: function(baseOfFolderTree) {
            this.treeData = baseOfFolderTree;
            this.showSpinner = false;
            this.spinnerMessage = '';
        },
        walk: function(file, path, currentTreeData, cb) {
            let fileProperties = file.getFileProperties();
            if (fileProperties.isHidden)
                return;
            currentTreeData.path = path.substring(0, path.length -1);
            currentTreeData.children = [];
            let that = this;
            if (fileProperties.isDirectory) {
                that.walkCounter++;
                if (that.walkCounter == 1) {
                    that.showSpinner = true;
                }
                file.getChildren(that.context.crypto.hasher, that.context.network).thenApply(function(children) {
                    let arr = children.toArray();
                    let size = arr.length;
                    if (size == 0) {
                        that.walkCounter--;
                        if (that.walkCounter == 0) {
                            cb();
                        }
                    }
                    arr.forEach(function(child, index){
                        let childProps = child.getFileProperties();
                        let newPath = childProps.isDirectory ? path + child.getFileProperties().name + '/' : path;
                        if (childProps.isDirectory && !childProps.isHidden) {
                            let node = {};
                            currentTreeData.children.push(node);
                            that.walk(child, newPath, node, cb);
                        }
                        if (index == size - 1) {
                            that.walkCounter--;
                            if (that.walkCounter == 0) {
                                cb();
                            }
                        }
                    });
                });
            }
        },
        close: function () {
            this.selectedFolder_func([]);
        },
        selectFolder: function (folderName, add) {
            if (add) {
                this.selectedFoldersList.push(folderName);
            } else {
                let index = this.selectedFoldersList.findIndex(v => v === folderName);
                if (index > -1) {
                    this.selectedFoldersList.splice(index, 1);
                }
            }
        },
        foldersSelected: function() {
            let selectedFolders = this.selectedFoldersList;
            // remove duplicates (one folder includes another)
            let dedupList = [];
            for(var i = 0; i < selectedFolders.length; i++) {
                let folder = selectedFolders[i] + '/';
                var isDuplicated = false;
                for(var j = 0; j < selectedFolders.length; j++) {
                    if (i != j) {
                        let anotherFolder = selectedFolders[j];
                        if (anotherFolder.startsWith(folder)) {
                            isDuplicated = true;
                            break;
                        }
                    }
                }
                if (! isDuplicated) {
                    dedupList.push(selectedFolders[i]);
                }
            }
            this.selectedFolder_func(dedupList);
        }
    }
}
</script>

<style>
.folder-picker-container {
    height: 100%;
    width: 600px;
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
.folder-picker-view {
    font-size: 1.3em;
}
.selected-folders-view {
    font-size: 1.3em;
}
.item {
  cursor: pointer;
  line-height: 1.5;
}
.bold {
  font-weight: bold;
}
.scroll-style {
    max-height: 250px;
    overflow-y: scroll;
}
</style>
