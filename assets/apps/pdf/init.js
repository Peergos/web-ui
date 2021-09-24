window.addEventListener('message', function (e) {
    // You must verify that the origin of the message's sender matches your
    // expectations. In this case, we're only planning on accepting messages
    // from our own origin, so we can simply compare the message event's
    // origin to the location of this document. If we get a message from an
    // unexpected host, ignore the message entirely.
    let parentDomain = window.location.host.substring(window.location.host.indexOf(".")+1)
    if (e.origin !== (window.location.protocol + "//" + parentDomain))
        return;
    
    var mainWindow = e.source;

    if (e.data.type == "ping") {
	    mainWindow.postMessage({action:'pong'}, e.origin);
    } else {
        PDFViewerApplication.setTitle(e.data.name);
        PDFViewerApplication.open(new Uint8Array(e.data.bytes));
    }
});
