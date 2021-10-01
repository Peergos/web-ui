var mainWindow;
var origin;

var isIframeInitialised = false;
function frameDomain() {
    return window.location.protocol + "//" + window.location.host;
}
var iframe = document.getElementById("markdown-iframe");
// Listen for response messages from the frames.
window.addEventListener('message', function (e) {
    // Normally, you should verify that the origin of the message's sender
    // was the origin and source you expected. This is easily done for the
    // unsandboxed frame. The sandboxed frame, on the other hand is more
    // difficult. Sandboxed iframes which lack the 'allow-same-origin'
    // header have "null" rather than a valid origin. This means you still
    // have to be careful about accepting data via the messaging API you
    // create. Check that source, and validate those inputs!
    if ((e.origin === "null" || e.origin === frameDomain()) && e.source === iframe.contentWindow) {
        if (e.data.action == 'pong') {
            isIframeInitialised = true;
        } else if(e.data.action == 'navigateTo') {
            mainWindow.postMessage({action:'navigateTo', path: e.data.path}, origin);
        } else if(e.data.action == 'loadImage') {
            mainWindow.postMessage({action:'loadImage', src: e.data.src, id: e.data.id}, origin);
        } else if(e.data.action == 'showMedia') {
            mainWindow.postMessage({action:'showMedia', path: e.data.path}, origin);
        }
    }

    let parentDomain = window.location.host.substring(window.location.host.indexOf(".")+1)
    if (e.origin !== (window.location.protocol + "//" + parentDomain))
        return;

    mainWindow = e.source;
    origin = e.origin;

    if (e.data.action == "ping") {
        mainWindow.postMessage({action:'pong'}, e.origin);
    } else if(e.data.action == "respondToLoadImage"){
        let func = function() {
            iframe.contentWindow.postMessage({action: "respondToLoadImage", id: e.data.id, data: e.data.data}, '*');
        };
        setupIFrameMessaging(iframe, func);
    } else if(e.data.action == "respondToNavigateTo"){
        let func = function() {
            iframe.contentWindow.postMessage({action: "respondToNavigateTo", text: e.data.text}, '*');
        };
        setupIFrameMessaging(iframe, func);
    }
});
function setupIFrameMessaging(iframe, func) {
    if (this.isIframeInitialised) {
        func();
    } else {
        iframe.contentWindow.postMessage({action: 'ping'}, '*');
        let that = this;
        window.setTimeout(function() {that.setupIFrameMessaging(iframe, func);}, 20);
    }
}
