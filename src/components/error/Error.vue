<template>
<transition name="modal">
<div class="modal-mask" @click="close">
    <div style="height:30%"></div>
    <div class="error-modal-container" @click.stop>

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
module.exports = {
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
.error-modal-container {
    width: 25%;
    margin: 0px auto;
    padding: 20px 30px;
	color: var(--color);
    background-color: var(--bg);
    border-radius: 2px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, .33);
    transition: all .3s ease;
    min-width: 400px;
}

</style>