<template>
    <transition name="modal">
        <div class="pg-dialog__mask" @click="close">
            <div class="pg-dialog pg-dialog--prompt" role="dialog" aria-modal="true" :aria-label="warning_message" @click.stop>
                <header class="pg-dialog__head">
                    <h3 class="pg-dialog__title" id="warning-header-id">{{warning_message}}</h3>
                    <DialogClose @close="close"/>
                </header>
                <div class="pg-dialog__body">
                    <p id='warning-body-id'>{{warning_body}}</p>
                </div>
                <footer class="pg-dialog__foot">
                    <div class="pg-dialog__actions">
                        <span class="pg-dialog__spacer"></span>
                        <button type="button" class="pg-btn" @click="cancel()">Cancel</button>
                        <button type="button" class="pg-btn pg-btn--primary" @click="complete()">OK</button>
                    </div>
                </footer>
            </div>
        </div>
    </transition>
</template>

<script>
const DialogClose = require("./dialog/DialogClose.vue");

module.exports = {
    components: { DialogClose },
    data: function() {
        return {}
    },
    props: ['warning_message', 'warning_body', 'consumer_func'],
    created: function() {
    },
    methods: {
        close: function() {
            this.$emit("hide-warning");
        },
        cancel: function() {
            this.close();
        },
        complete: function() {
            this.close();
            this.consumer_func();
        }
    }
}
</script>
