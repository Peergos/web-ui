<template>
    <transition name="modal">
        <div class="pg-dialog__mask" @click="close">
            <div class="pg-dialog pg-dialog--prompt" role="dialog" aria-modal="true" :aria-label="message" @click.stop>
                <header class="pg-dialog__head">
                    <h3 class="pg-dialog__title" id="confirm-header-id">{{message}}</h3>
                    <DialogClose @close="close"/>
                </header>
                <div v-if="body" class="pg-dialog__body">
                    <p id='confirm-body-id'>{{body}}</p>
                </div>
                <footer class="pg-dialog__foot">
                    <div class="pg-dialog__actions">
                        <span class="pg-dialog__spacer"></span>
                        <a class="pg-btn pg-btn--primary" @click="yes()" v-bind:href="href" target="_blank">Ok</a>
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
        return {
        }
    },
    props: ['message', 'body', 'ok_func', 'href'],
    created: function() {
    },
    methods: {
        close: function() {
            this.$emit("hide-continue");
        },
        yes: function() {
            this.close();
            this.ok_func();
        }
    }
}
</script>
