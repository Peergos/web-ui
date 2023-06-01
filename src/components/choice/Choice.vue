<template>
<transition name="modal">
<div class="modal-mask" @click="close">
  <div style="height:30%"></div>
  <div class="modal-container" @click.stop>

    <div class="modal-header">
      <h3 id="choice-header-id">{{choice_message}}</h3>
    </div>

    <div class="modal-body">
      <div class="container" style="word-wrap:break-word;width:auto">
        <p id='choice-body-id' >{{choice_body}}</p>
      </div>
      <div class="choice-row">
        <div v-for="(option, key) in choice_options" class="choice-block">
          <label class="checkbox__group">
            {{ option }}
            <input type="radio" :id="key" :value="key" name="" v-model="picked">
            <span class="checkmark"></span>
          </label>
        </div>
      </div>
      <button class="btn btn-success btn-lg" @click="confirm()" >
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
            picked: 0
        }
    },
    props: ['choice_message', 'choice_body', 'choice_options', 'choice_consumer_func'],
    created: function() {
    },
    methods: {
        close: function() {
            this.$emit("hide-choice");
        },
        confirm: function() {
            this.close();
            this.choice_consumer_func(this.picked);
        }
    }
}
</script>
<style>
</style>