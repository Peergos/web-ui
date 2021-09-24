<template>
    <div class="messagebar" >
        <div class="" @click.stop>
            <div class="">
                <span>&nbsp;{{ date }}&nbsp;Message:&nbsp;{{ contents }}</span>
            </div>
            <div class="messagecontainer">
                <button class="btn btn-success" @click="reply">Show</button>
                <button class="btn btn-success" @click="close">Delete</button>
            </div>
        </div>
    </div>
</template>

<script>
module.exports = {
    data: function() {
        return {
        }
    },
    props: ['id', 'date', 'contents', 'replyToMessage', 'dismissMessage'],
    created: function() {
    },
    methods: {
        reply: function() {
            console.log("reply to message id: " + this.id);
            this.replyToMessage(this.id);
        },
        close: function() {
            console.log("acknowledge message id: " + this.id);
            this.dismissMessage(this.id);
        }
    }
}
</script>

<style>
.messagebar {
    color: var(--color);
    background-color: var(--bg);
    padding: 10px;
    background-color: #fff;
    transition: opacity .3s ease;
    border-radius: 2px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, .33) inset;
}

</style>
