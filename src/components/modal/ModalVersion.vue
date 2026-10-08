<template>
	<AppModal :title="translate('VERSION.TITLE')">
		<template #body>
			<p>{{ version }}</p>
		</template>
		<template #footer>
			<button type="button" class="pg-btn pg-btn--primary" @click="close()">{{ translate("VERSION.CLOSE") }}</button>
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
