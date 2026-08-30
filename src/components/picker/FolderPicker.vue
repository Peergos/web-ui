<template>
<transition name="modal">
<div class="pg-dialog__mask" @click="cancel">
    <div class="pg-dialog fp-picker" role="dialog" aria-modal="true" :aria-label="folderPickerTitle" tabindex="-1" ref="modal" @click.stop>
        <header class="pg-dialog__head">
            <h2 class="pg-dialog__title">{{ folderPickerTitle }}</h2>
            <DialogClose @close="cancel"/>
        </header>
        <div v-if="displayDriveSelection" class="fp-picker__drive">
            <select class="fp-select" v-model="selectedDrive" :disabled="disableDriveSelection" @change="changeSelectedDrive">
                <option v-for="option in driveOptions" :key="option.value" :value="option.value">{{ option.text }}</option>
            </select>
        </div>
        <div class="fp-picker__toolbar">
            <button type="button" class="pg-btn pg-btn--quiet fp-picker__new" @click="createFolder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
                {{ translate("FOLDER.PICKER.NEW") }}
            </button>
        </div>
        <div class="pg-dialog__body fp-picker__tree">
            <TreeItem
                :model="treeData"
                :multiple="multipleFolderSelection === true"
                :selectFolder_func="selectFolder"
                :clearSelection_func="clearSelection"
                :treeLabel="folderPickerTitle"
                :load_func="loadFolderLazily"
                :mkdir_func="mkdirAtPath"
                :selectedPaths="selectedFoldersList">
            </TreeItem>
        </div>
        <footer class="pg-dialog__foot">
            <div v-if="choices.length > 0" class="fp-picker__choices">
                <span v-if="choicesTitle" class="fp-selection__label">{{ choicesTitle }}</span>
                <label v-for="choice in choices" :key="choice.key" class="pg-switch">
                    <input type="checkbox" :checked="chosen[choice.key]" @change="setChoice(choice.key, $event.target.checked)">
                    <span class="pg-switch__track" aria-hidden="true"></span>
                    <span>{{ choice.label }}</span>
                </label>
            </div>
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
    <AppPrompt
        v-if="showMkdirPrompt"
        @hide-prompt="showMkdirPrompt = false"
        :message="translate('FOLDER.PICKER.NEW.IN')"
        :name="mkdirName"
        :placeholder="translate('FOLDER.PICKER.NEW.PLACEHOLDER')"
        :action="translate('FOLDER.PICKER.NEW.ACTION')"
        :consumer_func="onMkdirPrompt"
    />
</div>
</transition>
</template>

