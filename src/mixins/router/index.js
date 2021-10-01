module.exports = {
    methods: {
        canonical(path){
            if (path == null)
                return "";
            if (path.startsWith("/"))
                path = path.substring(1);
            if (path.endsWith("/"))
                path = path.substring(0, path.length - 1);
            return path;
        },
        
	updateHistory(app, path, filename) {
	    if (this.isSecretLink) {
                const sidebarApps = ["Drive", "NewsFeed", "Tasks", "Social", "Calendar", "Chat"]
                if (sidebarApps.includes(app)) {
		    this.$store.commit("CURRENT_VIEW", app);
                    if (app != "Drive") {
                        this.$store.commit('SET_PATH', path.split('/').filter(n => n.length > 0))
                        this.$store.commit('SET_CURRENT_FILENAME', filename)
                    }
                }
		return;
            }
            path = this.canonical(path);
	    console.log('updateHistory:', app, path, filename)
            
	    const currentProps = this.getPropsFromUrl();
	    const pathFromUrl = this.canonical(currentProps == null ? null : currentProps.path);
	    const appFromUrl = currentProps == null ? null : currentProps.app;
            const filenameFromUrl = currentProps == null ? null : currentProps.filename;
            
	    if (path == pathFromUrl && app == appFromUrl && filename == filenameFromUrl)
		return;
            
	    const rawProps = propsToFragment({ app: app, path: path, filename: filename });
	    const props = this.encryptProps(rawProps);
            
	    window.location.hash = "#" + propsToFragment(props);
	},
        
	getPropsFromUrl() {
            let hash = window.location.hash;
            if (hash.length == 0)
                return null;
	    try {
		return this.decryptProps(fragmentToProps(hash.substring(1)));
	    } catch (e) {
		return fragmentToProps(hash.substring(1));
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
            if (file.isDirectory()) {
                let pathParts = path.split("/");
                if (pathParts.length == 6 && pathParts[0] == '' &&
                    pathParts[2] == '.apps' &&
                    pathParts[3] == 'calendar' &&
                    pathParts[4] == 'data')
                    return "Calendar";
                if (pathParts.length >= 3 && pathParts[0] == '' &&
                    pathParts[2] == '.messaging')
                    return "Chat";
                return "Drive";
            }
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
	    } else if (mimeType.startsWith("text/") && filename.endsWith(".md")) {
		return "markdown";
	    } else if (mimeType.startsWith("text/")) {
		return "editor";
	    } else {
		return "hex";
	    }
        },

        openFileOrDir(app, path, filename) {
	    this.updateHistory(app, path, filename);
        }
    },
}
