var editor;
var mainWindow;
var origin;
var attacher;
window.addEventListener('message', function (e) {
    // You must verify that the origin of the message's sender matches your
    // expectations. In this case, we're only planning on accepting messages
    // from our own origin, so we can simply compare the message event's
    // origin to the location of this document. If we get a message from an
    // unexpected host, ignore the message entirely.
    if (e.origin !== (window.location.protocol + "//" + window.location.host))
        return;
    
    mainWindow = e.source;
    origin = e.origin;

    if (e.data.type == "save") {
	var text = editor.getValue();
	mainWindow.postMessage({text:text}, e.origin);
    } else {
	var modejs = document.getElementById("modeSource");
	modejs.src = "mode/" + e.data.mode + "/" + e.data.mode + ".js";
	document.getElementById("code").value = e.data.text;
	attacher = function() {
	    editor = CodeMirror.fromTextArea(document.getElementById("code"), {
		lineNumbers: true,
		lineWrapping: true,
//		matchBrackets: true,
		mode: e.data.mime,
	    });
	};
	modejs.onload = attacher;
    }
});
