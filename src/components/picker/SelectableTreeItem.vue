<template>
  <ul style="list-style-type: none">
        <div>
          <span @click="test" v-bind:id="model.path">{{ displayFolderName(model.path) }}</span>
          <span v-if="isFolder" @click="toggle">[{{ isOpen ? '-' : '+' }}]</span>
        </div>
    <li v-show="isOpen" v-if="isFolder" style="list-style-type: none">
      <SelectableTreeItem
        class="item"
        v-for="model in model.children"
        :model="model" :selectFolder_func="selectFolder_func" >
      </SelectableTreeItem>
    </li>
  </ul>
</template>

<script>
module.exports = {
  name: 'SelectableTreeItem', // necessary for self-reference
  props: {
    model: Object,
    selectFolder_func: Function
  },
  data() {
    return {
      isOpen: false,
    }
  },
  computed: {
    isFolder() {
      return this.model.children && this.model.children.length
    }
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
        }
    },
    test(selectedFolder) {
        this.selectFolder_func(selectedFolder.currentTarget.id);
    }
  }
}
</script>

<style>
</style>
