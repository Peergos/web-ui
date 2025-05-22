<template>
  <ul style="list-style-type: none;padding-inline-start: 20px;">
      <label class="checkbox__group">
          <input v-if="!model.isRoot" v-bind:id="model.path" type="checkbox" v-bind:value="model.path" @click="addChild">
          <span v-if="!model.isRoot" class="checkmark"></span>
            <div :class="{ bold: isFolder }" @click="toggle">
              {{ displayFolderName(model.path) }}
              <span v-if="isFolder">[{{ model.isOpen ? '-' : '+' }}]</span>
            </div>
    </label>
    <li v-show="model.isOpen" v-if="isFolder" style="list-style-type: none">
      <TreeItem
        class="item"
        v-for="model in children"
        :model="model"
        :selectFolder_func="selectFolder_func"
        :load_func="load_func"
        :spinnerEnable_func="spinnerEnable_func"
        :spinnerDisable_func="spinnerDisable_func"
        :initiallySelectedPaths="initiallySelectedPaths">
      </TreeItem>
    </li>
  </ul>
</template>

<script>
module.exports = {
  name: 'TreeItem', // necessary for self-reference
  props: {
    model: Object,
    selectFolder_func: Function,
    load_func: Function,
    spinnerEnable_func: Function,
    spinnerDisable_func: Function,
    initiallySelectedPaths: Array,
  },
  data() {
    return {
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
</style>
