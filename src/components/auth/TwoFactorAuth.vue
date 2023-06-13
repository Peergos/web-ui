<template>
<transition name="modal">
<div class="modal-mask" @click="close">
  <div style="height:30%"></div>
  <div class="modal-container" @click.stop>

    <div class="modal-header">
      <h3 id="confirm-header-id">2 Factor Authentication</h3>
    </div>

    <div class="modal-body">
        <input
            type="text"
            autofocus
            name="mfa"
            v-model="mfa"
            placeholder=""
            ref="totp"
            style="width:200px"
        />
        <br/>
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
            mfa: ''
        }
    },
    props: ['consumer_func'],
    created: function() {
    },
    methods: {
        close: function() {
            this.$emit("hide-auth");
        },
        confirm: function() {
            this.close();
            this.consumer_func(this.mfa);
        }
    }
}
</script>
<style>
</style>