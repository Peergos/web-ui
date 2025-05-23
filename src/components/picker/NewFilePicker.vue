<template>
	<transition name="modal" appear>
		<div class="app-prompt app-modal__overlay" @click="closePrompt()">

			<div class="app-prompt__container" @click.stop>
				<header class="prompt__header">
					<AppButton class="close" icon="close" @click.native="closePrompt()"/>
					<h3>Create new &quot{{pickerFileExtension}}&quot file</h3>
				</header>
                <Spinner v-if="showSpinner" :message="spinnerMessage"></Spinner>
                <div class="prompt__body">
                    <select v-if="displayDriveSelection" v-model="selectedDrive" @change="changeSelectedDrive" :disabled='disableDriveSelection'>
                        <option v-for="option in driveOptions" v-bind:value="option.value">
                            {{ option.text }}
                          </option>
                    </select>
                </div>
                <div class="prompt__body">
                    <div class="folder-picker-view" class="scroll-style">
                      <ul>
                        <SelectableTreeItem class="item" :model="treeData" :load_func="loadFolderLazily" :select_func="selectFolder" :spinnerEnable_func="spinnerEnable" :spinnerDisable_func="spinnerDisable" :selectLeafOnly="selectLeafOnly"></SelectableTreeItem>
                      </ul>
                    </div>
                    <input style="background-color: lightgrey;"
                        v-model="folder_result"
                        type="text"
                        disabled="true"
                    >
                    </input>
                </div>
				<div class="prompt__body">
					<input
						v-if="placeholder"
						id="prompt-input"
						ref="prompt"
						v-model="prompt_result"
						type="text"
						:placeholder="placeholder"
						:maxlength="maxLength"
						@keyup.enter="getPrompt(this.prompt_result)"
						autofocus
					>
					</input>
				</div>
				<footer class="prompt__footer">
					<AppButton outline @click.native="closePrompt()">
						Cancel
					</AppButton>

					<AppButton
						id='prompt-button-id'
						type="primary"
						accent
						@click.native="getPrompt(this.prompt_result)"
					>
					{{action}}
					</AppButton>
				</footer>
			</div>
		</div>
	</transition>
</template>
const AppButton = require("../AppButton.vue");
const SelectableTreeItem = require("SelectableTreeItem.vue");
const Spinner = require("../spinner/Spinner.vue");
const folderTreeMixin = require("../../mixins/tree-walker/index.js");
<script>
module.exports = {
    components: {
        AppButton,
        SelectableTreeItem,
        Spinner,
    },
	data() {
		return {
			prompt_result: '',
			placeholder: '',
			value: '',
			max_input_size: 30,
			action: 'ok',
			folder_result: '',
            showSpinner: false,
            spinnerMessage: 'Loading...',
            treeData: {},
            selectLeafOnly: false,
            selectedDrive: "",
            driveOptions: [],
            displayDriveSelection: false,
            disableDriveSelection: false,
		}
	},
	props: {
		consumer_func: {
			type: Function
		},
        pickerFileExtension: {
            type: String,
            default: 'txt'
        }
	},
    mixins:[folderTreeMixin],
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
		}
	},

	mounted() {
		this.prompt_result = this.value;

		if(this.placeholder !== null){
			this.$refs.prompt.focus()
		}
	},
    created: function() {
        let that = this;
        this.placeholder = 'filename.' + this.pickerFileExtension;
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
            this.loadSubFolders(this.selectedDrive, callback);
        },

		closePrompt() {
			this.consumer_func(null);
			this.$emit("hide-prompt");
		},

		getPrompt() {
		    var filename = this.prompt_result;
		    if (filename.length > 0 && this.folder_result.length > 0) {
                if (!filename.endsWith("." + this.pickerFileExtension)) {
                    filename = filename + '.' + this.pickerFileExtension;
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
.app-prompt.app-modal__overlay{
	display:flex;
	align-items: center;
	justify-content: center;
}
.app-prompt__container{
	width: 400px;
	padding: 16px;
	border-radius: 4px;
	color: var(--color);
	background-color:var(--bg);
	box-shadow: 0 6px 16px rgba(0,0,0,0.15);
}
.prompt__header h3{
	border-top:0;
	font-weight: var(--regular);
}
.prompt__body{
	margin: 10px;
}
.prompt__footer{
	display: flex;
	justify-content: flex-end;
}
.prompt__footer button{
	margin-left: 16px;
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