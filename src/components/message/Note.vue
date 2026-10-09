<template>
<transition name="modal">
<div class="pg-dialog__mask" @click="closeNote">
    <div class="pg-dialog note-dialog" role="dialog" aria-modal="true" :aria-label="title" @click.stop>
        <header class="pg-dialog__head">
            <h3 class="pg-dialog__title">{{ title }}</h3>
            <DialogClose @close="closeNote"/>
        </header>
        <div class="pg-dialog__body">
            <textarea id="note-text" class="pg-input note-dialog__text" rows="8" readonly :value="note"></textarea>
        </div>
        <footer class="pg-dialog__foot">
            <div class="pg-dialog__actions">
                <span class="pg-dialog__spacer"></span>
                <button type="button" class="pg-btn pg-btn--primary" @click="closeNote">OK</button>
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
    props: ['title', 'note'],
    created: function() {
    },
    methods: {
        closeNote: function () {
            this.$emit("remove-note");
        }
    }
}
</script>
<style>
/* text handed over to be copied somewhere else, such as a link with no spaces to break at */
.note-dialog {
    width: 560px;
}

.note-dialog .note-dialog__text {
    display: block;
    width: 100%;
    padding: 10px 12px;
    resize: none;
    font-family: monospace;
    font-size: var(--text-small);
    word-break: break-all;
    color: var(--color);
    background-color: var(--pg-surface-2);
    border: 1px solid var(--border-color);
    border-radius: var(--radius-field);
    box-shadow: none;
}
</style>
