<template>
    <transition name="modal">
        <div class="pg-dialog__mask" @click="dismiss()">
            <div class="pg-dialog pg-dialog--prompt" role="dialog" aria-modal="true" :aria-label="title" @click.stop>
                <header class="pg-dialog__head">
                    <h3 class="pg-dialog__title" id="modal-header-id">{{ title }}</h3>
                    <DialogClose @close="dismiss()"/>
                </header>
                <div class="pg-dialog__body">
                    <input ref="password" class="pg-input" v-model="password" v-on:keyup.enter="submit()">
                </div>
                <footer class="pg-dialog__foot">
                    <div class="pg-dialog__actions">
                        <span class="pg-dialog__spacer"></span>
                        <button type="button" id='modal-button-id' class="pg-btn pg-btn--primary" @click="submit">{{ translate("DRIVE.LINK.OK") }}</button>
                    </div>
                </footer>
            </div>
        </div>
    </transition>
</template>

<script>
const DialogClose = require("./dialog/DialogClose.vue");
const i18n = require("../i18n/index.js");
    module.exports = {
        components: { DialogClose },
	data() {
	    return {
                password:"",
            };
	},
        mixins:[i18n],
	props: [
	    "title",
	    "future",
        ],
        mounted: function() {
            this.$refs.password.focus();
        },
        methods: {
            submit: function() {
                this.future.complete(this.password);
                this.$emit('hide-modal');
            },
            // the link is waiting on an answer: going away gives it no password, which for a
            // link that needs one is the wrong one, and the page says the link can't be opened
            dismiss: function() {
                this.future.complete("");
                this.$emit('hide-modal');
            }
        }
    }
</script>
