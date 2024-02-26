<template>
	<AppModal class="space">
		<template #header>
			<h2>{{ translate("SPACE.TITLE") }}</h2>
		</template>
		<template #body>

			<h2 class="card__meta"> {{ translate("SPACE.CURRENT") }}: {{ quota }}</h2>

			<fieldset class="modal-space-form">
				<input
					type="text"
					name="space"
					@keyup="validateSpace()"
					v-model="space"
					:placeholder="translate('SPACE.PLACEHOLDER')"
				>
				<select v-model="unit">
					<option value = "MB">MB</option>
					<option value = "GB">GB</option>
				</select>
			</fieldset>

		</template>
		<template #footer>

			<AppButton @click.native="requestStorage()" type="primary" block accent>{{ translate("SPACE.TITLE") }}</AppButton>
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

.modal-space-form{
	display:flex;
	margin: var(--app-margin) 0;

}

</style>
