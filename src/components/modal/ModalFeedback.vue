<template>
	<AppModal class="feedback">
		<template #header>
			<h2>Feedback</h2>
		</template>
		<template #body>
		    <h3>
                        You can tell us here how we can improve, or you can chat with us on <a href="https://reddit.com/r/peergos" target="_blank" rel="noopener noreferrer">reddit</a>, <a href="https://app.element.io/#/room/#peergos-chat:matrix.org" target="_blank" rel="noopener noreferrer">Matrix</a> or send us an email: <a href="mailto:feedback@peergos.org">feedback@peergos.org</a>
                    </h3>
                    <p>
                        <textarea id="feedback-text" v-model="currentFeedback" spellcheck="true" style="width:100%" rows=5 :placeholder="textAreaPlaceholder" maxlength="1000"></textarea>
                    </p>
		</template>
		<template #footer>

			 <AppButton @click.native="sendFeedback()" type="primary" block accent>Submit</AppButton>

		</template>
	</AppModal>
</template>

<script>
const AppButton = require("../AppButton.vue");
const AppModal = require("AppModal.vue");

module.exports = {
	components: {
	    AppButton,
    	AppModal
	},
	data() {
		return {
			textAreaPlaceholder: "Type your feedback here.",
			warning: false
		};
	},
	computed: {
		...Vuex.mapState([
			'context'
		]),
      currentFeedback: {
        get () {
          return this.$store.getters.getCurrentFeedback;
        },
        set (value) {
          this.$store.commit("SET_CURRENT_FEEDBACK", value);
        }
      }
    },
	methods: {
		sendFeedback: function() {
                    var contents = this.currentFeedback;
                    if (contents.length == 0)
                        return;
                    let that = this;
                    var maxContextSize = peergos.shared.user.ServerMessage.MAX_CONTENT_SIZE;
                    var trimmedContents = contents.length > maxContextSize ? contents.substring(0, maxContextSize) : contents;
                    this.context.sendFeedback(trimmedContents)
                        .thenApply(function(res) {
                            if (res) {
                                console.log("Feedback submitted!");
                                that.$toast.info('Feedback sent. Thank you!',{timeout:false, position: 'bottom-left' })
                                that.$store.commit("SET_MODAL", false);
                                that.$store.commit("SET_CURRENT_FEEDBACK", "");
                            } else {
                                that.$toast.error('Error sending feedback',{timeout:false, position: 'bottom-left' })
                            }
                        }).exceptionally(function(throwable) {
                            that.$toast.error('Error sending feedback: ' + throwable.getMessage(),{timeout:false, position: 'bottom-left' })
                        });
                },
	},

};
</script>
<style>
.feedback textarea {
    color: var(--color);
    background-color: var(--bg);
}
.modal__warning {
	background-color: var(--bg-2);
	border-radius: 4px;
	padding: 16px;
}
.modal__warning.account p {
	margin-bottom: var(--app-margin);
}
</style>
