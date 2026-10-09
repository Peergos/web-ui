<template>
	<AppModal :title="translate('PAID.CANCEL')">
		<template #body>
			<label class="app-modal__field">
				<span>{{ translate("PAID.CANCEL.WHY") }}</span>
				<textarea class="pg-input" v-model="feedback" :placeholder="translate('FEEDBACK.BETTER')"></textarea>
			</label>
			<label class="pg-switch app-modal__switch">
				<input type="checkbox" v-model="allowEmailFollowup">
				<span class="pg-switch__track" aria-hidden="true"></span>
				<span>{{ translate("PAID.CANCEL.FOLLOWUP") }}</span>
			</label>
		</template>
		<template #footer>
			<button type="button" class="pg-btn" @click="close()">{{ translate("PAID.CANCEL.OK") }}</button>
			<button type="button" class="pg-btn pg-btn--danger" :disabled="disabled" @click="cancelPaid()">{{ translate("PAID.CANCEL.CONFIRM") }}</button>
		</template>
	</AppModal>
</template>

<script>
const AppModal = require("AppModal.vue");
const i18n = require("../../i18n/index.js");
const Feedback = require("../../mixins/feedback/index.js");

module.exports = {
	components: {
	    AppModal,
	},
        mixins:[i18n, Feedback],
	data() {
		return {
		    feedback: "",
		    allowEmailFollowup: false
		};
	},
	computed: {
		...Vuex.mapState([
			'context',
		]),
		...Vuex.mapGetters([
			'quota',
		]),
            disabled: function() {
                return this.feedback.length == 0;
            }
    },
	methods: {
		...Vuex.mapActions([
			'updateQuota',
		]),
            requestStorage(bytes) {
		var that = this;
                this.sendUserFeedback(this.context, this.feedback, this.allowEmailFollowup);
                this.context.requestSpace(0)
		    .thenApply(x => that.updateQuota(quotaBytes => {
			that.$store.commit("SET_MODAL", false)
			that.$toast.error(that.translate("PAID.SORRY"), {timeout:false, id: 'pro'})
		    })).exceptionally(t => {
                        that.$toast.error(that.translate("PAID.ERROR.CANCEL")+": " + t.getMessage())
                    })
	    },

            close() {
                this.$store.commit("SET_MODAL", false);
            },
            
	    cancelPaid() {
                this.requestStorage(0);
            },
	},
};
</script>
