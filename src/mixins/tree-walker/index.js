module.exports = {
    methods: {
        loadFolders: function(path, callback) {
            var that = this;
            this.walkCounter = 0;
            let baseOfFolderTree = {};
            this.context.getByPath(path).thenApply(function(dir){
                that.walk(dir.get(), path, baseOfFolderTree, () => callback(baseOfFolderTree));
            }).exceptionally(function(throwable) {
                that.showSpinner = false;
                this.spinnerMessage = 'Unable to load folders...';
                throwable.printStackTrace();
            });
        },

        walk: function(file, path, currentTreeData, cb) {
            let fileProperties = file.getFileProperties();
            if (fileProperties.isHidden)
                return;
            currentTreeData.path = path.substring(0, path.length -1);
            currentTreeData.children = [];
            let that = this;
            if (fileProperties.isDirectory) {
                that.walkCounter++;
                if (that.walkCounter == 1) {
                    that.showSpinner = true;
                }
                file.getChildren(that.context.crypto.hasher, that.context.network).thenApply(function(children) {
                    let arr = children.toArray();
                    let size = arr.length;
                    if (size == 0) {
                        that.walkCounter--;
                        if (that.walkCounter == 0) {
                            cb();
                        }
                    }
                    arr.forEach(function(child, index){
                        let childProps = child.getFileProperties();
                        let newPath = childProps.isDirectory ? path + child.getFileProperties().name + '/' : path;
                        if (childProps.isDirectory && !childProps.isHidden) {
                            let node = {};
                            currentTreeData.children.push(node);
                            that.walk(child, newPath, node, cb);
                        }
                        if (index == size - 1) {
                            that.walkCounter--;
                            if (that.walkCounter == 0) {
                                cb();
                            }
                        }
                    });
                });
            }
        },

	}
}
