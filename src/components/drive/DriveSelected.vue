<template>
  <div class="drive-selected">
      <div style="display: ruby">
        <AppButton v-if="selectedFiles.length" round outline
            class="card__select"
            :class="{selected: totalFiles == selectedFiles.length}"
            :accent="totalFiles == selectedFiles.length"
            aria-label="Select All"
            @click.native="$emit('selectAllOrNone', 0 )">
        </AppButton>
        <AppDropdown
          accent
          v-if="selectedFiles.length"
          aria-expanded="true"
          aria-label="Multi selection menu"
        >
          <template #trigger>
            <span> {{ translate("DRIVE.WITH") }} {{ selectedFiles.length }} {{ translate("DRIVE.SELECTED") }} </span>
          </template>

          <ul>
            <slot></slot>
          </ul>
        </AppDropdown>
      </div>
  </div>
</template>
<script>
const AppButton = require("../AppButton.vue");
const AppDropdown = require("../AppDropdown.vue");
const i18n = require("../../i18n/index.js");

module.exports = {
  components: {
    AppButton,
    AppDropdown,
  },
  mixins:[i18n],
  props: {
    selectedFiles: {
      type: Array,
      default: () => [],
    },
    totalFiles: {
        type: Number,
        default: 0,
    },
  },
};
</script>
<style>
.drive-selected {
  margin: 16px 32px;
}

.drive-selected .count {
  margin-right: 32px;
  cursor: pointer;
}
</style>
