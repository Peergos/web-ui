<template>
<transition name="modal">
<div class="pg-dialog__mask" @click="no()">
  <div class="pg-dialog pg-dialog--prompt" role="dialog" aria-modal="true" :aria-label="replace_message" @click.stop>
    <header class="pg-dialog__head">
      <h3 class="pg-dialog__title" id="replace-header-id">{{replace_message}}</h3>
      <DialogClose @close="no()"/>
    </header>
    <div class="pg-dialog__body">
      <p id='replace-body-id'>{{replace_body}}</p>
      <label v-if="showApplyAll" class="pg-switch replace__all">
        <input type="checkbox" name="applyToAll" id="applyToAll" v-model="applyToAll">
        <span class="pg-switch__track" aria-hidden="true"></span>
        <span>Do this for all conflicts</span>
      </label>
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
            applyToAll:false
        }
    },
    props: ['replace_message', 'replace_body', 'consumer_cancel_func', 'consumer_func', 'showApplyAll'],
    created: function() {
    },
    methods: {
        close: function() {
            this.$emit("hide-replace");
        },
        // the X, Escape and a click outside come here too: whoever asked is waiting on an
        // answer, and walking away from the question is not replacing the file
        no: function() {
            this.close();
            this.consumer_cancel_func(this.applyToAll);
        },
        yes: function() {
            this.close();
            this.consumer_func(this.applyToAll);
        }
    }
}
</script>
<style>
.replace__all {
    margin-top: 12px;
}
</style>
