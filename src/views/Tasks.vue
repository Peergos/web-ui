<template>
	<article class="app-view tasks-view">
		<AppHeader>
			<template #primary>
				<h1>Tasks view</h1>
			</template>
		</AppHeader>
		<main>

		</main>
	</article>
</template>

<script>
const routerMixins = require("../mixins/router/index.js");
const AppHeader = require("../components/AppHeader.vue");

module.exports = {
	components: {
		AppHeader,
	},
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
		this.updateHistory('Tasks', '/task' , null )
	},

}
</script>

<style>
.app-view{
	min-height: 100vh;

	/* display: flex;
	align-items: center;
	justify-content: center;
	min-height: 100vh; */
}
.app-view  h1{
	font-size:16px;
	line-height: 14px;
}
</style>