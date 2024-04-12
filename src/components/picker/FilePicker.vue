<template>
<transition name="modal">
<div class="modal-mask" @click="close">
    <meta http-equiv="content-type" content="text/html; charset=utf-8" />
    <div @click.stop class="file-picker-container">
        <span @click="close" tabindex="0" v-on:keyup.enter="close" aria-label="close" class="close">&times;</span>
        <div class="modal-header">
            <h2>File Picker</h2>
        </div>
        <div class="modal-body">
            <Spinner v-if="showSpinner" :message="spinnerMessage"></Spinner>
            <div class="file-picker-view" class="scroll-style">
              <ul>
                <SelectableTreeItem class="item" :model="treeData" :select_func="selectFile" :load_func="loadFolderLazily" :spinnerEnable_func="spinnerEnable" :spinnerDisable_func="spinnerDisable" :selectLeafOnly="selectLeafOnly"></TreeItem>
              </ul>
            </div>
            <input style="background-color: lightgrey;"
                v-model="selectedFile"
                type="text"
                disabled="true"
            >
            </input>
            <div class="flex-line-item">
                <div>
                    <button class="btn btn-success" style = "width:80%" @click="fileSelected()">Done</button>
                </div>
            </div>
        </div>
    </div>
</div>
</transition>
</template>

<script>
const Spinner = require("../spinner/Spinner.vue");
const SelectableTreeItem = require("SelectableTreeItem.vue");
const folderTreeMixin = require("../../mixins/tree-walker/index.js");

module.exports = {
    components: {
        Spinner,
        SelectableTreeItem
    },
    data: function() {
        return {
            showSpinner: true,
            spinnerMessage: 'Loading folders...',
            treeData: {},
            selectedFile: null,
            selectLeafOnly: true
        }
    },
    props: ['baseFolder', 'selectedFile_func', 'pickerFileExtension'],
    mixins:[folderTreeMixin],
    computed: {
        ...Vuex.mapState([
            'context',
        ]),
    },
    created: function() {
        let that = this;
        let callback = (baseOfFolderTree) => {
            that.treeData = baseOfFolderTree;
            that.showSpinner = false;
            that.spinnerMessage = '';
        };
        this.loadSubFoldersAndFiles(this.baseFolder + "/", this.pickerFileExtension, callback);
    },
    methods: {
        close: function () {
            this.selectedFile_func(null);
        },
        selectFile: function (file) {
            this.selectedFile = file;
        },
        spinnerEnable: function () {
            this.showSpinner = true;
        },
        spinnerDisable: function () {
            this.showSpinner = false;
        },
        loadFolderLazily: function(path, callback) {
            this.loadSubFoldersAndFiles(path, this.pickerFileExtension, callback);
        },
        fileSelected: function() {
            this.selectedFile_func(this.selectedFile);
        }
    }
}
</script>

<style>
.file-picker-container {
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
.file-picker-view {
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
