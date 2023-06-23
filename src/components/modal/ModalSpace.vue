<template>
	<AppModal class="space">
		<template #header>
			<h2>Request space</h2>
		</template>
		<template #body>

			<h2 class="card__meta"> Current space: {{ quota }}</h2>

			<fieldset class="modal-space-form">
				<input
					type="text"
					name="space"
					@keyup="validateSpace()"
					v-model="space"
					placeholder="New total space amount"
				>
				<select v-model="unit">
					<option value = "MiB">MiB</option>
					<option value = "GiB">GiB</option>
				</select>
			</fieldset>

		</template>
		<template #footer>

			<AppButton @click.native="requestStorage()" type="primary" block accent>Request space</AppButton>
		</template>
	</AppModal>
</template>

<script>
import AppButton from "../AppButton.vue";
import AppModal from "./AppModal.vue";

export default {
    components: {
        AppButton,
        AppModal,
    },
	data() {
		return {
			unit:"GiB",
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
			if (this.unit == "GiB")
				return this.space*1024*1024*1024;
			return this.space*1024*1024;
		},

        validateSpace() {

            var bytes = parseInt(this.getRequestedBytes())
            if (bytes != this.getRequestedBytes()) {
				this.$toast.error('Space must be a positive integer', { position: 'bottom-left' })
                return false;
            }
            if (bytes < this.usage) {
                this.$toast.error(`You can't request space smaller than your current usage, please delete some files and try again.`, { position: 'bottom-left' })
                return false;
            }
            return true;
        },

        requestStorage() {
            if (!this.validateSpace())
                return;

            const that = this;
            this.context.requestSpace(this.getRequestedBytes()).thenApply(x => {
                that.$toast("Space request sent!");
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