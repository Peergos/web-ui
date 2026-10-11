<template>
    <transition name="modal">
        <div class="pg-dialog__mask">
            <!-- The step before paying, in a paid sign up or mirror: the sign up waits on Ok, and
                 nothing else answers it, so closing here would leave it waiting for good. No x,
                 and nothing for Escape or a click outside to do; the close button stays, out of
                 sight and with nothing to close, for the keyboard and the page lock it brings. -->
            <div class="pg-dialog pg-dialog--prompt" role="alertdialog" aria-modal="true" :aria-label="message"
                 :aria-describedby="body ? 'confirm-body-id' : null" @click.stop>
                <header class="pg-dialog__head">
                    <h3 class="pg-dialog__title" id="confirm-header-id">{{message}}</h3>
                    <DialogClose v-show="false"/>
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