<script>
const AppPrompt = require("../prompt/AppPrompt.vue");
const DialogClose = require("../dialog/DialogClose.vue");
const Spinner = require("../spinner/Spinner.vue");
const TreeItem = require("TreeItem.vue");
const folderTreeMixin = require("../../mixins/tree-walker/index.js");
const SelectedPath = require("SelectedPath.vue");
const i18n = require("../../i18n/index.js");
const paths = require("../../mixins/paths/index.js");
const pick = require("../../mixins/folderselection/index.js");
const scrollShadow = require("../../mixins/scrollshadow/index.js");
const treeKeys = require("../../mixins/treekeys/index.js");
module.exports = {
    components: {
        AppPrompt,
        DialogClose,
        SelectedPath,
        Spinner,
        TreeItem
    },
    data: function() {
        return {
            showSpinner: false,
            showMkdirPrompt: false,
            mkdirTarget: null,
            treeData: {isRoot : true, children: []},
            selectedFoldersList: [],
            selectedDrive: "",
            driveOptions: [],
            displayDriveSelection: false,
            disableDriveSelection: false,
            folderPickerTitle: '',
            chosen: {},
        }
    },
    props: ['baseFolder', 'selectedFolder_func', 'multipleFolderSelection', 'initiallySelectedPaths', 'noDriveSelection', 'pickerTitle', 'pickerChoices', 'pickerChoicesTitle'],
    mixins:[folderTreeMixin, i18n, paths, pick, scrollShadow, treeKeys],
    computed: {
        ...Vuex.mapState([
            'context',
            'socialData',
            'mirrorBatId',
        ]),
        /** The folder a new one would go in. Passed whole: the prompt cuts it to fit. */
        mkdirName: function() {
            return this.pathLeaf(this.mkdirTarget);
        },
        friendnames: function() {
            return this.socialData.friends;
        },
        choices: function() {
            return this.pickerChoices != null ? this.pickerChoices : [];
        },
        choicesTitle: function() {
            return this.pickerChoicesTitle != null ? this.pickerChoicesTitle : "";
        },
    },
    created: function() {
        let that = this;
        this.folderPickerTitle = this.pickerTitle != null ? this.pickerTitle : this.translate("FOLDER.PICKER.TITLE");
        // start every choice off: the picker is recreated per use, and inheriting the
        // previous answer would silently apply it to the next folder
        this.choices.forEach(c => Vue.set(this.chosen, c.key, false));
        this.selectedFoldersList = this.initiallySelectedPaths.slice();
        let numberOfFriends = this.friendnames.length;
        let doNotShowDriveSelection = this.noDriveSelection !=null && this.noDriveSelection === true;
        let allowChangeOfDrive = !doNotShowDriveSelection && numberOfFriends > 0 && this.baseFolder === "/" + this.context.username;
        let callback = (baseOfFolderTree) => {
            that.treeData = baseOfFolderTree;
            that.showSpinner = false;
        };
        that.showSpinner = true;
        if(allowChangeOfDrive) {
            let homeDrive = "/" + this.context.username + '/';
            that.driveOptions.push({ text: 'Drive: ' + this.context.username, value: homeDrive});
            this.friendnames.forEach(f => {
                that.driveOptions.push({ text: 'Drive: ' + f, value: "/" + f + '/' });
            });
            this.selectedDrive = homeDrive;
            this.displayDriveSelection = true;
            this.loadSubFolders(homeDrive, callback);
        } else {
            this.loadSubFolders(this.baseFolder + "/", callback);
        }
    },
    mounted() {
        this.watchScrollShadow(".fp-picker__tree");
        this.bindTreeKeys(".fp-picker__tree");
    },
    methods: {
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
            this.loadSubFolders(this.selectedDrive, callback);
        },
        // dismissing leaves the caller with what it opened us with, so an unconfirmed
        // selection is discarded rather than applied
        cancel: function () {
            // same shape as a confirm, so a caller never has to check whether the
            // choices came back
            this.selectedFolder_func(this.initiallySelectedPaths.slice(), Object.assign({}, this.chosen));
        },
        loadFolderLazily: function(path, callback) {
            this.loadSubFolders(path, callback);
        },
        setChoice: function(key, value) {
            Vue.set(this.chosen, key, value);
        },
        // the tree row owns the reload of its own children, so creation is delegated to it
        treeItemFor: function(path) {
            let queue = this.$children.slice();
            while (queue.length > 0) {
                let child = queue.shift();
                if (child.model != null && (path == null ? child.model.isRoot : child.model.path === path))
                    return child;
                queue = queue.concat(child.$children);
            }
            return null;
        },
        createFolder: function() {
            let parent = this.selectedFoldersList.length === 1 ? this.selectedFoldersList[0] : null;
            let item = this.treeItemFor(parent) || this.treeItemFor(null);
            if (item == null)
                return;
            this.mkdirTarget = item.model.path;
            this.showMkdirPrompt = true;
        },
        onMkdirPrompt: function(name) {
            if (! name || ! name.trim())
                return;
            let that = this;
            let target = this.mkdirTarget;
            this.mkdirAtPath(target, name.trim(), function() {
                // the row owns its children, so it is the one that fetches them again
                let item = that.treeItemFor(target);
                if (item == null)
                    return;
                // made inside a branch the user had collapsed, the new folder is now the
                // selection: open the way down to it rather than selecting something unseen
                for (let up = item.$parent; up != null && up.model != null; up = up.$parent)
                    up.model.isOpen = true;
                item.loadChildren();
            });
        },
        mkdirAtPath: function(parentPath, newDirName, callback) {
            let that = this;
            this.showSpinner = true;
            let parent = parentPath.endsWith("/") ? parentPath.substring(0, parentPath.length - 1) : parentPath;
            let newPath = parent + "/" + newDirName;
            this.context.getByPath(parent).thenCompose(function(opt) {
                let dir = opt.get();
                let batId = dir.getOwnerName() == that.context.username ? that.mirrorBatId : java.util.Optional.empty();
                return dir.mkdir(newDirName, that.context.network, false, batId, that.context.crypto);
            }).thenApply(function(updatedDir) {
                that.showSpinner = false;
                if (!that.multipleFolderSelection) {
                    that.selectedFoldersList = [newPath];
                } else {
                    that.selectedFoldersList.push(newPath);
                }
                callback();
            }).exceptionally(function(throwable) {
                that.showSpinner = false;
                that.$toast.error(throwable.getMessage ? throwable.getMessage() : throwable.toString(), {timeout: false});
            });
        },
        foldersSelected: function() {
            this.selectedFolder_func(this.withoutNested(this.selectedFoldersList), Object.assign({}, this.chosen));
        }
    }
}
</script>

<style>
.fp-picker {
    width: 560px;
}
.fp-picker__drive {
    flex: 0 0 auto;
    padding: 0 20px 14px;
}
.fp-select {
    width: 100%;
    min-width: 0;
    height: 40px;
    margin: 0;
    padding: 0 12px;
    border: 1px solid var(--pg-track);
    border-radius: var(--radius-field);
    background-color: var(--pg-surface-2);
    color: var(--color);
    font-size: 14px;
    line-height: 38px;
    cursor: pointer;
}
.fp-picker__toolbar {
    display: flex;
    justify-content: flex-end;
    flex: 0 0 auto;
    padding: 0 12px 8px;
}

.fp-picker__tree {
    min-height: 220px;
    overflow-x: auto;
    padding: 8px 12px;
    border-top: 1px solid var(--pg-track);
    border-bottom: 1px solid var(--pg-track);
}

.fp-picker__choices {
    display: flex;
    flex-direction: column;
    /* the switch is an inline pill, as used in the sync and mount views: let each one size
       to its label instead of stretching across the dialog */
    align-items: flex-start;
    gap: 8px;
}
.fp-selection {
    display: flex;
    align-items: baseline;
    gap: 8px;
    min-width: 0;
    font-size: 13px;
}
.fp-selection__label {
    flex: 0 0 auto;
    color: var(--pg-muted);
}
.fp-selection__empty {
    color: var(--pg-muted);
}
.fp-selection__chips {
    max-height: 72px;
    overflow-y: auto;
}

</style>
