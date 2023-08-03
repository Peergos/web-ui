<template>
  <div class="drive-selected">
    <AppDropdown
      accent
      v-if="selectedFiles.length"
      aria-expanded="true"
      aria-label="Multi selection menu"
    >
      <template #trigger>
        <span> With {{ selectedFiles.length }} selected </span>
      </template>

      <ul>
        <slot></slot>
      </ul>
    </AppDropdown>
  </div>
</template>
<script>
const AppButton = require("../AppButton.vue");
const AppDropdown = require("../AppDropdown.vue");

module.exports = {
  components: {
    AppButton,
    AppDropdown,
  },
  props: {
    selectedFiles: {
      type: Array,
      default: () => [],
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
