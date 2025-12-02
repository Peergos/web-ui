<template>
	<AppModal class="space">
		<template #header>
			<h2>{{ translate("VERSION.TITLE") }}</h2>
		</template>
		<template #body>

			<h2 class="card__meta"> {{ version }}</h2>

		

		</template>
		<template #footer>

			<AppButton @click.native="close()" type="primary" block accent>{{ translate("VERSION.CLOSE") }}</AppButton>
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
			version:"",
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

    mounted() {
        let that = this;
        this.context.getVersion().thenApply(v => {
            that.version = v;
        });
    },

	methods: {
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
