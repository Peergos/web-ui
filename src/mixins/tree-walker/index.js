module.exports = {
    methods: {
        loadSubFoldersAndFiles: function(path, fileExtension, filterMedia, fileFilters, callback) {
            this.loadSubFoldersNotRecursive(path, callback, true, fileExtension, filterMedia, fileFilters);
        },
        loadSubFolders: function(path, callback) {
            this.loadSubFoldersNotRecursive(path, callback, false, '', false, null);
        },

        loadSubFoldersNotRecursive: function(path, callback, includeFiles, fileExtension, filterMedia, fileFilters) {
            var that = this;
            let folderTree = {};
            this.context.getByPath(path).thenApply(function(dirOpt){
                let dir = dirOpt.get();
                let folderProperties = dir.getFileProperties();
                if (folderProperties.isDirectory && !folderProperties.isHidden) {
                    that.walkNotRecursive(dir, path, folderTree, includeFiles, fileExtension, filterMedia, fileFilters).thenApply( () => {
                        callback(folderTree);
                    });
                } else {
                    callback(folderTree);
                }
            }).exceptionally(function(throwable) {
                this.spinnerMessage = 'Unable to load sub folders...';
                throwable.printStackTrace();
            });
        },

        walkNotRecursive: function(file, path, currentTreeData, includeFiles, fileExtension, filterMedia, fileFilters) {
            currentTreeData.path = path.substring(0, path.length -1);
            currentTreeData.children = [];
            currentTreeData.isOpen = false;
            currentTreeData.isRoot = true;
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            file.getChildren(that.context.crypto.hasher, that.context.network).thenApply(function(children) {
                let arr = children.toArray();
                arr.sort((a, b) => a.getName().localeCompare(b.getName()));
                arr.forEach(function(child, index){
                    let childProps = child.getFileProperties();
                    let newPath = childProps.isDirectory ? path + child.getFileProperties().name + '/' : path;
                    if (childProps.isDirectory && !childProps.isHidden) {
                        let node = {};
                        node.path = newPath.substring(0, newPath.length -1);
                        node.children = [{lazy:true}];
                        node.isOpen = false;
                        currentTreeData.children.push(node);
                    }
                    if (includeFiles === true && !childProps.isDirectory && !childProps.isHidden) {
                        var fileMatch = false;
                        if (fileFilters != null) { //{fileExtensions: app.fileExtensions, mimeTypes: app.mimeTypes, fileTypes: app.fileTypes}
                            let wildcardInclude =  fileFilters.fileExtensions.length == 1 && fileFilters.fileExtensions[0] == '*'
                                                || fileFilters.mimeTypes.length == 1 && fileFilters.mimeTypes[0] == '*'
                                                || fileFilters.fileTypes.length == 1 && fileFilters.fileTypes[0] == '*'
                            let props = child.getFileProperties();
                            let filename = props.name.toLowerCase().trim();
                            let extensionMatches = fileFilters.fileExtensions.filter(ext => filename.endsWith(ext.toLowerCase().trim())).length > 0;
                            let mimeTypesMatches = fileFilters.mimeTypes.filter(mimeType => props.mimeType == mimeType).length > 0;
                            let fileType = props.getType();
                            let fileTypesMatches = fileFilters.fileTypes.filter(ft => fileType == ft).length > 0;
                            fileMatch = wildcardInclude || extensionMatches || mimeTypesMatches || fileTypesMatches;
                        } else {
                            let testAcceptAll = (fileExtension == null || fileExtension.length == 0 ) && !filterMedia;
                            var matchExtension = false;
                            if (!testAcceptAll ) {
                                if (filterMedia) {
                                    let mimeType = childProps.mimeType;
                                    matchExtension = mimeType.startsWith("image") || mimeType.startsWith("video");
                                }
                                if (!matchExtension) {
                                    let extensions = fileExtension.split(',').filter(e => e.length > 0).map(i => i.toLowerCase().trim());
                                    let matches = extensions.filter(ext => child.getFileProperties().name.toLowerCase().endsWith(ext));
                                    matchExtension = matches.length > 0;
                                }
                            }
                            fileMatch = testAcceptAll || matchExtension;
                        }
                        if (fileMatch) {
                            let node = {};
                            node.path = newPath + child.getName();
                            node.children = [];
                            node.isLeaf = true;
                            node.isOpen = false;
                            currentTreeData.children.push(node);
                        }
                    }
                });
                future.complete(true);
            });
            return future;
        },
	}
}
