module.exports = {
	methods: {

		updateHistory(app, path, filename) {
			if (this.isSecretLink)
				return;

			console.log('updateHistory:', app, path, filename)

			const currentProps = this.getPropsFromUrl();
			const pathFromUrl = currentProps == null ? null : currentProps.path;
			const appFromUrl = currentProps == null ? null : currentProps.app;

			if (path == pathFromUrl && app == appFromUrl)
				return;

			const rawProps = propsToFragment({ app: app, path: path, filename: filename });
			const props = this.encryptProps(rawProps);

			window.location.hash = "#" + propsToFragment(props);
		},

		getPropsFromUrl() {
			try {
				return this.decryptProps(fragmentToProps(window.location.hash.substring(1)));
			} catch (e) {
				console.log('getPropsFromUrl:', e)
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