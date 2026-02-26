<template>
  <ul style="list-style-type: none;padding-inline-start: 20px;">
    <AppPrompt
      v-if="showMkdirPrompt"
      @hide-prompt="showMkdirPrompt = false"
      message="New folder name"
      placeholder="folder name"
      action="Create"
      :consumer_func="onMkdirPrompt"
    />
      <label class="checkbox__group">
          <input v-if="!model.isRoot" v-bind:id="model.path" type="checkbox" v-bind:value="model.path" @click="addChild">
          <span v-if="!model.isRoot" class="checkmark"></span>
            <span :class="{ bold: isFolder }" @click="toggle">
              {{ displayFolderName(model.path) }}
              <span v-if="isFolder">[{{ model.isOpen ? '-' : '+' }}]</span>
            </span>
            <button v-if="!model.isLeaf && mkdir_func" @click.stop="createSubfolder" class="mkdir-btn" title="New folder">+<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left:2px;vertical-align:middle"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></button>
    </label>
    <li v-show="model.isOpen" v-if="isFolder" style="list-style-type: none">
      <TreeItem
        class="item"
        v-for="model in children"
        :model="model"
        :selectFolder_func="selectFolder_func"
        :load_func="load_func"
        :mkdir_func="mkdir_func"
        :spinnerEnable_func="spinnerEnable_func"
        :spinnerDisable_func="spinnerDisable_func"
        :initiallySelectedPaths="initiallySelectedPaths">
      </TreeItem>
    </li>
  </ul>
</template>

<script>
const AppPrompt = require("../prompt/AppPrompt.vue");

module.exports = {
  name: 'TreeItem', // necessary for self-reference
  components: { AppPrompt },
  props: {
    model: Object,
    selectFolder_func: Function,
    load_func: Function,
    mkdir_func: Function,
    spinnerEnable_func: Function,
    spinnerDisable_func: Function,
    initiallySelectedPaths: Array,
  },
  data() {
    return {
      showMkdirPrompt: false,
    }
  },
  computed: {
    isFolder() {
      return this.model.children && this.model.children.length
    },
    children(){
        let child = [];
        for(var i = 0; i < this.model.children.length; i++){
            if (!this.model.children[i].lazy) {
                child.push(this.model.children[i]);
            }
        }
        return child
    }
  },
  created: function() {
        let that = this;
        Vue.nextTick(function() {
            let path = that.model.path;
            if (path != null) {
                let index = that.initiallySelectedPaths.findIndex(v => v === path);
                if (index > -1) {
                    let inputEl = document.getElementById(path);
                    if (inputEl != null) {
                        inputEl.checked = true;
                    }
                }
            }
        });
  },
  methods: {
    displayFolderName(folderName) {
        if (folderName == null) {
            return "";
        } else {
            let index = folderName.lastIndexOf('/');
            return folderName.substring(index + 1);
        }
    },
    toggle(e) {
        e.preventDefault()
        if (this.isFolder) {
            if (this.model.isOpen) {
                this.model.isOpen = !this.model.isOpen
            } else {
                this.lazyLoadSubFolders();
            }
        }
    },
    lazyLoadSubFolders() {
        let that = this;
        this.spinnerEnable_func();
        let callback = (baseOfSubFolderTree) => {
            that.model.children = [];
            for(var i=0; i < baseOfSubFolderTree.children.length; i++) {
                that.model.children.push(baseOfSubFolderTree.children[i]);
            }
            that.spinnerDisable_func();
            that.model.isOpen = !that.model.isOpen;
        };
        this.load_func(this.model.path + "/", callback);
    },
    reloadSubFolders() {
        let that = this;
        this.spinnerEnable_func();
        let callback = (baseOfSubFolderTree) => {
            that.model.children = [];
            for(var i=0; i < baseOfSubFolderTree.children.length; i++) {
                that.model.children.push(baseOfSubFolderTree.children[i]);
            }
            that.spinnerDisable_func();
            that.model.isOpen = true;
        };
        this.load_func(this.model.path + "/", callback);
    },
    createSubfolder() {
        this.showMkdirPrompt = true;
    },
    onMkdirPrompt(name) {
        if (!name || !name.trim()) return;
        let that = this;
        this.spinnerEnable_func();
        this.mkdir_func(this.model.path, name.trim(), () => {
            that.reloadSubFolders();
        });
    },
    addChild(selectedFolder) {
        let ok = this.selectFolder_func(selectedFolder.currentTarget.value, selectedFolder.currentTarget.checked);
        if (!ok) {
            selectedFolder.currentTarget.checked = false;
        }
    }
  }
}
</script>

<style>
.mkdir-btn {
    background: none;
    border: 1px solid var(--green-500, #22c55e);
    border-radius: 3px;
    color: var(--green-500, #22c55e);
    cursor: pointer;
    font-size: 0.75em;
    line-height: 1;
    margin-left: 6px;
    padding: 1px 5px;
    vertical-align: middle;
}
.mkdir-btn:hover {
    background-color: var(--green-500, #22c55e);
    color: var(--bg, white);
}
</style>
