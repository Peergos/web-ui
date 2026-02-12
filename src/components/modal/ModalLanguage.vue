<template>
	<AppModal>
		<template #header>
			<h2>{{ translate("LANGUAGE.CHOOSE") }}</h2>
		</template>
		<template #body>

                <div v-for="lang in getLanguages()" >
                    <AppButton@click.native="setLanguage(getLocale(lang))">
                        {{ lang }}
                    </AppButton>
                </div>

		</template>
		<template #footer>

		</template>
	</AppModal>
</template>

<script>
const AppButton = require("../AppButton.vue");
const AppModal = require("AppModal.vue");
const UriDecoder = require('../../mixins/uridecoder/index.js');
const i18n = require("../../i18n/index.js");

module.exports = {
    components: {
        AppButton,
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
    },
};
</script>
<style>

</style>
