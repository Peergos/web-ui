<template>
<transition name="modal">
<div class="modal-mask" @click="closeMessage">
    <div class="modal-container" @click.stop>

        <div class="modal-header">
            <h3>{{ title }}</h3>
        </div>

        <div class="modal-body">
            <div class="container">
                <div>{{ message }}</div>
                <p/>
                <button class="btn btn-success" @click="closeMessage">
                    OK
                </button>
            </div>
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
<style>
</style>