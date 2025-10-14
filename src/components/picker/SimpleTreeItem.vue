<template>
  <ul style="list-style-type: none; padding-inline-start: 20px;">
      <label class="checkbox__group">
          <input type="checkbox" v-bind:value="model.path" @click="addChild">
          <span class="checkmark"></span>
            <div :class="{ bold: isFolder }" @click="toggle">
              {{ displayFolderName(model.path) }}
              <span v-if="isFolder">[{{ isOpen ? '-' : '+' }}]</span>
            </div>
    </label>
    <li v-show="isOpen" v-if="isFolder" style="list-style-type: none">
      <TreeItem
        class="item"
        v-for="model in model.children"
        :model="model" :selectFolder_func="selectFolder_func" :loadFolder="loadFolder" >
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
    loadFolder: Function
  },
  data() {
    return {
      isOpen: false,
    }
  },
  computed: {
    isFolder() {
      return this.model.loadChildren || this.model.children && this.model.children.length
    }
  },
  created: function() {
    this.isOpen = this.model.initiallyOpen && this.model.initiallyOpen == true;
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
            this.isOpen = !this.isOpen
            if (this.model.loadChildren)
                this.loadFolder(this.model.path);
        }
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
