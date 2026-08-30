<template>
<transition name="modal">
<div class="pg-dialog__mask" @click="cancel">
    <div class="pg-dialog fp-picker" role="dialog" aria-modal="true" :aria-label="folderPickerTitle" tabindex="-1" ref="modal" @click.stop>
        <header class="pg-dialog__head">
            <h2 class="pg-dialog__title">{{ folderPickerTitle }}</h2>
            <DialogClose @close="cancel"/>
        </header>
        <div v-if="driveOptions.length > 1" class="fp-picker__drive">
            <select class="fp-select" v-model="selectedDrive" :disabled="disableDriveSelection" @change="changeSelectedDrive">
                <option v-for="option in driveOptions" :key="option.value" :value="option.value">{{ option.text }}</option>
            </select>
        </div>
        <div class="pg-dialog__body fp-picker__tree">
            <SimpleTreeItem
                v-if="treeData.path != null"
                :model="treeData"
                :multiple="multipleFolderSelection === true"
                :selectedPaths="selectedFoldersList"
                :selectFolder_func="selectFolder"
                :treeLabel="folderPickerTitle"
                :loadFolder="preloadFolders_func">
            </SimpleTreeItem>
        </div>
        <footer class="pg-dialog__foot">
            <div class="fp-selection">
                <span v-if="hasSelection" class="fp-selection__label">{{ translate("FOLDER.PICKER.SELECTED") }}</span>
                <span v-if="! hasSelection" class="fp-selection__empty">{{ emptyLabel }}</span>
                <SelectedPath v-else-if="! multipleFolderSelection" :path="selectedFoldersList[0]"/>
                <span v-else class="pg-chips fp-selection__chips">
                    <span v-for="folder in selectedFoldersList" :key="folder" class="pg-chip" :title="folder">{{ pathLeaf(folder) }}</span>
                </span>
            </div>
            <div class="pg-dialog__actions">
                <span class="pg-dialog__spacer"></span>
                <button type="button" class="pg-btn" @click="cancel">{{ translate("FOLDER.PICKER.CANCEL") }}</button>
                <button type="button" class="pg-btn pg-btn--primary" :disabled="! hasSelection" @click="foldersSelected()">{{ translate("FOLDER.PICKER.SELECT") }}</button>
            </div>
        </footer>
    </div>
    <div v-if="showSpinner" class="pg-dialog__loading"><Spinner/></div>
</div>
</transition>
</template>

<script>

const DialogClose = require("../dialog/DialogClose.vue");
const SelectedPath = require("SelectedPath.vue");
const Spinner = require("../spinner/Spinner.vue");
const SimpleTreeItem = require("SimpleTreeItem.vue");
const i18n = require("../../i18n/index.js");
const paths = require("../../mixins/paths/index.js");
const pick = require("../../mixins/folderselection/index.js");
const scrollShadow = require("../../mixins/scrollshadow/index.js");
const treeKeys = require("../../mixins/treekeys/index.js");
module.exports = {
    components: {
        SelectedPath,
        DialogClose,
        Spinner,
        SimpleTreeItem
    },
    data: function() {
        return {
            showSpinner: true,
            treeData: {},
            selectedFoldersList: [],
            selectedDrive: "",
            disableDriveSelection: false,
            driveOptions: [],
            folderPickerTitle: '',
        }
    },
    props: ['selectedFolder_func','preloadFolders_func','multipleFolderSelection', 'drives', 'pickerTitle'],
    mixins:[i18n, paths, pick, scrollShadow, treeKeys],
    computed: {
        ...Vuex.mapState([
            'context',
        ]),
    },
    created: function() {
        this.folderPickerTitle = this.pickerTitle != null ? this.pickerTitle : this.translate("FOLDER.PICKER.TITLE");
        let that = this;
        this.drives.forEach(f => {
            that.driveOptions.push({ text: 'Drive: ' + f, value: f });
        });
        this.selectedDrive = this.drives[0];
        let callback = (baseOfFolderTree) => {
            that.treeData = baseOfFolderTree;
            that.showSpinner = false;
        };
        this.preloadFolders_func(this.selectedDrive, callback);
    },
    mounted() {
        this.watchScrollShadow(".fp-picker__tree");
        this.bindTreeKeys(".fp-picker__tree");
    },
    methods: {
        cancel: function () {
            this.selectedFolder_func([]);
        },
        changeSelectedDrive: function() {
            let that = this;
            this.treeData = {isRoot : true, children: []};
            let callback = (baseOfFolderTree) => {
                that.treeData = baseOfFolderTree;
                that.showSpinner = false;
                that.disableDriveSelection = false;
            };
            this.disableDriveSelection = true;
            this.showSpinner = true;
            this.preloadFolders_func(this.selectedDrive, callback);
        },
        foldersSelected: function() {
            this.selectedFolder_func(this.withoutNested(this.selectedFoldersList));
        }
    }
}
</script>
