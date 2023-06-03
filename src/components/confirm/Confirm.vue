<template>
<transition name="modal">
<div class="modal-mask" @click="close">
  <div style="height:30%"></div>
  <div class="modal-container" @click.stop>

    <div class="modal-header">
      <h3 id="confirm-header-id">{{confirm_message}}</h3>
    </div>

    <div class="modal-body">
      <div class="container" style="word-wrap:break-word;width:auto">
        <p id='confirm-body-id' >{{confirm_body}}</p>
      </div>
      <button class="btn btn-success btn-lg" @click="no()" style="margin:10%;">
        No
      </button>
      <button class="btn btn-success btn-lg" @click="yes()" style="margin:10%">
        Yes
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
<style>
</style>