function UserContextWrapper(context) {
    this.context = context;

    // String path
    // returns array of FileTreeNodeWrapper
    this.getByPath = function(path) {
	return Promise.resolve([]);
    }
}
