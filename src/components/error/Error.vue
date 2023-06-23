<template>
<transition name="modal">
<div class="modal-mask" @click="close">
    <div style="height:30%"></div>
    <div class="modal-container" @click.stop>

        <div class="modal-header">
            <h3 id="error-header-id">{{ title }}</h3>
        </div>

        <div class="modal-body">
            <div class="container" style="word-wrap:break-word;width:auto">
                <p id='error-body-id' >{{  decodeError(body)  }}</p>
            </div>
        </div>

        <div class="modal-footer">
            <slot name="footer">
            <button id='modal-button-id' class="modal-default-button" @click="close">
                OK
            </button>
            </slot>
        </div>
    </div>
</div>
</transition>
</template>

<script>
export default {
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
<style>
</style>