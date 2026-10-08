<template>
	<transition name="modal" appear>
		<div class="pg-dialog__mask" @click="closePrompt()">
			<div class="pg-dialog fp-picker" role="dialog" aria-modal="true" :aria-label="title" @click.stop>
				<header class="pg-dialog__head">
					<h2 class="pg-dialog__title">{{title}}</h2>
					<DialogClose @close="closePrompt()"/>
				</header>
				<div v-if="displayDriveSelection" class="fp-picker__drive">
					<select class="fp-select" v-model="selectedDrive" @change="changeSelectedDrive" :disabled='disableDriveSelection'>
						<option v-for="option in driveOptions" :key="option.value" v-bind:value="option.value">{{ option.text }}</option>
					</select>
				</div>
				<div class="pg-dialog__body fp-picker__tree">
					<SelectableTreeItem :model="treeData" :load_func="loadFolderLazily" :select_func="selectFolder"
						:spinnerEnable_func="spinnerEnable" :spinnerDisable_func="spinnerDisable"
						:selectLeafOnly="selectLeafOnly" :selectedPath="folder_result" :treeLabel="title"></SelectableTreeItem>
				</div>
				<footer class="pg-dialog__foot">
					<div class="fp-selection">
						<template v-if="folder_result">
							<span class="fp-selection__label">{{ translate("FOLDER.PICKER.SELECTED") }}</span>
							<SelectedPath :path="folder_result"/>
						</template>
						<span v-else class="fp-selection__empty">{{ translate("FOLDER.PICKER.NO.FOLDER") }}</span>
					</div>
					<div class="new-file__name">
						<input
							id="prompt-input"
							ref="prompt"
							class="pg-input"
							v-model="prompt_result"
							type="text"
							:placeholder="placeholder"
							:maxlength="maxLength"
							@keyup.enter="getPrompt()"
						>
						<select v-if="pickerMultipleFileExtensions.length > 0" class="fp-select new-file__extension" v-model="selectedFileExtension" @change="changeSelectedFileExtension">
							<option v-for="option in fileExtensionOptions" :key="option.value" v-bind:value="option.value">{{ option.text }}</option>
						</select>
					</div>
					<div class="pg-dialog__actions">
						<span class="pg-dialog__spacer"></span>
						<button type="button" class="pg-btn" @click="closePrompt()">{{ translate("PROMPT.CANCEL") }}</button>
						<button type="button" id='prompt-button-id' class="pg-btn pg-btn--primary" :disabled="! canSubmit" @click="getPrompt()">{{action}}</button>
					</div>
				</footer>
				<div v-if="showSpinner" class="pg-dialog__loading"><Spinner :message="spinnerMessage"></Spinner></div>
			</div>
		</div>
	</transition>
</template>
<script>
const DialogClose = require("../dialog/DialogClose.vue");
const SelectableTreeItem = require("SelectableTreeItem.vue");
const SelectedPath = require("SelectedPath.vue");
const Spinner = require("../spinner/Spinner.vue");
const folderTreeMixin = require("../../mixins/tree-walker/index.js");
const i18n = require("../../i18n/index.js");
module.exports = {
    components: {
        DialogClose,
        SelectableTreeItem,
        SelectedPath,
        Spinner,
    },
	data() {
		return {
			prompt_result: '',
			placeholder: '',
			max_input_size: 30,
			action: 'OK',
			folder_result: '',
            showSpinner: false,
            spinnerMessage: 'Loading...',
            treeData: {},
            selectLeafOnly: false,
            selectedDrive: "",
            driveOptions: [],
            displayDriveSelection: false,
            disableDriveSelection: false,
            title: "",
            selectedFileExtension: "",
            fileExtensionOptions: [],
		}
	},
	props: {
		consumer_func: {
			type: Function
		},
        pickerFileExtension: {
            type: String,
            default: 'txt'
        },
        initialFilename: {
            type: String,
            default: ''
        },
        pickerMultipleFileExtensions: {
            type: Array,
            default: []
        },
	},
    mixins:[folderTreeMixin, i18n],
	computed: {
        ...Vuex.mapState([
            'context',
            'socialData',
        ]),
        friendnames: function() {
            return this.socialData.friends;
        },
		maxLength() {
			return this.max_input_size;
		},
		// a name and a folder to put it in, the two things getPrompt needs before it does anything
		canSubmit() {
			return this.prompt_result.length > 0 && this.folder_result.length > 0;
		}
	},

	mounted() {
		this.prompt_result = this.initialFilename;

		if(this.placeholder !== null){
			this.$refs.prompt.focus()
		}
	},
    created: function() {
        let that = this;
        if (this.pickerMultipleFileExtensions.length == 0) {
            this.title = "Create new '" + this.pickerFileExtension + "' file";
            this.placeholder = 'filename.' + this.pickerFileExtension;
        } else {
            let defaultFileExtension = this.pickerMultipleFileExtensions[0].extension;
            this.title = "Create new File";
            this.placeholder = 'filename.' + defaultFileExtension;
            this.selectedFileExtension = defaultFileExtension;
            this.pickerMultipleFileExtensions.forEach(fileExtension => {
                that.fileExtensionOptions.push({ text: fileExtension.name + ' - ' + fileExtension.extension, value: fileExtension.extension });
            });
        }
        this.showSpinner = true;
        let callback = (baseOfFolderTree) => {
            that.treeData = baseOfFolderTree;
            that.showSpinner = false;
            that.spinnerMessage = '';
        };
        let numberOfFriends = this.friendnames.length;
        let allowChangeOfDrive = numberOfFriends > 0;
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
            this.loadSubFolders(this.context.username + "/", callback);
        }
    },
	methods: {
        changeSelectedDrive: function() {
            let that = this;
            this.treeData = {};
            let callback = (baseOfFolderTree) => {
                that.treeData = baseOfFolderTree;
                that.showSpinner = false;
                that.spinnerMessage = '';
                that.disableDriveSelection = false;
            };
            this.disableDriveSelection = true;
            this.showSpinner = true;
            this.loadSubFolders(this.selectedDrive, callback);
        },
        changeSelectedFileExtension: function() {
            let that = this;
            this.placeholder = 'filename.' + this.selectedFileExtension;
        },
		closePrompt() {
			this.consumer_func(null);
			this.$emit("hide-prompt");
		},

		getPrompt() {
		    var filename = this.prompt_result;
		    if (filename.length > 0 && this.folder_result.length > 0) {
                if (this.pickerMultipleFileExtensions.length == 0) {
                    if (!filename.endsWith("." + this.pickerFileExtension)) {
                        filename = filename + '.' + this.pickerFileExtension;
                    }
                } else {
                    if (!filename.endsWith("." + this.selectedFileExtension)) {
                        filename = filename + '.' + this.selectedFileExtension;
                    }
                }
                this.consumer_func(filename, this.folder_result);
                this.$emit("hide-prompt");
            }
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
        selectFolder: function (folderName) {
            this.folder_result = folderName;
        },
	}
}

</script>

<style>
/* the name and, where the app offers several, the type side by side under the tree */
.new-file__name {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}

.new-file__name .pg-input {
	flex: 1 1 200px;
}

.new-file__name .new-file__extension {
	flex: 1 1 160px;
	min-width: 0;
	margin: 0;
}
</style>
