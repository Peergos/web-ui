<template>
<transition name="modal">
<div class="pg-dialog__mask" @click="close">
  <div class="pg-dialog pg-dialog--prompt" role="dialog" aria-modal="true" :aria-label="choice_message" @click.stop>
    <header class="pg-dialog__head">
      <h3 class="pg-dialog__title" id="choice-header-id">{{choice_message}}</h3>
      <DialogClose @close="close"/>
    </header>
    <div class="pg-dialog__body">
      <p id="choice-body-id" class="choice-body">{{choice_body}}</p>
      <div class="choice-row" role="radiogroup" :aria-label="choice_message">
        <label v-for="(option, key) in choice_options" class="choice-block" :class="{'choice-block--on': picked == key}">
          <input type="radio" :value="key" name="choice" v-model="picked">
          <span class="choice-block__mark" aria-hidden="true"></span>
          <span class="choice-block__text">{{ option }}</span>
        </label>
      </div>
    </div>
    <footer class="pg-dialog__foot">
      <div class="pg-dialog__actions">
        <span class="pg-dialog__spacer"></span>
        <button type="button" class="pg-btn pg-btn--primary" @click="confirm()">Confirm</button>
      </div>
    </footer>
  </div>
</div>
</transition>
</template>
<script>
const DialogClose = require("../dialog/DialogClose.vue");
module.exports = {
    components: { DialogClose },
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
/* One of a few ways to go on, on the surface the confirm and prompt dialogs use: each option
   a row to tap, the picked one marked in the colour a switch has when it is on. */

.choice-body {
	margin: 0;
	overflow-wrap: anywhere;
}

.choice-row {
	display: flex;
	flex-direction: column;
	gap: 8px;
	margin-top: 14px;
}

.choice-block {
	text-align: left;
	position: relative;
	display: flex;
	align-items: center;
	gap: 12px;
	min-height: 44px;
	margin: 0;
	padding: 10px 14px;
	font-weight: var(--regular);
	line-height: 1.35;
	border: 1px solid var(--border-color);
	border-radius: var(--radius-control);
	cursor: pointer;
}

.choice-block--on {
	border-color: var(--green-500);
	background-color: var(--pg-tint-ok);
}

.choice-block input {
	position: absolute;
	opacity: 0;
	width: 0;
	height: 0;
}

.choice-block__mark {
	position: relative;
	flex: none;
	width: 18px;
	height: 18px;
	border: 2px solid var(--pg-muted);
	border-radius: 50%;
}

.choice-block--on .choice-block__mark {
	border-color: var(--green-500);
}

.choice-block--on .choice-block__mark:after {
	content: "";
	position: absolute;
	top: 3px;
	left: 3px;
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background-color: var(--green-500);
}

.choice-block input:focus-visible + .choice-block__mark {
	outline: 2px solid var(--green-500);
	outline-offset: 2px;
}

.choice-block__text {
	min-width: 0;
	overflow-wrap: anywhere;
}
</style>
