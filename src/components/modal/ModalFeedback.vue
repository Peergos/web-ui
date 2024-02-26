<template>
	<AppModal class="feedback">
		<template #header>
			<h2>{{ translate("FEEDBACK.TITLE") }}</h2>
		</template>
		<template #body>
		    <h3>
                        {{ translate("FEEDBACK.TEXT1") }} <a href="https://matrix.to/#/#peergos-chat:matrix.org" target="_blank" rel="noopener noreferrer"><u>Matrix</u></a> {{ translate("FEEDBACK.TEXT2") }}: <a href="mailto:feedback@peergos.org">feedback@peergos.org</a>
                    </h3>
                    <p>
                        <textarea id="feedback-text" v-model="currentFeedback" spellcheck="true" style="width:100%" rows=5 :placeholder="textAreaPlaceholder" maxlength="1000"></textarea>
                    </p>
		</template>
		<template #footer>

			 <AppButton @click.native="sendFeedback()" type="primary" block accent>{{ translate("FEEDBACK.SUBMIT") }}</AppButton>

		</template>
	</AppModal>
</template>

<script>
const AppButton = require("../AppButton.vue");
const AppModal = require("AppModal.vue");
const i18n = require("../../i18n/index.js");


module.exports = {
	components: {
	    AppButton,
    	    AppModal
	},
        mixins:[i18n],
	data() {
		return {
			textAreaPlaceholder: this.translate("FEEDBACK.PLACEHOLDER"),
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
                                that.$toast.info(that.translate("FEEDBACK.SENT"),{timeout:false, position: 'bottom-left' })
                                that.$store.commit("SET_MODAL", false);
                                that.$store.commit("SET_CURRENT_FEEDBACK", "");
                            } else {
                                that.$toast.error(that.translate("FEEDBACK.ERROR"),{timeout:false, position: 'bottom-left' })
                            }
                        }).exceptionally(function(throwable) {
                            that.$toast.error(that.translate("FEEDBACK.ERROR")+': ' + throwable.getMessage(),{timeout:false, position: 'bottom-left' })
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
