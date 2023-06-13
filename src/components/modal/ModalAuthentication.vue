<template>
	<AppModal>
		<template #header>
			<h2>Authenticate</h2>
		</template>
		<template #body>
            <Spinner v-if="showSpinner"></Spinner>
		</template>
		<template #footer>
			 <AppButton  @click.native="authenticate()" type="primary" block accent>Authenticate</AppButton>
		</template>
	</AppModal>
</template>

<script>
const AppButton = require("../AppButton.vue");
const AppModal = require("AppModal.vue");
const Spinner = require("../spinner/Spinner.vue");

module.exports = {
    components: {
        AppButton,
        AppModal,
        Spinner,
    },
    
    data() {
        return {
        showSpinner: false,
    },
    
    computed: {
	...Vuex.mapState([
	    'context'
	]),
    },
    mixins:[],
    methods: {
	authenticate() {
        console.log('authenticate');
    },
};
</script>
<style>

</style>
