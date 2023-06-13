<template>
<transition name="modal">
<div class="modal-mask" @click="close">
  <div style="height:30%"></div>
  <div class="modal-container" @click.stop>

    <div class="modal-header">
      <h3 id="confirm-header-id">WebAuth Setup</h3>
    </div>

    <div class="modal-body">
      <button class="btn btn-success btn-lg" @click="confirm()" style="margin:10%;">
        Confirm
      </button>
    </div>
  </div>
</div>
</transition>
</template>
<script>
module.exports = {
    data: function() {
        return {
        }
    },
    props: ['consumer_func'],
    created: function() {
    },
    methods: {
        close: function() {
            this.$emit("hide-webauth");
        },
        confirm: function() {
            this.close();
            this.consumer_func({key:'abcde'});
        }
    }
}
</script>
<style>
</style>