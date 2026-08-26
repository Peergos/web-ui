<template>
  <transition name="modal" appear>
    <div class="app-prompt pg-dialog__mask" @click.stop="closePrompt()">
      <div class="pg-dialog pg-dialog--prompt" role="dialog" aria-modal="true" :aria-label="fullMessage" @click.stop>
        <header class="pg-dialog__head">
          <h3 v-if="name == null" class="pg-dialog__title">{{ message }}</h3>
          <h3 v-else class="pg-dialog__title pg-dialog__title--inline"><span>{{ messageBefore }}</span><span class="pg-dialog__title-name">{{ name }}</span><span>{{ messageAfter }}</span></h3>
          <DialogClose @close="closePrompt()"/>
        </header>
        <div v-if="placeholder" class="pg-dialog__body">
          <input
            id="prompt-input"
            ref="prompt"
            class="pg-input"
            v-model="prompt_result"
            type="text"
            :placeholder="placeholder"
            :maxlength="maxLength"
            @keyup.enter="getPrompt()"
          >
        </div>
        <footer class="pg-dialog__foot">
          <div class="pg-dialog__actions">
            <span class="pg-dialog__spacer"></span>
            <button type="button" class="pg-btn" @click="closePrompt()">{{ translate("PROMPT.CANCEL") }}</button>
            <button type="button" id="prompt-button-id" class="pg-btn pg-btn--primary" :disabled="! canSubmit" @click="getPrompt()">{{ action }}</button>
          </div>
        </footer>
      </div>
    </div>
  </transition>
</template>

<script>
const DialogClose = require("../dialog/DialogClose.vue");
const i18n = require("../../i18n/index.js");

module.exports = {
    components: { DialogClose },
    mixins:[i18n],
  data() {
    return {
      prompt_result: '',
    }
  },
  props: {
    message: {
      type: String,
      default: ''
    },
    /** The one part of the message that may not fit: shown whole where there is room,
     *  cut with an ellipsis where there is not. */
    name: {
      type: String,
      default: null
    },
    placeholder: {
      type: String,
      default: null
    },
    value:{
      type: String,
      default: ''
    },
    max_input_size:{
      type: Number,
      default: 255
    },
    consumer_func: {
      type: Function
    },
    action:{
      type: String,
    }
  },
  computed: {
    fullMessage() {
      return this.name == null ? this.message : this.message.replace("{n}", this.name);
    },
    messageBefore() {
      return this.message.split("{n}")[0];
    },
    messageAfter() {
      return this.message.split("{n}")[1] || "";
    },
    maxLength() {
      return (this.max_input_size == null || this.max_input_size == '') ? 255 : this.max_input_size;
    },
    // without an input there is nothing to fill in, so the action is always available
    canSubmit() {
      return this.placeholder == null || (this.prompt_result || '').trim().length > 0;
    }
  },

  mounted() {
    this.prompt_result = this.value;
    if (this.placeholder !== null) {
      this.$refs.prompt.focus()
    }
  },

  methods: {
    closePrompt() {
      this.consumer_func(null);
      this.$emit("hide-prompt");
    },

    getPrompt() {
      if (! this.canSubmit)
        return;
      this.consumer_func(this.prompt_result);
      this.$emit("hide-prompt");
    }
  }
}

</script>
