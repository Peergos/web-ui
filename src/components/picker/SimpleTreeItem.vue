<template>
  <ul class="fp-branch" :role="model.isRoot ? 'tree' : 'group'"
      :aria-label="model.isRoot ? treeLabel : null"
      :aria-multiselectable="model.isRoot && multiple ? 'true' : null">
    <li role="treeitem" :aria-expanded="isFolder ? (isOpen ? 'true' : 'false') : null"
          :aria-selected="ariaSelected">
      <label class="fp-row" tabindex="-1" @dblclick.prevent="toggle">
        <input class="fp-row__input" type="checkbox" tabindex="-1" :value="model.path"
            :checked="selectedPaths.includes(model.path)" @click.stop="onCheck">
        <span class="fp-row__bg"></span>
        <span class="fp-row__twisty" :class="{'fp-row__twisty--open': isOpen, 'fp-row__twisty--leaf': ! isFolder}"
              @click.stop.prevent="toggle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
        </span>
        <svg class="fp-row__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span class="fp-row__name">{{ pathLeaf(model.path) }}</span>
        <span class="fp-row__mark" :class="{'fp-row__mark--multi': multiple}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </span>
      </label>
    </li>
    <li v-show="isOpen" v-if="isFolder" class="fp-children">
      <SimpleTreeItem
        v-for="model in model.children"
        :key="model.path"
        :model="model"
        :multiple="multiple"
        :selectedPaths="selectedPaths"
        :treeLabel="treeLabel"
        :selectFolder_func="selectFolder_func"
        :loadFolder="loadFolder">
      </SimpleTreeItem>
    </li>
  </ul>
</template>

<script>
const paths = require("../../mixins/paths/index.js");

module.exports = {
  name: 'SimpleTreeItem', // necessary for self-reference
  mixins: [paths],
  props: {
    model: Object,
    multiple: Boolean,
    selectedPaths: Array,
    treeLabel: String,
    selectFolder_func: Function,
    loadFolder: Function
  },
  data() {
    return {
      isOpen: false,
    }
  },
  computed: {
    /** Only where more than one folder can be taken does an unselected row need to say so. */
    ariaSelected() {
      const selected = this.selectedPaths.includes(this.model.path);
      return this.multiple ? String(selected) : (selected ? 'true' : null);
    },
    isFolder() {
      return this.model.loadChildren || this.model.children && this.model.children.length
    },
  },
  created: function() {
    this.isOpen = this.model.initiallyOpen === true;
  },
  methods: {
    toggle() {
        if (this.isFolder) {
            this.isOpen = !this.isOpen
            if (this.model.loadChildren)
                this.loadFolder(this.model.path);
        }
    },
    onCheck(e) {
        this.selectFolder_func(e.currentTarget.value, e.currentTarget.checked);
    }
  }
}
</script>
