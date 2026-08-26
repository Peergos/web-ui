<template>
  <ul class="fp-branch" :role="model.isRoot ? 'tree' : 'group'"
      :aria-label="model.isRoot ? treeLabel : null"
      :aria-multiselectable="model.isRoot && multiple ? 'true' : null">
    <li role="treeitem" :aria-expanded="isFolder ? (model.isOpen ? 'true' : 'false') : null"
          :aria-busy="loading ? 'true' : null"
          :aria-selected="ariaSelected">
      <label class="fp-row" tabindex="-1" @click="onRowClick" @dblclick.prevent="toggle">
        <input v-if="! model.isRoot" class="fp-row__input" type="checkbox" tabindex="-1" :value="model.path"
              :checked="selectedPaths.includes(model.path)" @click.stop="onCheck">
        <span class="fp-row__bg"></span>
        <span class="fp-row__twisty" :class="{'fp-row__twisty--open': model.isOpen && ! loading, 'fp-row__twisty--leaf': ! isFolder}"
              @click.stop.prevent="toggle">
          <svg v-if="loading" class="fp-row__busy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-3-6.7"/></svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
        </span>
        <svg class="fp-row__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <span class="fp-row__name">{{ pathLeaf(model.path) }}</span>
        <span v-if="! model.isRoot" class="fp-row__mark" :class="{'fp-row__mark--multi': multiple}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        </span>
      </label>
    </li>
    <li v-show="model.isOpen" v-if="isFolder" class="fp-children">
      <TreeItem
        v-for="model in children"
        :key="model.path"
        :model="model"
        :multiple="multiple"
        :selectFolder_func="selectFolder_func"
        :clearSelection_func="clearSelection_func"
        :load_func="load_func"
        :selectedPaths="selectedPaths"
        :treeLabel="treeLabel">
      </TreeItem>
    </li>
  </ul>
</template>

<script>
const paths = require("../../mixins/paths/index.js");

module.exports = {
  name: 'TreeItem', // necessary for self-reference
  mixins: [paths],
  props: {
    model: Object,
    multiple: Boolean,
    selectFolder_func: Function,
    clearSelection_func: Function,
    load_func: Function,
    selectedPaths: Array,
    treeLabel: String,
  },
  data() {
    return {
      loading: false,
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
  methods: {
    // the root has no checkbox, so its row is the only way to expand it
    onRowClick(e) {
        if (! this.model.isRoot)
            return;
        e.preventDefault();
        // the root is the one row that cannot be picked, so clicking it takes the
        // selection back rather than leaving a path the user has moved away from
        if (! this.multiple && this.clearSelection_func != null)
            this.clearSelection_func();
        this.toggle();
    },
    toggle() {
        if (! this.isFolder)
            return;
        if (this.model.isOpen)
            this.model.isOpen = false;
        else
            this.loadChildren();
    },
    // opening and reopening after a new folder are the same load, and a second one while
    // the first is in flight would fight it for the row's open state
    loadChildren() {
        if (this.loading)
            return;
        let that = this;
        this.loading = true;
        this.load_func(this.model.path + "/", (baseOfSubFolderTree) => {
            that.model.children = baseOfSubFolderTree.children.slice();
            that.model.isOpen = true;
            that.loading = false;
        });
    },
    onCheck(e) {
        this.selectFolder_func(e.currentTarget.value, e.currentTarget.checked);
    }
  }
}
</script>

<style>
.fp-branch, .fp-children {
    list-style: none;
    margin: 0;
    padding: 0;
}
.fp-children {
    margin-inline-start: 13px;
    padding-inline-start: 13px;
    border-inline-start: 1px solid var(--pg-track, rgba(127, 137, 147, 0.25));
}
.fp-row {
    /* every level indents, so without a floor the name ellipsises away a few levels
       down on a phone; the tree pans sideways instead */
    min-width: 240px;
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 0 10px;
    border-radius: var(--radius-field);
    color: var(--color);
    cursor: pointer;
    font-size: 15px;
    font-weight: normal;
    margin: 0;
    -webkit-user-select: none;
    user-select: none;
}
.fp-row > * {
    position: relative;
}
.fp-row__input {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: 0;
    opacity: 0;
}
.fp-row__bg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    border-radius: var(--radius-field);
    pointer-events: none;
    transition: background-color 0.12s ease;
}
.fp-row:hover .fp-row__bg {
    background-color: var(--pg-surface-2);
}
.fp-row:focus-visible {
    outline: 2px solid var(--green-500);
    /* inside the row: an outline outside it is clipped by the scrolling tree */
    outline-offset: -2px;
}
.fp-row__input:checked ~ .fp-row__bg {
    background-color: var(--pg-tint-ok, rgba(38, 185, 154, 0.14));
}
.fp-row__input:checked ~ .fp-row__name {
    color: var(--pg-on-ok, var(--green-500));
    font-weight: 600;
}
.fp-row__input:checked ~ .fp-row__icon {
    color: var(--green-500);
}
.fp-row__input:checked ~ .fp-row__mark {
    border-color: var(--green-500);
    background-color: var(--green-500);
    color: #fff;
}
.fp-row__input:checked ~ .fp-row__mark svg {
    opacity: 1;
}
.fp-row__twisty {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 28px;
    height: 28px;
    border-radius: var(--radius-control);
    color: var(--pg-muted);
    transition: transform 0.15s ease, background-color 0.12s ease;
}
.fp-row__twisty:hover {
    background-color: var(--pg-track, rgba(127, 137, 147, 0.25));
    color: var(--color);
}
.fp-row__twisty--open {
    transform: rotate(90deg);
}
.fp-row__twisty--leaf {
    visibility: hidden;
}
.fp-row__busy {
    animation: fp-spin 0.9s linear infinite;
}
@keyframes fp-spin {
    to { transform: rotate(360deg); }
}
@media (prefers-reduced-motion: reduce) {
    .fp-row__busy {
        animation: none;
    }
}
.fp-row__twisty svg {
    width: 16px;
    height: 16px;
}
.fp-row__icon {
    flex: 0 0 auto;
    width: 20px;
    height: 20px;
    color: var(--pg-muted);
}
.fp-row__name {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.fp-row__mark {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 22px;
    height: 22px;
    border: 2px solid var(--pg-track, rgba(127, 137, 147, 0.4));
    border-radius: 50%;
    color: transparent;
    transition: background-color 0.12s ease, border-color 0.12s ease;
}
.fp-row__mark--multi {
    border-radius: 6px;
}
.fp-row__mark svg {
    width: 14px;
    height: 14px;
    opacity: 0;
    transition: opacity 0.12s ease;
}
</style>
