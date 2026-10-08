<template>
	<AppModal :title="translate('FEEDBACK.TITLE')">
		<template #body>
			<p>
				{{ translate("FEEDBACK.TEXT1") }} <a href="https://matrix.to/#/#peergos-chat:matrix.org" target="_blank" rel="noopener noreferrer"><u>Matrix</u></a> {{ translate("FEEDBACK.TEXT2") }}: <a href="mailto:feedback@peergos.org">feedback@peergos.org</a>
			</p>
			<textarea id="feedback-text" class="pg-input" v-model="currentFeedback" spellcheck="true" rows=5 :placeholder="textAreaPlaceholder" maxlength="1000"></textarea>
		</template>
		<template #footer>
			<button type="button" class="pg-btn pg-btn--primary" @click="sendFeedback()">{{ translate("FEEDBACK.SUBMIT") }}</button>
		</template>
	</AppModal>
</template>

<script>
const AppModal = require("AppModal.vue");
const i18n = require("../../i18n/index.js");


module.exports = {
	components: {
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
