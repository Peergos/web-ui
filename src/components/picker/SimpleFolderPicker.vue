<template>
<transition name="modal">
<div class="modal-mask" @click="close">
    <meta http-equiv="content-type" content="text/html; charset=utf-8" />
    <div @click.stop class="simple-folder-picker-container">
        <span @click="close" tabindex="0" v-on:keyup.enter="close" aria-label="close" class="close">&times;</span>
        <div class="modal-header">
            <h2>{{ folderPickerTitle }}</h2>
        </div>
        <div class="modal-body">
            <Spinner v-if="showSpinner" :message="spinnerMessage"></Spinner>
            <select v-model="selectedDrive" @change="changeSelectedDrive" :disabled='disableDriveSelection'>
                <option v-for="option in driveOptions" v-bind:value="option.value">
                    {{ option.text }}
                  </option>
            </select>
            <div class="folder-picker-view" class="scroll-style-simple-folder">
              <ul style="padding-inline-start: 10px;">
                <SimpleTreeItem class="item" :model="treeData" :selectFolder_func="selectFolder" :loadFolder="this.preloadFolders_func"></SimpleTreeItem>
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
                <div class="selected-folders-view">
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
const SimpleTreeItem = require("SimpleTreeItem.vue");
const i18n = require("../../i18n/index.js");
module.exports = {
    components: {
        Spinner,
        SimpleTreeItem,
        i18n
    },
    data: function() {
        return {
            showSpinner: true,
            spinnerMessage: 'Loading folders...',
            treeData: {},
            selectedFoldersList: [],
            selectedDrive: "",
            disableDriveSelection: false,
            driveOptions: [],
            folderPickerTitle: 'Folder Picker',
        }
    },
    props: ['selectedFolder_func','preloadFolders_func','multipleFolderSelection', 'drives', 'pickerTitle'],
    mixins:[i18n],
    computed: {
        ...Vuex.mapState([
            'context',
        ]),
    },
    created: function() {
        if (this.pickerTitle != null) {
            this.folderPickerTitle = this.pickerTitle;
        }
        let that = this;
        this.drives.forEach(f => {
            that.driveOptions.push({ text: 'Drive: ' + f, value: f });
        });
        this.selectedDrive = this.drives[0];
        let callback = (baseOfFolderTree) => {
            that.treeData = baseOfFolderTree;
            that.showSpinner = false;
            that.spinnerMessage = '';
        };
        this.preloadFolders_func(this.selectedDrive, callback);
    },
    methods: {
        close: function () {
            this.selectedFolder_func([]);
        },
        showError: function(msg) {
            console.log(msg);
            this.$toast.error(msg, {timeout:false});
        },
        changeSelectedDrive: function() {
            let that = this;
            //console.log("selected=" + this.selectedDrive);
            this.treeData = {isRoot : true, children: []};
            let callback = (baseOfFolderTree) => {
                that.treeData = baseOfFolderTree;
                that.showSpinner = false;
                that.spinnerMessage = '';
                that.disableDriveSelection = false;
            };
            this.disableDriveSelection = true;
            this.showSpinner = true;
            this.preloadFolders_func(this.selectedDrive, callback);
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
@media (max-width: 600px) {
    .simple-folder-picker-container{
        width: 100%;
    }
}
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
.simple-folder-picker-container {
    height: 100%;
    min-width: 600px;
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
    max-height: 250px;
    overflow-y: scroll;
    border: 2px solid var(--green-500);
    margin: 8px 0;
}
.item {
  cursor: pointer;
  line-height: 1.5;
}
.bold {
  font-weight: bold;
}
.scroll-style-simple-folder {
    max-height: 250px;
    overflow-y: scroll;
    border: 2px solid var(--green-500);
    margin: 8px 0;
}
</style>
