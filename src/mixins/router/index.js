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
        
        getApp(file, path) {
            var filename = file.getName();
	    var mimeType = file.getFileProperties().mimeType;
            if (mimeType.startsWith("audio") ||
		mimeType.startsWith("video") ||
		mimeType.startsWith("image")) {
		return 'Gallery';
	    } else if (mimeType === "application/vnd.peergos-todo") {
		return "Tasks";
	    } else if (mimeType === "application/pdf") {
		return "pdf";
	    } else if (mimeType === "text/calendar") {
		return "Calendar";
	    } else if (mimeType === "application/vnd.peergos-identity-proof") {
		return "identity-proof";
	    } else if (mimeType.startsWith("text/")) {
		return "editor";
	    } else {
		return "hex";
	    }
        },
    },
}
