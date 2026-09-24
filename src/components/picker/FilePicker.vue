<template>
<transition name="modal">
<div class="pg-dialog__mask" @click="close">
    <div class="pg-dialog fp-picker file-picker-container" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1" @click.stop>
        <header class="pg-dialog__head">
            <h2 class="pg-dialog__title">{{ title }}</h2>
            <DialogClose @close="close"/>
        </header>
        <div v-if="displayDriveSelection" class="fp-picker__drive">
            <select class="fp-select" v-model="selectedDrive" :disabled="disableDriveSelection" @change="changeSelectedDrive">
                <option v-for="option in driveOptions" :key="option.value" :value="option.value">{{ option.text }}</option>
            </select>
        </div>
        <div class="pg-dialog__body fp-picker__tree">
            <SelectableTreeItem :model="treeData" :select_func="selectFile" :load_func="loadFolderLazily"
                :spinnerEnable_func="spinnerEnable" :spinnerDisable_func="spinnerDisable"
                :selectLeafOnly="selectLeafOnly" :selectedPath="selectedFile" :treeLabel="title"></SelectableTreeItem>
        </div>
        <footer class="pg-dialog__foot">
            <div v-if="pickerShowThumbnail && fileThumbnail.length > 0" class="file-thumbnail">
                <img class="cover" :src="fileThumbnail" alt=""/>
            </div>
            <div v-if="pickerAllowWriteMode && selectedFile" class="fp-picker__choices">
                <label class="pg-switch">
                    <input type="checkbox" v-model="openForEditing">
                    <span class="pg-switch__track" aria-hidden="true"></span>
                    <span>{{ translate("FILE.PICKER.EDIT") }}</span>
                </label>
            </div>
            <div class="fp-selection">
                <template v-if="selectedFile">
                    <span class="fp-selection__label">{{ translate("FILE.PICKER.SELECTED") }}</span>
                    <SelectedPath :path="selectedFile"/>
                </template>
                <span v-else class="fp-selection__empty">{{ translate("FILE.PICKER.NONE") }}</span>
            </div>
            <div class="pg-dialog__actions">
                <span class="pg-dialog__spacer"></span>
                <button type="button" class="pg-btn" @click="close">{{ translate("FILE.PICKER.CANCEL") }}</button>
                <button type="button" class="pg-btn pg-btn--primary" :disabled="! selectedFile" @click="fileSelected()">{{ translate("FILE.PICKER.SELECT") }}</button>
            </div>
        </footer>
        <div v-if="showSpinner" class="pg-dialog__loading"><Spinner :message="spinnerMessage"></Spinner></div>
    </div>
</div>
</transition>
</template>

<script>
const Spinner = require("../spinner/Spinner.vue");
const SelectableTreeItem = require("SelectableTreeItem.vue");
const SelectedPath = require("SelectedPath.vue");
const DialogClose = require("../dialog/DialogClose.vue");
const i18n = require("../../i18n/index.js");
const folderTreeMixin = require("../../mixins/tree-walker/index.js");

