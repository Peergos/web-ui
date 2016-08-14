function UserContextWrapper(context) {
    this.jcontext = context;

    // String path
    // return array of FileTreeNodeWrapper
    this.getByPath = function(path) {
	const that = this;
	return this.jcontext.getByPath(path).then(
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
	return javaNode.isDirectory();
    }

    this.getName = function() {
	return javaNode.getName();
    }

    this.getSize = function() {
	return javaNode.getSize();
    }

    // return FileTreeNodeWrapper[]
    this.getChildren = function() {
	this.getName().then(function(name){
	    console.log("Getting children of " + name + " from: " + window.context.jcontext);
	});
	return javaNode.getChildren(window.context.context);
    }
}
