function UserContextWrapper(context) {
    this.context = context;

    // String path
    // return array of FileTreeNodeWrapper
    this.getByPath = function(path) {
	const that = this;
	return context.getByPath(path).then(
	    function(fileOpt) {
		return fileOpt.isPresent().then(
		    function(present) {
			if (!present)
			    return Promise.resolve({});
			return fileOpt.get().then(function(file){
			    return Promise.resolve(new FileTreeNodeWrapper(file));
			})
		    }
		);
	    }
	);
    }
}

function FileTreeNodeWrapper(javaNode) {
    this.javaNode = javaNode;

    this.isDirectory = function() {
	
    }

    this.getName = function() {
	
    }

    this.getChildren = function() {
	return javaNode.getChildren(window.context);
    }
}