module.exports = {
    components: {
        Spinner,
        SelectableTreeItem,
        SelectedPath,
        DialogClose
    },
    data: function() {
        return {
            showSpinner: false,
            spinnerMessage: 'Loading folders...',
            treeData: {},
            selectedFile: null,
            selectLeafOnly: this.pickerSelectFolders !== true,
            fileThumbnail : '',
            selectedDrive: "",
            driveOptions: [],
            displayDriveSelection: false,
            disableDriveSelection: false,
            openForEditing: this.pickerDefaultWriteMode === true,
        }
    },
    props: ['baseFolder', 'selectedFile_func', 'pickerFileExtension', 'pickerFilterMedia', 'pickerShowThumbnail', 'pickerFilters', 'noDriveSelection', 'pickerAllowWriteMode', 'pickerDefaultWriteMode', 'pickerSelectFolders', 'pickerTitle'],
    mixins:[folderTreeMixin, i18n],
    computed: {
        ...Vuex.mapState([
            'context',
            'socialData',
        ]),
        friendnames: function() {
            return this.socialData.friends;
        },
        title: function() {
            if (this.pickerTitle)
                return this.pickerTitle;
            return this.translate(this.pickerSelectFolders === true ? "FILE.PICKER.TITLE.ANY" : "FILE.PICKER.TITLE");
        },
    },
    created: function() {
        let that = this;
        let callback = (baseOfFolderTree) => {
            that.treeData = baseOfFolderTree;
            that.showSpinner = false;
            that.spinnerMessage = '';
        };
        let numberOfFriends = this.friendnames.length;
        let doNotShowDriveSelection = this.noDriveSelection !=null && this.noDriveSelection === true;
        let allowChangeOfDrive = !doNotShowDriveSelection && numberOfFriends > 0 && this.baseFolder === "/" + this.context.username;
        that.showSpinner = true;
        if(allowChangeOfDrive) {
            let homeDrive = "/" + this.context.username + '/';
            that.driveOptions.push({ text: 'Drive: ' + this.context.username, value: homeDrive});
            this.friendnames.forEach(f => {
                that.driveOptions.push({ text: 'Drive: ' + f, value: "/" + f + '/' });
            });
            this.selectedDrive = homeDrive;
            this.displayDriveSelection = true;
            this.loadSubFoldersAndFiles(homeDrive, this.pickerFileExtension, this.pickerFilterMedia, this.pickerFilters, callback);
        } else {
            this.loadSubFoldersAndFiles(this.baseFolder + "/", this.pickerFileExtension, this.pickerFilterMedia, this.pickerFilters, callback);
        }
    },
    methods: {
        changeSelectedDrive: function() {
            let that = this;
            //console.log("selected=" + this.selectedDrive);
            this.treeData = {};
            let callback = (baseOfFolderTree) => {
                that.treeData = baseOfFolderTree;
                that.showSpinner = false;
                that.spinnerMessage = '';
                that.disableDriveSelection = false;
            };
            this.disableDriveSelection = true;
            this.showSpinner = true;
            this.loadSubFoldersAndFiles(this.selectedDrive, this.pickerFileExtension, this.pickerFilterMedia, this.pickerFilters, callback);

        },
        close: function () {
            this.selectedFile_func(null);
        },
        selectFile: function (file) {
            this.selectedFile = file;
            let that = this;
            if (this.pickerShowThumbnail) {
                this.context.getByPath(file).thenApply(function(optFile){
                    let mediaFile = optFile.ref;
                    if (mediaFile != null) {
                        that.fileThumbnail = mediaFile.getBase64Thumbnail();
                    }
                });
            }
        },
        spinnerEnable: function () {
            this.showSpinner = true;
        },
        spinnerDisable: function () {
            this.showSpinner = false;
        },
        loadFolderLazily: function(path, callback) {
            this.loadSubFoldersAndFiles(path, this.pickerFileExtension, this.pickerFilterMedia, this.pickerFilters, callback);
        },
        fileSelected: function() {
            this.selectedFile_func(this.selectedFile, this.openForEditing);
        }
    }
}
</script>

<style>
/* global, and other views depend on them: kept as they were */
select{
    min-width: 300px;
    border: 2px solid var(--green-500);
    margin: 8px 0;
	color:var(--color);
	background-color: transparent;
	border-radious: 4px;
	padding: 0 16px;
	font-family: inherit;
	font-size: inherit;
	cursor: inherit;
	line-height: 48px;
}
.item {
  cursor: pointer;
  line-height: 1.5;
}
.bold {
  font-weight: bold;
}
.file-thumbnail {
    display: flex;
    justify-content: center;
    padding: 4px;
    border-radius: var(--radius-field);
    background-color: var(--pg-surface-2);
}
.file-thumbnail .cover {
    display: block;
    max-width: 100%;
    max-height: 160px;
}
</style>
