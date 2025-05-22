<template>
<transition name="modal">
<div class="modal-mask" @click="close">
  <div style="height:30%"></div>
  <div class="select-modal-container" @click.stop>

    <div class="modal-header">
      <h3 id="select-header-id">{{select_message}}</h3>
    </div>

    <div class="modal-body">
      <div class="container" style="word-wrap:break-word;width:auto">
        <p id='select-body-id' >{{select_body}}</p>
      </div>
      <div class="select-row">
        <div v-for="(option, key) in select_options" class="select-block">
          <label class="checkbox__group">
            {{ option }}
            <input type="checkbox" :id="option" :value="option" name="" v-model="picked">
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
            picked: [],
        }
    },
    props: ['select_message', 'select_body', 'select_options', 'select_consumer_func'],
    created: function() {
    },
    methods: {
        close: function() {
            this.$emit("hide-select");
        },
        confirm: function() {
            this.close();
            this.select_consumer_func(this.picked);
        }
    }
}
</script>
<style>
.select-modal-container {
    width: 50%;
    min-width: 400px;
    margin: 0px auto;
    padding: 20px 30px;
    color: var(--color);
    background-color: var(--bg);
    border-radius: 2px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, .33);
    transition: all .3s ease;
}
</style>