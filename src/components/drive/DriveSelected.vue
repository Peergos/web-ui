<template>
  <div class="drive-selected">
      <div class="drive-selected__inner">
        <AppButton v-if="selectedFiles.length" round outline
            class="card__select"
            :class="{selected: totalFiles == selectedFiles.length}"
            :accent="totalFiles == selectedFiles.length"
            aria-label="Select All"
            @click.native="$emit('selectAllOrNone', 0 )">
        </AppButton>
        <AppDropdown
          v-if="selectedFiles.length"
          icon="chevron-down"
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
/* The count is the one thing you need while working through a long list, so it
   stays at the top of the view rather than scrolling away with the first rows. */
.drive-selected {
  position: sticky;
  /* under the header, which pins above it */
  top: 56px;
  z-index: 20;
  margin: 0;
  padding: 0 32px;
  background-color: var(--bg);
  border-bottom: 1px solid var(--border-color);
}

.drive-selected__inner {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 56px;
}

.drive-selected .card__select {
  width: 24px;
  height: 24px;
  flex: none;
  padding: 0;
  color: var(--green-500);
}

/* the count reads as a state, not as the page's main action: the pill and the
   ok tone the status cards use, rather than a filled accent button */
.drive-selected .app-dropdown .app-button {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 6px 14px;
  font-size: var(--text-small);
  font-weight: var(--bold);
  line-height: 1.2;
  color: var(--pg-on-ok);
  background-color: var(--pg-tint-ok);
  border-radius: var(--radius-pill);
}

/* the caret says the count opens the actions for the selection */
.drive-selected .app-dropdown .app-button svg {
  width: 14px;
  height: 14px;
  margin-left: 8px;
}

/* --pg-on-ok and --green-200 are the same #63e3bd in dark mode, so a tint-and-ink
   hover erased the label. The primary pair is contrast-checked in both themes, and
   going tinted-to-solid on hover is what .pg-btn--pause already does. */
.drive-selected .app-dropdown .app-button:hover {
  color: var(--pg-on-primary) !important;
  background-color: var(--pg-primary);
}

@media (max-width: 1024px) {
  .drive-selected {
    top: 0;
    padding: 0 16px;
  }

  .drive-selected .app-dropdown .app-button {
    min-height: 44px;
  }

  /* a 24px ring with a 44px target around it */
  .drive-selected .card__select {
    position: relative;
  }

  .drive-selected .card__select:after {
    content: "";
    position: absolute;
    top: -10px;
    right: -10px;
    bottom: -10px;
    left: -10px;
  }
}
</style>
