<template>
  <ul style="list-style-type: none">
        <div v-if="selectLeafOnly && isLeaf">
          <span @click="selectItem" v-bind:id="model.path">{{ displayName(model.path) }}</span>
        </div>
        <div v-if="selectLeafOnly && !isLeaf">
          <span v-bind:id="model.path">{{ displayName(model.path) }}</span>
          <span v-if="isFolder" @click="toggle">[{{ model.isOpen ? '-' : '+' }}]</span>
        </div>
        <div v-if="!selectLeafOnly">
          <span @click="selectItem" v-bind:id="model.path">{{ displayName(model.path) }}</span>
          <span v-if="isFolder" @click="toggle">[{{ model.isOpen ? '-' : '+' }}]</span>
        </div>
    <li v-show="model.isOpen" v-if="isFolder" style="list-style-type: none">
      <SelectableTreeItem
        class="item"
        v-for="model in model.children"
        :model="model" :select_func="select_func" :load_func="load_func" :spinnerEnable_func="spinnerEnable_func" :spinnerDisable_func="spinnerDisable_func" :selectLeafOnly="selectLeafOnly">
      </SelectableTreeItem>
    </li>
  </ul>
</template>

<script>
module.exports = {
  name: 'SelectableTreeItem', // necessary for self-reference
  props: {
    model: Object,
    load_func: Function,
    select_func: Function,
    selectLeafOnly: {
        type: Boolean,
        default: false,
    },
    spinnerEnable_func: Function,
    spinnerDisable_func: Function,
  },
  data() {
    return {
    }
  },
  computed: {
    isFolder() {
      return this.model.children && this.model.children.length
    },
    isLeaf() {
      return this.model.isLeaf === true
    }
  },
  methods: {
    displayName(name) {
        if (name == null) {
            return "";
        } else {
            let index = name.lastIndexOf('/');
            return name.substring(index + 1);
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
    selectItem(selectedItem) {
        this.select_func(selectedItem.currentTarget.id);
    }
  }
}
</script>

<style>
</style>
