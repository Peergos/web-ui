<template>
    <transition name="modal">
        <div class="modal-mask" @click="close">
            <div style="height:30%"></div>
            <div class="modal-container" @click.stop>
                
                <div class="modal-header">
                    <h3 id="warning-header-id">{{warning_message}}</h3>
                </div>
                
                <div class="modal-body">
                    <div class="container warning-container">
                        <p id='warning-body-id' >{{warning_body}}</p>
                    </div>
                    <button class="btn btn-success btn-lg" @click="cancel()" style="margin:10%;">
                        Cancel
                    </button>
                    <button class="btn btn-success btn-lg" @click="complete()" style="margin:10%">
                        OK
                    </button>
                </div>
            </div>
        </div>
    </transition>
</template>

<script>
module.exports = {
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

<style>
    .warning-container {
    word-wrap:break-word;width:auto
    }
</style>
