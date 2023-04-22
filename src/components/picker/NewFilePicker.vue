<template>
	<transition name="modal" appear>
		<div class="app-prompt app-modal__overlay" @click="closePrompt()">

			<div class="app-prompt__container" @click.stop>
				<header class="prompt__header">
					<AppButton class="close" icon="close" @click.native="closePrompt()"/>
					<h3>Create new &quot{{pickerFileExtension}}&quot file</h3>
				</header>
                <spinner v-if="showSpinner"></spinner>
                <div class="prompt__body">
                    <div class="folder-picker-view" class="scroll-style">
                      <ul>
                        <SelectableTreeItem class="item" :model="treeData" :selectFolder_func="selectFolder"></SelectableTreeItem>
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
const SelectableTreeItem = require("SelectableTreeItem.vue");
const folderTreeMixin = require("../../mixins/folder/index.js");
<script>
module.exports = {
    components: {
        SelectableTreeItem
    },
	data() {
		return {
			prompt_result: '',
			placeholder: '',
			value: '',
			max_input_size: 30,
			action: 'ok',
			folder_result: '',
            showSpinner: true,
            spinnerMessage: 'Loading...',
            treeData: {},
            walkCounter: 0,
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
        ]),
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
        let callback = (baseOfFolderTree) => {
            that.treeData = baseOfFolderTree;
            that.showSpinner = false;
            that.spinnerMessage = '';
        };
        this.loadFolders(this.context.username + "/", callback);
    },
	methods: {
		closePrompt() {
			this.consumer_func(null);
			this.$emit("hide-prompt");
		},

		getPrompt() {
		    var filename = this.prompt_result;
		    if (!filename.endsWith(this.pickerFileExtension)) {
		        filename = filename + '.' + this.pickerFileExtension;
		    }
			this.consumer_func(filename, this.folder_result);
			this.$emit("hide-prompt");
		},

        selectFolder: function (folderName) {
            this.folder_result = folderName;
        },
	}
}

</script>

<style>
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
	margin: var(--app-margin) 0;
}
.prompt__footer{
	display: flex;
	justify-content: flex-end;
}
.prompt__footer button{
	margin-left: 16px;
}

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