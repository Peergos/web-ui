<template>
    <transition name="modal">
<div class="modal-mask" @click="close">
    <meta http-equiv="content-type" content="text/html; charset=utf-8" />
    <div style="height:30%"></div>
    <div class="modal-container server-message-reply" @click.stop style="height:70%;overflow-y:auto">
        <span @click="close" tabindex="0" v-on:keyup.enter="close" aria-label="close" class="close">&times;</span>
        <div class="modal-header">
                <h2>{{title}}</h2>
        </div>
        <div class="modal-body">
            <div id="feedback-main">
                <div v-if="isFeedback" >
        	      <h3>You can tell us here how we can improve, or you can chat with us on <a href="https://reddit.com/r/peergos" target="_blank" rel="noopener noreferrer">reddit</a> or send us an email: <a href="mailto:feedback@peergos.org">feedback@peergos.org</a></h3>
                </div>
                <div v-if="!isFeedback">
                <table style="width: 100%; font-size: 1.0em;">
                    <thead>
                    <tr>
                        <th></th>
                    </tr>
                    </thead>
                    <tbody>
                    <template v-for="message in messageThread" >
                        <tr @click="message.visible = !message.visible">
                                <div v-if="message.from == 'FromServer'">
                                    <td>
                                    <span v-if="!message.visible" class="fas fa-angle-up" />
                                    <span v-if="message.visible" class="fas fa-angle-down" />
                                        {{fromUTCtoLocal(message.sendTime)}}&nbsp;From Server
                                    </td>
                                </div>
                                <div v-if="message.from == 'FromUser'">
                                    <td>
                                        <span v-if="!message.visible" class="fas fa-angle-up" />
                                        <span v-if="message.visible" class="fas fa-angle-down" />
                                        {{fromUTCtoLocal(message.sendTime)}}&nbsp;You replied
                                    </td>
                                </div>
                        </tr>
                        <tr v-if="message.visible">
                            <td>
                                <div v-if="message.from == 'FromUser'" style="background-color: #ffffff;">
                                  <div v-for="paragraph in message.paragraphs" >
                                    {{paragraph}}
				    <br/>
				  </div>
                                </div>
                                <div v-if="message.from != 'FromUser'">
				  <div v-for="paragraph in message.paragraphs" >
                                    {{paragraph}}
				    <br/>
				  </div>
                                </div>
                            </td>
                        </tr>
                    </template>
                    </tbody>
                </table>
                </div>
                <p>
                    <textarea id="feedback-text" spellcheck="true" style="width:100%" rows=5 :placeholder="textAreaPlaceholder" maxlength="1000"></textarea>
                </p>
                <button class="btn btn-success" 
                        style = "width:100%"
                    @click="submitFeedback()">
                    Submit
                </button>
                </p>
            </div>
        </div>
    </div>
</div>
</transition>
</template>

<script>

module.exports = {
	components: {
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
.server-message-reply textarea {
    color: var(--color);
    background-color: var(--bg);
}
</style>
