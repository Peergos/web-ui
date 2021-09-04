<template>
	<main class="app-temp">
		<h1>Tasks view</h1>
	</main>
</template>

<script>

module.exports = {
	props: ["initContext", "initPath", "openFile", "initiateDownload"],
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
			this.$store.commit('SET_PATH', ['lorem','ipsum'])
			this.updateHistory('tasks', this.getPath,'')
	},
	methods: {
		updateHistory(app, path, filename) {
			console.log('task / updateHistory:', app, path, filename)
			if (this.isSecretLink)
				return;

			const currentProps = this.getPropsFromUrl();
			const pathFromUrl = currentProps == null ? null : currentProps.path;
			const appFromUrl = currentProps == null ? null : currentProps.app;

			if (path == pathFromUrl && app == appFromUrl)
				return;

			var rawProps = propsToFragment({ app: app, path: path, filename: filename });
			var props = this.encryptProps(rawProps);

			window.location.hash = "#" + propsToFragment(props);
		},
			getPropsFromUrl() {
				try {
					return this.decryptProps(fragmentToProps(window.location.hash.substring(1)));
				} catch (e) {
					return null;
				}
			},
			decryptProps(props) {
				if (this.isSecretLink)
					return path;

				return fragmentToProps(this.context.decryptURL(props.ciphertext, props.nonce));
			},

			encryptProps(props) {
				var both = this.context.encryptURL(props)
				const nonce = both.base64Nonce;
				const ciphertext = both.base64Ciphertext;
				return { nonce: nonce, ciphertext: ciphertext };
			},
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