<template>
<transition name="modal">
<div class="pg-dialog__mask" @click="close">
  <div class="pg-dialog pg-dialog--prompt" role="dialog" aria-modal="true" :aria-label="confirm_message" @click.stop>
    <header class="pg-dialog__head">
      <h3 class="pg-dialog__title" id="confirm-header-id">{{confirm_message}}</h3>
      <DialogClose @close="close"/>
    </header>
    <div class="pg-dialog__body">
      <p id='confirm-body-id'>{{confirm_body}}</p>
    </div>
    <footer class="pg-dialog__foot">
      <div class="pg-dialog__actions">
        <span class="pg-dialog__spacer"></span>
        <button type="button" class="pg-btn" @click="no()">No</button>
        <button type="button" class="pg-btn pg-btn--primary" @click="yes()">Yes</button>
      </div>
    </footer>
  </div>
</div>
</transition>
</template>
<script>
const DialogClose = require("../dialog/DialogClose.vue");
module.exports = {
    components: { DialogClose },
    data: function() {
        return {
        }
    },
    props: ['confirm_message', 'confirm_body', 'consumer_cancel_func', 'consumer_func'],
    created: function() {
    },
    methods: {
        close: function() {
            this.$emit("hide-confirm");
        },
        no: function() {
            this.close();
            this.consumer_cancel_func();
        },
        yes: function() {
            this.close();
            this.consumer_func();
        }
    }
}
</script>
