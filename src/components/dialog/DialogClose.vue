<template>
  <button type="button" class="pg-dialog__close" :aria-label="translate('DIALOG.CLOSE')" @click="$emit('close')">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
  </button>
</template>

<script>
const i18n = require("../../i18n/index.js");

// Every dialog carries exactly one of these, so the keyboard is handled here rather than in
// each dialog. Only the most recently opened one reacts, which is what lets a prompt sit above
// a picker: Escape closes the prompt and leaves the picker alone.
const open = [];
let listening = false;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]),'
    + ' textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(dialog) {
    return Array.prototype.filter.call(dialog.querySelectorAll(FOCUSABLE),
        el => el.getClientRects().length > 0);
}

function onKeyDown(e) {
    if (open.length === 0)
        return;
    const top = open[open.length - 1];
    if (e.key === "Escape") {
        e.stopPropagation();
        top.$emit("close");
        return;
    }
    // the dialogs are aria-modal, so the tab order has to stay inside the top one
    if (e.key !== "Tab")
        return;
    const dialog = top.$el.closest(".pg-dialog");
    if (dialog == null)
        return;
    const items = focusableIn(dialog);
    if (items.length === 0)
        return;
    const edge = e.shiftKey ? items[0] : items[items.length - 1];
    if (document.activeElement === edge || ! dialog.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? items[items.length - 1] : items[0]).focus();
    }
}

// The page behind a dialog must not move under the finger. Taking its scrollbar away
// would widen the page by the width of that bar, so the room it took is held open.
function lockPage() {
    const gutter = window.innerWidth - document.documentElement.clientWidth;
    if (gutter > 0)
        document.body.style.paddingRight = gutter + "px";
    document.body.classList.add("pg-dialog-open");
}

function unlockPage() {
    document.body.classList.remove("pg-dialog-open");
    document.body.style.paddingRight = "";
}

module.exports = {
  name: "DialogClose",
  mixins: [i18n],

  mounted() {
    open.push(this);
    if (open.length === 1)
      lockPage();
    if (! listening) {
      document.addEventListener("keydown", onKeyDown, true);
      listening = true;
    }
    // move focus into the dialog so the keyboard lands somewhere useful, and so screen
    // readers announce it. The dialog is not focusable by default, hence the tabindex.
    const dialog = this.$el.closest(".pg-dialog");
    if (dialog != null && document.activeElement !== dialog) {
      // what to hand focus back to, so closing returns the keyboard where it came from
      this.opener = document.activeElement;
      if (! dialog.hasAttribute("tabindex"))
        dialog.setAttribute("tabindex", "-1");
      dialog.focus();
    }
  },

  beforeDestroy() {
    const at = open.indexOf(this);
    if (at > -1)
      open.splice(at, 1);
    if (open.length === 0) {
      unlockPage();
      if (listening) {
        document.removeEventListener("keydown", onKeyDown, true);
        listening = false;
      }
    }
    const opener = this.opener;
    if (opener != null && opener.isConnected && typeof opener.focus === "function")
      opener.focus();
  },
}
</script>
