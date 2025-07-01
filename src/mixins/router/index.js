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
                if (currentProps.linkpassword != null)
                    rawProps.linkpassword = currentProps.linkpassword
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
            var rawProps = null;
	    try {
                rawProps = fragmentToProps(hash.substring(1))
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

    availableAppsForFile: function(file) {
       try {
           if (file.getFileProperties().isHidden)
               return [];
            if (file.isDirectory()) {
                let folderApps = this.sandboxedApps.appsInstalled.slice().filter(app => app.folderAction);
                return folderApps.sort(function(a, b) {
                    return a.displayName.localeCompare(b.displayName);
                });
            }
            let currentFilename = file.getFileProperties().name;
            let extension = currentFilename.substring(currentFilename.lastIndexOf(".") +1).toLowerCase();

            var currentFileExtensionMapping = this.sandboxedApps.appFileExtensionRegistrationMap.get(extension);
            currentFileExtensionMapping = currentFileExtensionMapping == null ? [] : currentFileExtensionMapping;
            currentFileExtensionMapping = currentFileExtensionMapping.concat(this.sandboxedApps.appFileExtensionWildcardRegistrationList);

            let mimeType = file.getFileProperties().mimeType;
            var currentMimeTypeMapping = this.sandboxedApps.appMimeTypeRegistrationMap.get(mimeType);
            currentMimeTypeMapping = currentMimeTypeMapping == null ? [] : currentMimeTypeMapping;
            currentMimeTypeMapping = currentMimeTypeMapping.concat(this.sandboxedApps.appMimeTypeWildcardRegistrationList);

            let fileType = file.getFileProperties().getType();
            var currentFileTypeMapping = this.sandboxedApps.appFileTypeRegistrationMap.get(fileType);
            currentFileTypeMapping = currentFileTypeMapping == null ? [] : currentFileTypeMapping;
            currentFileTypeMapping = currentFileTypeMapping.concat(this.sandboxedApps.appFileTypeWildcardRegistrationList);

            let combinedMapping = currentFileExtensionMapping
                .concat(currentMimeTypeMapping)
                .concat(currentFileTypeMapping)
                .filter(a => !a.folderAction);
            let dedupedItems = [];
            combinedMapping.forEach(item => {
                let foundIndex = dedupedItems.findIndex(v => v.name === item.name);
                if (foundIndex == -1) {
                    dedupedItems.push(item);
                }
            });
            return dedupedItems.sort(function(a, b) {
                return a.displayName.localeCompare(b.displayName);
            });
       } catch (err) {
           return [];
       }
    },
    getRecommendedViewer(file) {
        let filename = file.getName();
        if (file.isDirectory()) {
            return null;
        }
        try {
            let extension = filename.substring(filename.lastIndexOf(".") + 1).toLowerCase();
            if (extension == "docx" || extension == "odt") {
                return "doc-viewer";
            } else if (extension == "sheet" || extension == "xlsx" || extension == "ods") {
                return "luckysheet";
            } else if (extension == "tldr") {
                return "tldraw";
            } else if (extension == "drawio") {
                return "drawio";
            } else if (extension == "epub") {
                return "ebookreader";
            }
        } catch (ex) {
            return null;
        }
        return null;
    },
    getInbuiltApps(file) {
        let filename = file.getName();
        let mimeType = file.getFileProperties().mimeType;
        let matchingInbuiltApps = [];
        if (mimeType.startsWith("audio") || mimeType.startsWith("video") || mimeType.startsWith("image")) {
            let gallery = {name:'Gallery', contextMenuText: 'View in Gallery'};
            matchingInbuiltApps.push(gallery);
        } else if (mimeType === "application/pdf") {
            let pdf = {name:"pdf", contextMenuText: 'Open PDF Viewer'};
            matchingInbuiltApps.push(pdf);
        } else if (mimeType === "text/calendar") {
            let calendar = {name:"Calendar", contextMenuText: 'Open Calendar'};
            matchingInbuiltApps.push(calendar);
        } else if (mimeType === "application/vnd.peergos-identity-proof") {
            let identity = {name:"identity-proof", contextMenuText: 'Open in Identify Proof Viewer'};
            matchingInbuiltApps.push(identity);
        }
        if (mimeType.startsWith("text/x-markdown") ||
           ( mimeType.startsWith("text/") && filename.endsWith('.md'))) {
            let markup = {name:"markup", contextMenuText:'Open in Markdown Viewer'};
            matchingInbuiltApps.push(markup);
        }
        if (mimeType.startsWith("text/") && filename.endsWith('.note')) {
            let markup = {name:"markup", contextMenuText:'Open in Notes Viewer'};
            matchingInbuiltApps.push(markup);
        }
        if (mimeType.startsWith("text/html") ||
            ( mimeType.startsWith("text/") && filename.endsWith('.html'))) {
            let htmlviewer = {name:"htmlviewer", contextMenuText:'Open in HTML Viewer'};
            matchingInbuiltApps.push(htmlviewer);
        }
        if (mimeType.startsWith("text/")) {
            let editor = {name:"editor", contextMenuText:'Open in Text Editor'};
            matchingInbuiltApps.push(editor);
        }
        if (matchingInbuiltApps.length == 0) {
            let hex = {name:"hex", contextMenuText:'Open in Hex Viewer'};
            matchingInbuiltApps.push(hex);
        }
        return matchingInbuiltApps;
    },
        getApp(file, path, writable) {
            let pathParts = path.split("/");
            if (pathParts.length >= 4) {
                if (pathParts[0] == '' &&
                    pathParts[2] == '.apps' &&
                    pathParts[3] == 'calendar' &&
                    pathParts.length <= 6)
                    return "Calendar";
                if (pathParts[0] == '' &&
                    pathParts[2] == '.messaging')
                    return "Chat";
            }
            if (file.isDirectory()) {
                return "Drive";
            }
            var filename = file.getName();
	    var mimeType = file.getFileProperties().mimeType;
            if (mimeType.startsWith("audio") ||
		mimeType.startsWith("video") ||
		mimeType.startsWith("image")) {
		return 'Gallery';
	    } else if (mimeType === "application/pdf") {
		return "pdf";
	    } else if (mimeType === "text/calendar") {
		return "Calendar";
	    } else if (mimeType === "application/vnd.peergos-identity-proof") {
		return "identity-proof";
        } else if (mimeType.startsWith("text/x-markdown") ||
            ( mimeType.startsWith("text/") &&
            ( filename.endsWith('.md') || filename.endsWith('.note') ) )  ) {
            return writable ? "editor" : "markup";
        } else if (mimeType.startsWith("text/html") ||
            ( mimeType.startsWith("text/") && filename.endsWith('.html'))) {
            return writable ? "editor" : "htmlviewer";
	    } else if (mimeType.startsWith("text/") || mimeType == "application/json") {
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
