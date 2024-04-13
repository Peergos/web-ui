module.exports = {
    methods: {
        loadFoldersAndFiles: function(path, fileExtension, filterMedia, callback) {
            this.loadAllFolders(path, callback, true, fileExtension, filterMedia);
        },
        loadSubFoldersAndFiles: function(path, fileExtension, filterMedia, callback) {
            this.loadSubFoldersNotRecursive(path, callback, true, fileExtension, filterMedia);
        },
        loadFolders: function(path, callback) {
            this.loadAllFolders(path, callback, false, '', false);
        },
        loadSubFolders: function(path, callback) {
            this.loadSubFoldersNotRecursive(path, callback, false, '', false);
        },
        loadAllFolders: function(path, callback, includeFiles, fileExtension, filterMedia) {
            var that = this;
            let folderTree = {};
            this.context.getByPath(path).thenApply(function(dirOpt){
                let dir = dirOpt.get();
                let folderProperties = dir.getFileProperties();
                if (folderProperties.isDirectory && !folderProperties.isHidden) {
                    that.walk(dir, path, folderTree, includeFiles, fileExtension, filterMedia).thenApply( () => {
                        callback(folderTree);
                    });
                } else {
                    callback(folderTree);
                }
            }).exceptionally(function(throwable) {
                this.spinnerMessage = 'Unable to load folders...';
                throwable.printStackTrace();
            });
        },

        walk: function(file, path, currentTreeData, includeFiles, fileExtension, filterMedia) {
            currentTreeData.path = path.substring(0, path.length -1);
            currentTreeData.children = [];
            currentTreeData.isOpen = false;
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            file.getChildren(that.context.crypto.hasher, that.context.network).thenApply(function(children) {
                let arr = children.toArray();
                let funcArray = [];
                arr.forEach(function(child, index){
                    let childProps = child.getFileProperties();
                    let newPath = childProps.isDirectory ? path + child.getFileProperties().name + '/' : path;
                    if (childProps.isDirectory && !childProps.isHidden) {
                        let node = {};
                        currentTreeData.children.push(node);
                        funcArray.push(() => {
                            return that.walk(child, newPath, node, includeFiles, fileExtension, filterMedia);
                        });
                    }
                    if (includeFiles === true && !childProps.isDirectory && !childProps.isHidden) {
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
                        if (testAcceptAll || matchExtension) {
                            let node = {};
                            currentTreeData.children.push(node);
                            funcArray.push(() => {
                                return that.addFile(child, newPath, node);
                            });
                        }
                    }
                });
                if (funcArray.length > 0) {
                    let completed = {count: 0};
                    funcArray.forEach((func, idx) => {
                        func().thenApply(() => {
                            completed.count ++;
                            if (completed.count == funcArray.length) {
                                future.complete(true);
                            }
                        });
                    });
                } else {
                    future.complete(true);
                }
            });
            return future;
        },
        addFile(file, path, currentTreeData) {
            let future = peergos.shared.util.Futures.incomplete();
            currentTreeData.path = path + file.getName();
            currentTreeData.children = [];
            currentTreeData.isLeaf = true;
            currentTreeData.isOpen = false;
            future.complete(true);
            return future;
        },
        loadSubFoldersNotRecursive: function(path, callback, includeFiles, fileExtension, filterMedia) {
            var that = this;
            let folderTree = {};
            this.context.getByPath(path).thenApply(function(dirOpt){
                let dir = dirOpt.get();
                let folderProperties = dir.getFileProperties();
                if (folderProperties.isDirectory && !folderProperties.isHidden) {
                    that.walkNotRecursive(dir, path, folderTree, includeFiles, fileExtension, filterMedia).thenApply( () => {
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

        walkNotRecursive: function(file, path, currentTreeData, includeFiles, fileExtension, filterMedia) {
            currentTreeData.path = path.substring(0, path.length -1);
            currentTreeData.children = [];
            currentTreeData.isOpen = false;
            currentTreeData.isRoot = true;
            let that = this;
            let future = peergos.shared.util.Futures.incomplete();
            file.getChildren(that.context.crypto.hasher, that.context.network).thenApply(function(children) {
                let arr = children.toArray();
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
                        if (testAcceptAll || matchExtension) {
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