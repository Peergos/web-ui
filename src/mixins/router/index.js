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
            let extension = currentFilename.substring(currentFilename.lastIndexOf(".") +1);

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
    getInbuiltApps(file) {
        let filename = file.getName();
        let mimeType = file.getFileProperties().mimeType;
        let matchingInbuiltApps = [];
        if (mimeType.startsWith("audio") || mimeType.startsWith("video") || mimeType.startsWith("image")) {
            let gallery = {name:'Gallery', contextMenuText: 'View in Gallery'};
            matchingInbuiltApps.push(gallery);
        } else if (mimeType === "application/vnd.peergos-todo") {
            let tasks = {name:"Tasks", contextMenuText: 'View in Tasks'};
            matchingInbuiltApps.push(tasks);
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
            let markdown = {name:"markdown", contextMenuText:'Open in Markdown Viewer'};
            matchingInbuiltApps.push(markdown);
        }
        if (mimeType.startsWith("text/html") ||
            ( mimeType.startsWith("text/") && filename.endsWith('.html'))
            || filename.endsWith('.portal')) {
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
	    if (mimeType === "application/vnd.peergos-todo") {
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
        } else if (mimeType.startsWith("text/html") ||
            ( mimeType.startsWith("text/") && filename.endsWith('.html'))
            || filename.endsWith('.portal')) {
            return writable ? "editor" : "htmlviewer";
	    } else if (mimeType.startsWith("text/")) {
		return "editor";
        } else if (mimeType.startsWith("audio") ||
        		mimeType.startsWith("video") ||
        		mimeType.startsWith("image")) {
        		return 'Gallery';
	    } else {
		return "hex";
	    }
        },

        openFileOrDir(app, path, args, writable) {
	    this.updateHistory(app, path, args, writable);
        }
    },
}
