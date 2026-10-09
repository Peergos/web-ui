<template>
<transition name="modal">
<div class="pg-dialog__mask" @click="close">
    <div class="pg-dialog pg-dialog--prompt" role="dialog" aria-modal="true" :aria-label="title" @click.stop>
        <header class="pg-dialog__head">
            <h3 class="pg-dialog__title" id="error-header-id">{{ title }}</h3>
            <DialogClose @close="close"/>
        </header>
        <div class="pg-dialog__body">
            <p id='error-body-id'>{{ decodeError(body) }}</p>
        </div>
        <footer class="pg-dialog__foot">
            <div class="pg-dialog__actions">
                <span class="pg-dialog__spacer"></span>
                <button type="button" id='modal-button-id' class="pg-btn pg-btn--primary" @click="close">OK</button>
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
    props: ['title', 'body'],
    created: function() {
    },
    methods: {
        decodeError: function(errorBody) {
            let jsErrorBody = errorBody.split("\\+").join("%20")
                            .split("\\%21").join("!")
                            .split("\\%27").join("'")
                            .split("\\%28").join("(")
                            .split("\\%29").join(")")
                            .split("\\%7E").join("~")
                            .split("+").join("%20");

            let str = decodeURIComponent(jsErrorBody);
            let token = 'java.lang.JsException: ';
            return str.startsWith(token) ? str.substring(token.length) : str;
        },
        close: function () {
            this.$emit("hide-error");
        }
    }
}
</script>
