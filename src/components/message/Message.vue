<template>
<transition name="modal">
<div class="pg-dialog__mask" @click="closeMessage">
    <div class="pg-dialog pg-dialog--prompt" role="dialog" aria-modal="true" :aria-label="title" @click.stop>
        <header class="pg-dialog__head">
            <h3 class="pg-dialog__title">{{ title }}</h3>
            <DialogClose @close="closeMessage"/>
        </header>
        <div class="pg-dialog__body">
            <p>{{ message }}</p>
        </div>
        <footer class="pg-dialog__foot">
            <div class="pg-dialog__actions">
                <span class="pg-dialog__spacer"></span>
                <button type="button" class="pg-btn pg-btn--primary" @click="closeMessage">OK</button>
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
        }
    },
    props: ['title', 'message'],
    created: function() {
    },
    methods: {
        closeMessage: function () {
            this.$emit("remove-message");
        }
    }
}
</script>
