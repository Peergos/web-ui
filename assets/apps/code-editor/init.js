var editor;
var mainWindow;
var origin;
var attacher;
var countDownToReady;
window.addEventListener('message', function (e) {
    // You must verify that the origin of the message's sender matches your
    // expectations. In this case, we're only planning on accepting messages
    // from our own origin, so we can simply compare the message event's
    // origin to the location of this document. If we get a message from an
    // unexpected host, ignore the message entirely.
    let parentDomain = window.location.host.substring(window.location.host.indexOf(".")+1)
    if (e.origin !== (window.location.protocol + "//" + parentDomain))
        return;
    
    mainWindow = e.source;
    origin = e.origin;

    if (e.data.type == "ping") {
	    mainWindow.postMessage({action:'pong'}, e.origin);
    } else if (e.data.type == "save") {
        var text = editor.getValue();
        mainWindow.postMessage({text:text}, e.origin);
    } else {
        document.getElementById("code").value = e.data.text;
        var modes = e.data.modes;
        countDownToReady = modes.length;
        for (var i=0; i < modes.length; i++) {
            var script = document.createElement("script");
            script.type = "text/javascript";
            script.src = "mode/" + modes[i] + "/" + modes[i] + ".js";
            attacher = function() {
            countDownToReady--;
            if (countDownToReady == 0)
                editor = CodeMirror.fromTextArea(document.getElementById("code"), {
                lineNumbers: true,
                lineWrapping: true,
                readOnly: e.data.readOnly,
                //		matchBrackets: true,
                mode: e.data.mime,
                });
            };
            script.onload = attacher;
            document.getElementsByTagName("head")[0].appendChild(script);
        }
    }
});

navigator.serviceWorker.getRegistration('./').then(swReg => {
    return swReg || navigator.serviceWorker.register('sw.js', {scope: './'})
}).catch(e => {
    console.log(e);
    let parentHost = window.location.protocol + "//" + window.location.host.substring(window.location.host.indexOf(".")+1)
    window.parent.postMessage("sw-registration-failure", parentHost)
})
