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

	updateHistory(app, path, args, writable) {
            path = this.canonical(path);
	    console.log('updateHistory:', app, path, args)
            
	    const currentProps = this.getPropsFromUrl();
	    const pathFromUrl = this.canonical(currentProps == null ? null : currentProps.path);
	    const appFromUrl = currentProps == null ? null : currentProps.app;
            const argsFromUrl = currentProps == null ? null : currentProps.args;
            
	    if (path == pathFromUrl && app == appFromUrl && JSON.stringify(args) === JSON.stringify(argsFromUrl))
		return;

            var rawProps = { app: app, path: path, args: args, writable: writable || false }
	    if (currentProps != null && currentProps.secretLink) {
                rawProps.secretLink = true;
                rawProps.link = currentProps.link;
                if (currentProps.open)
                    rawProps.open = true;
            }
	    var encodedProps = propsToFragment(rawProps);
            const props = (currentProps != null && currentProps.secretLink) ? rawProps : this.encryptProps(encodedProps);
            
	    window.location.hash = "#" + propsToFragment(props);
	},
        
	getPropsFromUrl() {
            let hash = window.location.hash;
            if (hash.length == 0)
                return null;
	    try {
                const rawProps = fragmentToProps(hash.substring(1))
		return this.decryptProps(rawProps);
	    } catch (e) {
                try {
		    return rawProps;
                } catch (f) {
                    return null;
                }
	    }
	},
	decryptProps(props) {
	    if (props.secretLink)
		return props;
            
	    return fragmentToProps(this.context.decryptURL(props.ciphertext, props.nonce));
	},
        
	encryptProps(props) {
	    var both = this.context.encryptURL(props)
	    const nonce = both.base64Nonce;
	    const ciphertext = both.base64Ciphertext;
	    return { nonce: nonce, ciphertext: ciphertext };
	},
        
        getApp(file, path, writable) {
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
        } else if (mimeType.startsWith("text/x-markdown") ||
            ( mimeType.startsWith("text/") && filename.endsWith('.md'))) {
            return writable ? "editor" : "markdown";
	    } else if (mimeType.startsWith("text/")) {
		return "editor";
	    } else {
		return "hex";
	    }
        },

        openFileOrDir(app, path, args, writable) {
	    this.updateHistory(app, path, args, writable);
        }
    },
}
