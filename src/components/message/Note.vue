<template>
<transition name="modal">
<div class="modal-mask" @click="closeNote">
    <div class="note-modal-container" @click.stop>

        <div class="modal-header">
            <h3>{{ title }}</h3>
        </div>

        <div class="modal-body">
            <div class="container">
                <div>
                    <textarea id="note-text" style="resize: none;width:90%" rows="12" readonly v-model="note"></textarea>
                </div>
                <p/>
                <button class="btn btn-success" @click="closeNote">
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
.note-modal-container {
    width: 90%;
    margin: 0px auto;
    padding: 20px 30px;
    color: var(--color);
    background-color: var(--bg);
    border-radius: 2px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, .33);
    transition: all .3s ease;
    /* font-family: Helvetica, Arial, sans-serif; */
}
</style>