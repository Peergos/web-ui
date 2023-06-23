<template>
<transition name="modal">
<div class="modal-mask" @click="close">
  <div style="height:30%"></div>
  <div class="modal-container" @click.stop>

    <div class="modal-header">
      <h3>{{prompt_message}}</h3>
    </div>

    <div class="modal-body">
      <div class="container">
        <table>
          <tr>
            <td style="text-align:right; padding:20px">
              <input id="prompt-input" v-model="prompt_result" type="text"
              v-bind:placeholder="placeholder" class="form-control" :maxlength="input_length" style="width:200px" v-on:keyup.enter="getPrompt" autofocus />
            </td>
            <td style="text-align:right"><button id='prompt-button-id' class="btn btn-success" @click="getPrompt(this.prompt_result)">OK</button></td>
          </tr>
        </table>
      </div>
    </div>
  </div>
</div>
</transition>
</template>

<script>
export default {
    data: function() {
        return {'prompt_result': '',
                input_length: 255
        }
    },
    props: ['prompt_message', 'placeholder', 'value', 'consumer_func', 'max_input_size'],
    created: function() {
        this.prompt_result = this.value;
        this.input_length = (this.max_input_size == null || this.max_input_size == '') ? 255 : this.max_input_size;
        Vue.nextTick(function() {
                document.getElementById("prompt-input").focus();
        });
    },
    methods: {
        close: function () {
            this.$emit("hide-prompt");
        },

        getPrompt: function() {
	    var res = this.prompt_result;
            this.close();
            this.prompt_result='';
            this.consumer_func(res);
        }
    }
}
</script>
<style>
</style>
