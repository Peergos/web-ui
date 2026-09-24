<template>
  <ul class="fp-branch" :role="isRoot ? 'tree' : 'group'" :aria-label="isRoot ? treeLabel : null">
    <li role="treeitem" :aria-expanded="isFolder ? (model.isOpen ? 'true' : 'false') : null"
        :aria-selected="selectable ? (isSelected ? 'true' : 'false') : null">
      <div class="fp-row" :class="{'fp-row--selected': isSelected}" v-bind:id="model.path" tabindex="0"
           @click="onRowClick" @keyup.enter="onRowClick">
        <span class="fp-row__bg"></span>
        <span class="fp-row__twisty" :class="{'fp-row__twisty--open': model.isOpen, 'fp-row__twisty--leaf': ! isFolder}"
              @click.stop="toggle">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
        </span>
        <svg v-if="isLeaf" class="fp-row__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/></svg>
        <svg v-else class="fp-row__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span class="fp-row__name">{{ displayName(model.path) }}</span>
        <svg v-if="isSelected" class="fp-row__tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
      </div>
    </li>
    <li v-show="model.isOpen" v-if="isFolder" class="fp-children">
      <SelectableTreeItem
        v-for="child in model.children"
        :key="child.path"
        :model="child" :select_func="select_func" :load_func="load_func" :spinnerEnable_func="spinnerEnable_func"
        :spinnerDisable_func="spinnerDisable_func" :selectLeafOnly="selectLeafOnly" :selectedPath="selectedPath">
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
    selectedPath: String,
    treeLabel: String,
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
    },
    isRoot() {
      return this.$parent == null || this.$parent.$options.name !== 'SelectableTreeItem'
    },
    // with leaves only, a folder's row opens it rather than choosing it
    selectable() {
      return ! this.selectLeafOnly || this.isLeaf
    },
    isSelected() {
      return this.selectable && this.selectedPath != null && this.selectedPath === this.model.path
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
    onRowClick(e) {
        if (this.selectable)
            this.select_func(this.model.path);
        else
            this.toggle(e);
    }
  }
}
</script>

<style>
.fp-row--selected .fp-row__bg {
    background-color: var(--pg-tint-ok);
}
.fp-row--selected .fp-row__name {
    color: var(--pg-on-ok);
    font-weight: 600;
}
.fp-row--selected .fp-row__icon {
    color: var(--green-500);
}
.fp-row__tick {
    flex: 0 0 auto;
    width: 18px;
    height: 18px;
    color: var(--pg-on-ok);
}
</style>
