<template>
<transition name="modal">
<div class="modal-mask" @click="close">
  <div style="height:30%"></div>
  <div class="prompt-modal-container" @click.stop>

    <div class="modal-header">
      <h3>{{ translate("SAVE.CONFLICT.TITLE") }}</h3>
    </div>

    <div class="modal-body">
          <div class="message-container" style="margin: 0px;">
            <p id='message-body-id' >{{ translate("SAVE.CONFLICT.DETAIL") }}</p>
          </div>
      <div class="container">
        <table>
          <tr>
            <td style="text-align:right; padding:20px"><button class="btn btn-success" @click="save(this.prompt_result)">{{ translate("PROMPT.OK") }}</button></td>
            <td style="text-align:right"><button class="btn btn-danger" @click="cancel()">{{ translate("PROMPT.CANCEL") }}</button></td>
          </tr>
        </table>
      </div>
    </div>
  </div>
</div>
</transition>
</template>

<script>
const i18n = require("../../i18n/index.js");

module.exports = {
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
<style>
.message-container {
    margin-right: auto;
    margin-left: auto;
    margin-bottom: 20px;
    overflow-wrap: break-word;
    width: auto;
    font-size: 18px;
}
.prompt-modal-container {
    width: 25%;
    margin: 0px auto;
    padding: 20px 30px;
	color: var(--color);
    background-color: var(--bg);
    border-radius: 2px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, .33);
    transition: all .3s ease;
    min-width: 400px;
}
</style>