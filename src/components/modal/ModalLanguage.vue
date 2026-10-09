<template>
	<AppModal :title="translate('LANGUAGE.CHOOSE')">
		<template #body>
			<div class="modal-language">
				<button v-for="lang in getLanguages()" type="button" class="pg-btn" @click="choose(lang)">{{ lang }}</button>
			</div>
		</template>
	</AppModal>
</template>

<script>
const AppModal = require("AppModal.vue");
const UriDecoder = require('../../mixins/uridecoder/index.js');
const i18n = require("../../i18n/index.js");

module.exports = {
    components: {
        AppModal,
    },
    
    data() {
        return {
        };
    },
    
    computed: {
	...Vuex.mapState([
	    'context'
	]),
    },
    mixins:[UriDecoder, i18n],
    methods: {
        // picking is the whole job of this dialog, so it closes once a language is picked
        choose(lang) {
            this.setLanguage(this.getLocale(lang));
            this.$store.commit("SET_MODAL", false);
        },
    },
};
</script>
<style>
.modal-language {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
	gap: 8px;
}
</style>
