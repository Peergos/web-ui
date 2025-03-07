<template>
    <transition name="modal">
        <div class="modal-mask" @click="close">
            <div style="height:30%"></div>
            <div class="modal-container" @click.stop>
                
                <div class="modal-header">
                    <center>
                        <h3 id="confirm-header-id">{{message}}</h3>
                    </center>
                </div>
                
                <div class="modal-body">
                    <center>
                        <div class="container" style="word-wrap:break-word;width:auto">
                            <p id='confirm-body-id' style="text-align:center;">{{body}}</p>
                        </div>
                        
                        <a class="btn btn-success btn-lg" @click="yes()" v-bind:href="href" style="width:50%" target="_blank">
                            Ok
                        </a>
                    </center>
                </div>
            </div>
        </div>
    </transition>
</template>

<script>
    module.exports = {
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
