<template>
<transition name="modal">
<div class="modal-mask" @click="close">
  <div style="height:30%"></div>
  <div class="modal-container" @click.stop>

    <div class="modal-header">
      <h3 id="replace-header-id">{{replace_message}}</h3>
    </div>

    <div class="modal-body">
      <div class="container" style="word-wrap:break-word;width:auto">
        <p id='replace-body-id' >{{replace_body}}</p>
      </div>
      <div v-if="showApplyAll">
        <label class="checkbox-container">Do this for all conflicts
          <input type="checkbox" name="applyToAll" id="applyToAll" v-model="applyToAll" placeholder="Do this for all conflicts">
          <span class="checkmark"></span>
        </label>
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
</style>