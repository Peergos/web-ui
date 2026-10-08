<template>
	<AppModal :title="translate('SPACE.TITLE')">
		<template #body>
			<p>{{ translate("SPACE.CURRENT") }}: {{ quota }}</p>
			<div class="modal-space__form">
				<input
					class="pg-input"
					type="text"
					name="space"
					@keyup="validateSpace()"
					v-model="space"
					:placeholder="translate('SPACE.PLACEHOLDER')"
				>
				<select class="fp-select modal-space__unit" v-model="unit">
					<option value = "MB">MB</option>
					<option value = "GB">GB</option>
				</select>
			</div>
		</template>
		<template #footer>
			<button type="button" class="pg-btn pg-btn--primary" @click="requestStorage()">{{ translate("SPACE.TITLE") }}</button>
		</template>
	</AppModal>
</template>

<script>
const AppModal = require("AppModal.vue");
const i18n = require("../../i18n/index.js");

module.exports = {
    components: {
        AppModal,
    },
        mixins:[i18n],
	data() {
		return {
			unit:"GB",
			space:"",
		};
	},
	computed: {
		...Vuex.mapState([
			'context'
		]),
		...Vuex.mapGetters([
			'quota',
			'usage'
		]),
    },

	methods: {
		getRequestedBytes() {
			if (this.unit == "GB")
				return this.space*1000*1000*1000;
			return this.space*1000*1000;
		},

        validateSpace() {

            var bytes = parseInt(this.getRequestedBytes())
            if (bytes != this.getRequestedBytes()) {
				this.$toast.error(this.translate("SPACE.POSITIVE"), { position: 'bottom-left' })
                return false;
            }
            if (bytes < this.usage) {
                this.$toast.error(this.translate("SPACE.SMALL"), { position: 'bottom-left' })
                return false;
            }
            return true;
        },

        requestStorage() {
            if (!this.validateSpace())
                return;

            const that = this;
            this.context.requestSpace(this.getRequestedBytes()).thenApply(x => {
                that.$toast(that.translate("SPACE.SENT"));
                that.close();
            })
        },
		close(){
			this.$store.commit("SET_MODAL", false);
		}

	},

};
</script>
<style>
.modal-space__form {
	display: flex;
	gap: 8px;
}

.modal-space__form .pg-input {
	flex: 1 1 auto;
}

.modal-space__form .modal-space__unit {
	flex: 0 0 88px;
	width: 88px;
}
</style>
