<template>
<transition name="modal">
<div class="modal-mask" @click="close">
  <div style="height:30%"></div>
  <div class="confirm-modal-container" @click.stop>

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
.confirm-modal-container {
    width: 40%;
    margin: 0px auto;
    padding: 20px 30px;
	color: var(--color);
    background-color: var(--bg);
    border-radius: 2px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, .33);
    transition: all .3s ease;
    min-width: 350px;
}
</style>