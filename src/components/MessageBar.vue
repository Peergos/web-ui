<template>
    <div class="messagebar" @click.stop>
        <p class="messagebar__text">{{ date }}&nbsp;Message:&nbsp;{{ contents }}</p>
        <div class="messagebar__actions">
            <button type="button" class="pg-btn" @click="close">Delete</button>
            <button type="button" class="pg-btn pg-btn--primary" @click="reply">Show</button>
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
/* a message from the server, on the surface the dialogs use, waiting to be read or put away */
.messagebar {
	display: flex;
	flex-direction: column;
	gap: 10px;
	padding: 12px 14px;
	color: var(--color);
	background-color: var(--bg);
	border: 1px solid var(--border-color);
	border-radius: var(--radius-container);
	box-shadow: var(--pg-shadow-dialog);
}

.messagebar__text {
	margin: 0;
	font-size: var(--text-small);
	overflow-wrap: anywhere;
}

.messagebar__actions {
	display: flex;
	justify-content: flex-end;
	gap: 8px;
}
</style>
