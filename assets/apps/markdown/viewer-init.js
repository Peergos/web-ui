var mainWindow;
var origin;
window.addEventListener('message', function (e) {
    // You must verify that the origin of the message's sender matches your
    // expectations. In this case, we're only planning on accepting messages
    // from our own origin, so we can simply compare the message event's
    // origin to the location of this document. If we get a message from an
    // unexpected host, ignore the message entirely.
    let parentDomain = window.location.host;//.substring(window.location.host.indexOf(".")+1)
    if (e.origin !== (window.location.protocol + "//" + parentDomain))
        return;
    
    mainWindow = e.source;
    origin = e.origin;

    if (e.data.action == "ping") {
	    mainWindow.postMessage({action:'pong'}, e.origin);
    }else if(e.data.action == "respondToLoadImage"){
        let image = document.getElementById(e.data.id);
        let blob = new Blob([e.data.data]);
        image.src = URL.createObjectURL(blob);
    } else if(e.data.action == "respondToNavigateTo"){
        //document.getElementById("code").value = e.data.text;
        let div = document.createElement('div');
        const viewer = new toastui.Editor({
            el: div,
            initialValue: e.data.text,
            usageStatistics: false,
            headless: true
        });
        let output = viewer.getHTML();
        let xss = DOMPurify.sanitize(output);
        document.getElementById('sanitized').innerHTML = xss;
        let anchors = document.getElementsByTagName("a");
        for(var i=0; i < anchors.length;i++) {
            let anchor = anchors[i];
            anchor.addEventListener("click", function(e){
                console.log("link pressed");
                e.preventDefault();
                let url = e.target.href;
                if (url == null) {
                    let media = e.target.parentElement;
                    mainWindow.postMessage({action:'showMedia', path: media.pathname}, origin);
                } else {
                    const requestedResource = new URL(url);
                    mainWindow.postMessage({action:'navigateTo', path: requestedResource.pathname}, origin);
                }
            });
        }
        let images = document.getElementsByTagName("img");
        for(var i=0; i < images.length;i++) {
            let image = images[i];
            const requestedResource = new URL(image.src);
            image.src = '';
            let generatedId = 'image-' + uuid();
            image.id = generatedId;
            mainWindow.postMessage({action:'loadImage', src: requestedResource.pathname, id: generatedId}, origin);
        }
        /*
        let ifr = document.getElementById('ifr');
        ifr.contentDocument.open();
        ifr.contentDocument.write(xss.toString());
        ifr.contentDocument.close();
        */
	}
});

function uuid() {
      return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
      );
}
