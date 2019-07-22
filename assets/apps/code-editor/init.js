window.addEventListener('message', function (e) {
    // You must verify that the origin of the message's sender matches your
    // expectations. In this case, we're only planning on accepting messages
    // from our own origin, so we can simply compare the message event's
    // origin to the location of this document. If we get a message from an
    // unexpected host, ignore the message entirely.
    if (e.origin !== (window.location.protocol + "//" + window.location.host))
        return;
    
    var mainWindow = e.source;

    document.getElementById("modeSource").src = "mode/" + e.data.mode + "/" + e.data.mode + ".js";
    CodeMirror.fromTextArea(document.getElementById("code"), {
	value: e.data.text,
	lineNumbers: true,
	mode: e.data.mode
    });
});

CodeMirror.fromTextArea(document.getElementById("code"));
