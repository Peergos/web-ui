<template>
    <div v-if="conversationMonitors.length > 0" class="messageholder">
	<MessageBar
	    :replyToMessage="replyToMessage"
	    :dismissMessage="dismissMessage"
	    v-for="message in conversationMonitors"
	    :id="message.id"
	    :date="message.sendTime"
	    :contents="
		       message.contents.length > 50
		       ? message.contents.substring(0, 47) + '...'
		       : message.contents
		       "
	    />
    </div>
</template>

<script>
    const MessageBar = require("./MessageBar.vue");

    module.exports = {
	components: {
		MessageBar,
	},

	data() {
		return {
			messageMonitors: [],
			conversationMonitors: [],
		};
	},

	computed: {
		...Vuex.mapState([
			"isLoggedIn",
			"isDark",
			"context",
		]),
        },
        
        mounted() {
	    this.showPendingServerMessages();
	},
            
        methods: {
            showPendingServerMessages: function () {
		let context = this.context;
                if (context == null || context.username == null)
                    return;
                    
		let that = this;
		context
		    .getServerConversations()
		    .thenApply(function (conversations) {
			let allConversations = [];
			let conv = conversations.toArray();
			conv.forEach(function (conversation) {
			    let arr = conversation.messages.toArray();
			    let lastMessage = arr[arr.length - 1];
			    allConversations.push({
				id: lastMessage.id(),
				sendTime: lastMessage
				    .getSendTime()
				    .toString()
				    .replace("T", " "),
				contents: lastMessage.getContents(),
				previousMessageId:
				lastMessage.getPreviousMessageId(),
				from: lastMessage.getAuthor(),
				msg: lastMessage,
			    });
			    arr.forEach(function (message) {
				that.messageMonitors.push({
				    id: message.id(),
				    sendTime: message
					.getSendTime()
					.toString()
					.replace("T", " "),
				    contents: message.getContents(),
				    previousMessageId:
				    message.getPreviousMessageId(),
				    from: message.getAuthor(),
				    msg: message,
				});
			    });
			});
			if (allConversations.length > 0) {
			    Vue.nextTick(function () {
				allConversations.forEach(function (msg) {
				    that.conversationMonitors.push(msg);
				});
			    });
			}
		    })
		    .exceptionally(function (throwable) {
			throwable.printStackTrace();
		    });
	    },
            
	    popConversation: function (msgId) {
		if (msgId != null) {
		    for (var i = 0; i < this.conversationMonitors.length; i++) {
			let currentMessage = this.conversationMonitors[i];
			if (currentMessage.id == msgId) {
			    this.conversationMonitors.splice(i, 1);
			    break;
			}
		    }
		}
	    },
	    getMessage: function (msgId) {
		if (msgId != null) {
		    //linear scan
		    for (var i = 0; i < this.messageMonitors.length; i++) {
			let currentMessage = this.messageMonitors[i];
			if (currentMessage.id == msgId) {
			    return this.messageMonitors[i];
			}
		    }
		}
		return null;
	    },
            
	    replyToMessage: function (msgId) {
		if (this.showFeedbackForm) {
		    return;
		}
		this.messageId = msgId;
		this.showFeedbackForm = true;
	    },
            
	    dismissMessage: function (msgId) {
		if (this.showFeedbackForm) {
		    return;
		}
		this.messageId = null;
		if (msgId != null) {
		    let message = this.getMessage(msgId);
		    if (message != null) {
			let that = this;
			this.showSpinner = true;
			this.context
			    .dismissMessage(message.msg)
			    .thenApply((res) => {
				this.showSpinner = false;
				if (res) {
				    console.log("acknowledgement sent!");
				    that.popConversation(msgId);
				} else {
				    that.errorTitle = "Error acknowledging message";
				    that.errorBody = "";
				    that.showError = true;
				}
			    })
			    .exceptionally(function (throwable) {
				that.errorTitle = "Error acknowledging message";
				that.errorBody = throwable.getMessage();
				that.showError = true;
				that.showSpinner = false;
			    });
		    }
		}
	    },
	},
    }
</script>

<style>
.messageholder {
    position: absolute;
    right:var(--app-margin);
    bottom:var(--app-margin);
    min-width:200px;
    z-index: 200;
    display: inline-block;
    float: right;
    overflow-y: auto;
    color: var(--color);
    background-color: var(--bg);
}

.messageholder div {
    color: var(--color);
    background-color: var(--bg);
}
</style>
