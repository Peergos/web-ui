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
            <Spinner v-if="showSpinner"></Spinner>
            <div class="folder-picker-view" class="scroll-style">
              <ul>
                <TreeItem class="item"
                :model="treeData"
                :selectFolder_func="selectFolder"
                :load_func="loadFolderLazily"
                :spinnerEnable_func="spinnerEnable"
                :spinnerDisable_func="spinnerDisable"
                :initiallySelectedPaths="selectedPaths"></TreeItem>
              </ul>
            </div>
            <h4>Selected:</h4>
            <div v-if="selectedFoldersList.length == 0 && multipleFolderSelection">
            {{ translate("FOLDER.PICKER.NO.FOLDERS") }}
            </div>
            <div v-if="selectedFoldersList.length == 0 && !multipleFolderSelection">
            {{ translate("FOLDER.PICKER.NO.FOLDER") }}
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
const Spinner = require("../spinner/Spinner.vue");
const TreeItem = require("TreeItem.vue");
const folderTreeMixin = require("../../mixins/tree-walker/index.js");
const i18n = require("../../i18n/index.js");
module.exports = {
    components: {
        Spinner,
        TreeItem
    },
    data: function() {
        return {
            showSpinner: true,
            spinnerMessage: 'Loading folders...',
            treeData: {},
            selectedFoldersList: [],
            selectedPaths: [],
        }
    },
    props: ['baseFolder', 'selectedFolder_func', 'multipleFolderSelection', 'initiallySelectedPaths'],
    mixins:[folderTreeMixin, i18n],
    computed: {
        ...Vuex.mapState([
            'context',
        ]),
    },
    created: function() {
        let that = this;
        this.selectedPaths = this.initiallySelectedPaths.slice();
        this.selectedFoldersList = this.selectedPaths.slice();
        let callback = (baseOfFolderTree) => {
            that.treeData = baseOfFolderTree;
            that.showSpinner = false;
            that.spinnerMessage = '';
        };
        this.loadSubFolders(this.baseFolder + "/", callback);
    },
    methods: {
        close: function () {
            this.selectedFolder_func(this.selectedFoldersList);
        },
        spinnerEnable: function () {
            this.showSpinner = true;
        },
        spinnerDisable: function () {
            this.showSpinner = false;
        },
        loadFolderLazily: function(path, callback) {
            this.loadSubFolders(path, callback);
        },
        showError: function(msg) {
            console.log(msg);
            this.$toast.error(msg, {timeout:false});
        },
        selectFolder: function (folderName, add) {
            if (add) {
                if (this.multipleFolderSelection) {
                    this.selectedFoldersList.push(folderName);
                } else {
                    if (this.selectedFoldersList.length > 0) {
                        this.showError(this.translate("FOLDER.PICKER.MULTIPLE.SELECTION.NOT.SUPPORTED"));
                        return false;
                    } else {
                        this.selectedFoldersList.push(folderName);
                    }
                }
            } else {
                let index = this.selectedFoldersList.findIndex(v => v === folderName);
                if (index > -1) {
                    this.selectedFoldersList.splice(index, 1);
                }
            }
            return true;
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
    border: 2px solid var(--green-500);
    margin: 8px 0;
}
</style>
