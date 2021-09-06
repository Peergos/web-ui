<template>
	<main class="app-temp">
		<h1>Tasks view</h1>
	</main>
</template>

<script>

const routerMixins = require("../mixins/router/index.js");



module.exports = {
	props: ["initContext", "initPath", "openFile", "initiateDownload"],

	mixins:[routerMixins],

	computed: {
		...Vuex.mapState([
			'context',
		]),
		...Vuex.mapGetters([
			'isSecretLink',
			'getPath'
		]),
	},

	mounted(){
		this.updateHistory('Tasks', null , null )
	},

}
</script>

<style>
.app-temp{
	display: flex;
	align-items: center;
	justify-content: center;
	min-height: 100vh;
}
.app-temp h1{
	text-align: center;
}
</style>