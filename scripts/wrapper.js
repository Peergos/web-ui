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
			    return file.getFileProperties().then(function(properties) {
				return Promise.resolve(new FileTreeNodeWrapper(file, properties));
			    });
			})
		    }
		);
	    }
	);
    }
}

function FileTreeNodeWrapper(javaNode, properties) {
    this.javaNode = javaNode;
    this.properties = properties;

    this.isDirectory = function() {
	return javaNode.isDirectory();
    }

    // return FileTreeNodeWrapper[]
    this.getChildren = function() {
	console.log("Getting children of " + this.properties.name);
	return javaNode.getChildren(window.context.jcontext);
    }
}
