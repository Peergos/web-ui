<template>
	<AppModal>
		<template #header>
			<h2>{{ translate("PAID.CANCEL") }}</h2>
		</template>
		<template #body>

                    <label>Why are you cancelling?</label>		
                    <textarea v-model="feedback" style="height:200px;" placeholder="What can we do better?"></textarea>

		</template>
		<template #footer>
			<AppButton @click.native="close()" type="primary" block accent>{{ translate("PAID.CANCEL.OK") }}</AppButton>
			<AppButton :disabled="disabled" @click.native="cancelPaid()" type="primary" block class="alert" >{{ translate("PAID.CANCEL.CONFIRM") }}</AppButton>
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
	    AppModal,
	},
        mixins:[i18n],
	data() {
		return {
		    feedback: ""
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
                var maxContextSize = peergos.shared.user.ServerMessage.MAX_CONTENT_SIZE;
                var trimmedContents = this.feedback.length > maxContextSize ? this.feedback.substring(0, maxContextSize) : this.feedback;
                this.context.sendFeedback(trimmedContents);
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
<style>

.app-modal__container h2{
	font-size: var(--title);
	font-weight: var(--bold);
}
.app-modal__container .card__meta{
	background-color: var(--bg-2);
	border-radius: 4px;
	padding: 16px;
	margin-top:var(--app-margin);
	text-align: center;
}
.app-modal__container .card__meta > *{
	margin-top: 0;
}
.app-modal__container .card__meta ul{
	list-style:none;
	padding: 0px;
	text-align: left;
	margin:16px 0;
}
.app-modal__container .card__meta li{
	color: var(--color);
	line-height: 32px;
	background: url('data:image/svg+xml;utf8,<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M19.5224 6.16169L9.17909 16.505L4.4776 11.8035" stroke="mediumaquamarine" stroke-width="2"/></svg>') left center no-repeat;
	background-size: 24px auto;
    padding-left: 32px;
}
.app-modal__container h2.card__meta{
	font-size: var(--text);
}
.app-modal__container .options_container{
	display: flex;
        flex-direction: row;
        flex-wrap: wrap;
        justify-content: space-around;
}
.app-modal__container .options{
	
}
.app-modal__container .app-button.alert:disabled{
	background-color: gray;
}
.app-modal__container .app-button.alert:disabled:hover{
	background-color: gray;
}
.app-modal__container .app-button.alert{
	background-color: var(--alert);
	color:var(--bg);
	margin-top:8px;
}
.app-modal__container .app-button.alert:hover{
	background-color: var(--alert-hover);
}
</style>
