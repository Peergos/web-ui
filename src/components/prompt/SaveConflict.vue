<template>
<transition name="modal">
<div class="pg-dialog__mask" @click="close">
  <div class="pg-dialog pg-dialog--prompt" role="dialog" aria-modal="true" :aria-label="translate('SAVE.CONFLICT.TITLE')" @click.stop>
    <header class="pg-dialog__head">
      <h3 class="pg-dialog__title">{{ translate("SAVE.CONFLICT.TITLE") }}</h3>
      <DialogClose @close="close"/>
    </header>
    <div class="pg-dialog__body">
      <p id='message-body-id'>{{ translate("SAVE.CONFLICT.DETAIL") }}</p>
    </div>
    <footer class="pg-dialog__foot">
      <div class="pg-dialog__actions">
        <span class="pg-dialog__spacer"></span>
        <button type="button" class="pg-btn" @click="cancel()">{{ translate("PROMPT.CANCEL") }}</button>
        <button type="button" class="pg-btn pg-btn--primary" @click="save()">{{ translate("PROMPT.OK") }}</button>
      </div>
    </footer>
  </div>
</div>
</transition>
</template>

<script>
const DialogClose = require("../dialog/DialogClose.vue");
const i18n = require("../../i18n/index.js");

module.exports = {
    components: { DialogClose },
    data: function() {
        return {
        }
    },
    mixins:[i18n],
    props: ["currentContentsBytes","consumer_save_func","consumer_close_func","consumer_cancel_func"],
    created: function() {
    },
    methods: {
        close: function () {
            this.consumer_close_func(this.currentContentsBytes);
        },
        cancel: function () {
            this.consumer_cancel_func(this.currentContentsBytes);
        },
        save: function() {
            this.consumer_save_func(this.currentContentsBytes);
        }
    }
}
</script>
