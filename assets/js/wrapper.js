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
			    return convertToJSFile(file);
			});
		    }
		);
	    }
	);
    }
}

function FileTreeNodeWrapper(props) {
    this.props = props;
    this.type = props.isDirectory ? "dir" : "file";
    console.log("Modified: ");
    console.log(props.modified);

    // return FileTreeNodeWrapper[]
    this.getChildren = function(context) {
	console.log("Getting children of " + this.props.name);
	return props.java.getChildren(context.jcontext);
    }
}

function convertToJSFile(javaFileTreeNode) {
    const members = [
	["name", ftn => ftn.getFileProperties().then(props => props.name)],
	["size", ftn => ftn.getFileProperties().then(props => props.size)],
	["isHidden", ftn => ftn.getFileProperties().then(props => props.isHidden)],
	["modified", ftn => ftn.getFileProperties().then(props => props.modified).then(m => m.toString())]
    ];
    const functions = [
	["isDirectory", ftn => ftn.isDirectory()],
	["isWritable", ftn => ftn.isWritable()]
    ];
    return calculateProps(javaFileTreeNode, members, functions).then(function(fileWithProps) {
	return Promise.resolve(new FileTreeNodeWrapper(fileWithProps));
    });
}

//[java object], [string], [string] -> [{java:javaObject, string:member/result}]
function calculateAll(javaObjects, members, functions) {
    var futures = [];
    for (var i=0; i < javaObjects.length; i++)
	futures.push(calculateProps(javaObjects[i], members, functions));
    return Promise.all(futures);
}

//java object, [string], [string] -> Promise<{java:javaObject, string:member/result}>
function calculateProps(javaObject, members, functions) {
    var memberFutures = [];
    for (var i=0; i < members.length; i++)
	memberFutures.push(members[i][1](javaObject));
    for (var i=0; i < functions.length; i++)
	memberFutures.push(functions[i][1](javaObject));
    return Promise.all(memberFutures).then(function(props) {
	var res = {java:javaObject};
	for (var i=0; i < members.length; i++)
	    res[members[i][0]] = props[i];
	for (var i=0; i < functions.length; i++)
	    res[functions[i][0]] = props[i + members.length];
	return Promise.resolve(res);
    });
}
