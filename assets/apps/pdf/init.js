let parentWindow = null;
let parentOrigin = null;
let saveHookInstalled = false;

window.addEventListener('message', function (e) {
    // You must verify that the origin of the message's sender matches your
    // expectations. In this case, we're only planning on accepting messages
    // from our own origin, so we can simply compare the message event's
    // origin to the location of this document. If we get a message from an
    // unexpected host, ignore the message entirely.
    let parentDomain = window.location.host.substring(window.location.host.indexOf(".")+1)
    if (e.origin !== (window.location.protocol + "//" + parentDomain))
        return;

    parentWindow = e.source;
    parentOrigin = e.origin;

    var loadFile = (ev) => {
        try {
            PDFViewerApplication.setTitle(ev.data.name);
            PDFViewerApplication.open({data:new Uint8Array(ev.data.bytes)});
            if (ev.data.writable) {
                installSaveHook();
            }
        } catch(ex) {
            setTimeout(() => loadFile(ev), 200)
        }
    }

    if (e.data.type == "ping") {
	    parentWindow.postMessage({action:'pong'}, e.origin);
    } else {
        loadFile(e);
    }
});

// Redirect the pdf.js viewer's Save button so it writes back to Peergos
// instead of triggering a browser download.
function installSaveHook() {
    if (saveHookInstalled) return;
    if (!window.PDFViewerApplication || !PDFViewerApplication.downloadManager) {
        setTimeout(installSaveHook, 100);
        return;
    }
    saveHookInstalled = true;
    const dm = PDFViewerApplication.downloadManager;
    dm.download = function(data, url, filename) {
        if (parentWindow && data) {
            parentWindow.postMessage({action:'save', bytes:data, filename:filename}, parentOrigin);
        }
    };
}

navigator.serviceWorker.getRegistration('./').then(swReg => {
    return swReg || navigator.serviceWorker.register('sw.js', {scope: './'})
}).catch(e => {
    console.log(e);
    let parentHost = window.location.protocol + "//" + window.location.host.substring(window.location.host.indexOf(".")+1)
    window.parent.postMessage("sw-registration-failure", parentHost)
})
