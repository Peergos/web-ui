<template>
<transition name="modal">
<div class="pg-dialog__mask" @click="close">
    <div class="pg-dialog server-reply" role="dialog" aria-modal="true" :aria-label="title" @click.stop>
        <header class="pg-dialog__head">
            <h3 class="pg-dialog__title">{{title}}</h3>
            <DialogClose @close="close"/>
        </header>
        <div class="pg-dialog__body server-reply__body">
            <p v-if="isFeedback">You can tell us here how we can improve, or you can chat with us on <a href="https://reddit.com/r/peergos" target="_blank" rel="noopener noreferrer">reddit</a> or send us an email: <a href="mailto:feedback@peergos.org">feedback@peergos.org</a></p>
            <ul v-if="!isFeedback" class="server-reply__thread">
                <li v-for="message in messageThread" class="server-reply__message">
                    <button type="button" class="server-reply__head" :aria-expanded="message.visible ? 'true' : 'false'" @click="message.visible = !message.visible">
                        <svg class="server-reply__chevron" :class="{'server-reply__chevron--open': message.visible}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
                        <span>{{fromUTCtoLocal(message.sendTime)}}&nbsp;{{ message.from == 'FromServer' ? 'From Server' : (message.from == 'FromUser' ? 'You replied' : '') }}</span>
                    </button>
                    <div v-if="message.visible" class="server-reply__text" :class="{'server-reply__text--mine': message.from == 'FromUser'}">
                        <p v-for="paragraph in message.paragraphs">{{paragraph}}</p>
                    </div>
                </li>
            </ul>
            <textarea id="feedback-text" class="pg-input" spellcheck="true" rows=5 :placeholder="textAreaPlaceholder" maxlength="1000"></textarea>
        </div>
        <footer class="pg-dialog__foot">
            <div class="pg-dialog__actions">
                <span class="pg-dialog__spacer"></span>
                <button type="button" class="pg-btn pg-btn--primary" @click="submitFeedback()">Submit</button>
            </div>
        </footer>
    </div>
</div>
</transition>
</template>

<script>
const DialogClose = require("./dialog/DialogClose.vue");

module.exports = {
	components: {
        DialogClose,
	},
    data: function() {
        return {
            isFeedback: false,
            messageThread: [],
            title: "",
            textAreaPlaceholder: "",
        }
    },
    props: ['loadMessageThread', 'closeFeedbackForm','messageId', 'sendFeedback', 'sendMessage'],
    created: function() {
        if(this.messageId != null) {
            this.isFeedback = false;
            this.title = "Message";
            this.textAreaPlaceholder = "Reply...";
            this.messageThread = this.loadMessageThread(this.messageId);
            this.messageThread[this.messageThread.length -1].visible = true;
	    for (i=0; i < this.messageThread.length; i++)
		this.messageThread[i].paragraphs = this.toParagraphs(this.messageThread[i].contents);
        } else {
            this.isFeedback = true;
            this.title = "Feedback";
            this.textAreaPlaceholder = "Let us know what we can improve.";
        }
    },
    methods: {
        close: function () {
            this.closeFeedbackForm(this.messageId);
        },
        fromUTCtoLocal: function(postTime) {
            let date = new Date(postTime.toString());
            let localStr =  date.toISOString().replace('T',' ');
            let withoutMS = localStr.substring(0, localStr.indexOf('.'));
            return withoutMS;
        },
        submitFeedback: function() {
            var contents = document.getElementById("feedback-text").value;
            if (contents.length > 0) {
                if (this.isFeedback) {
                    this.sendFeedback(contents);
                } else {
                    this.sendMessage(this.messageId, contents);
                }
            }
        },
	toParagraphs: function(msg) {
	    return msg.split("\n");
	}
    }
}
</script>

<style>
.server-reply {
	width: 560px;
}

.server-reply__body {
	display: flex;
	flex-direction: column;
	gap: 14px;
}

/* the conversation so far, each message opening in place */
.server-reply__thread {
	display: flex;
	flex-direction: column;
	margin: 0;
	padding: 0;
	list-style: none;
}

.server-reply__message {
	border-bottom: 1px solid var(--pg-track);
}

.server-reply__head {
	display: flex;
	align-items: center;
	gap: 8px;
	width: 100%;
	padding: 10px 2px;
	font: inherit;
	font-size: var(--text-small);
	text-align: left;
	color: var(--color);
	background: none;
	border: 0;
	cursor: pointer;
}

.server-reply__chevron {
	width: 14px;
	height: 14px;
	flex: none;
	transition: transform .15s;
}

.server-reply__chevron--open {
	transform: rotate(90deg);
}

.server-reply__text {
	padding: 0 4px 12px 24px;
}

.server-reply__text--mine {
	color: var(--pg-muted);
}

.server-reply__text p {
	margin: 0 0 6px;
}

.server-reply__body textarea.pg-input {
	min-height: 120px;
	padding: 10px 12px;
	resize: vertical;
	font-size: 15px;
	background-color: var(--pg-surface-2);
	border: 1px solid var(--border-color);
	box-shadow: none;
}
</style>
