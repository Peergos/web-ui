<template>
  <ul style="list-style-type: none">
        <div v-if="selectLeafOnly && isLeaf">
          <span @click="selectItem" v-bind:id="model.path">{{ displayName(model.path) }}</span>
        </div>
        <div v-if="selectLeafOnly && !isLeaf">
          <span v-bind:id="model.path">{{ displayName(model.path) }}</span>
          <span v-if="isFolder" @click="toggle">[{{ isOpen ? '-' : '+' }}]</span>
        </div>
        <div v-if="!selectLeafOnly">
          <span @click="selectItem" v-bind:id="model.path">{{ displayName(model.path) }}</span>
          <span v-if="isFolder" @click="toggle">[{{ isOpen ? '-' : '+' }}]</span>
        </div>
    <li v-show="isOpen" v-if="isFolder" style="list-style-type: none">
      <SelectableTreeItem
        class="item"
        v-for="model in model.children"
        :model="model" :select_func="select_func" :selectLeafOnly="selectLeafOnly">
      </SelectableTreeItem>
    </li>
  </ul>
</template>

<script>
module.exports = {
  name: 'SelectableTreeItem', // necessary for self-reference
  props: {
    model: Object,
    select_func: Function,
    selectLeafOnly: {
        type: Boolean,
        default: false,
    }
  },
  data() {
    return {
      isOpen: false,
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
            this.isOpen = !this.isOpen
        }
    },
    selectItem(selectedItem) {
        this.select_func(selectedItem.currentTarget.id);
    }
  }
}
</script>

<style>
</style>
