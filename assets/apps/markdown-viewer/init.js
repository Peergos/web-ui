var mainWindow;
var origin;

window.addEventListener('message', function (e) {
    let parentDomain = window.location.host.substring(window.location.host.indexOf(".")+1)
    if (e.origin !== (window.location.protocol + "//" + parentDomain))
        return;

    mainWindow = e.source;
    origin = e.origin;

    if (e.data.action == "ping") {
        mainWindow.postMessage({action:'pong'}, e.origin);
    } else if(e.data.action == "respondToLoadImage"){
        let image = document.getElementById(e.data.id);
        let blob = new Blob([e.data.data]);
        image.src = URL.createObjectURL(blob);
    } else if(e.data.action == "respondToNavigateTo"){
        let div = document.createElement('div');
        let themeToUse = 'light'; //e.data.theme != null && e.data.theme == 'dark-mode' ? 'dark' : 'light';
        let subLevel = e.data.subLevel ? e.data.subLevel : 0;
        let subPath = e.data.subPath ? e.data.subPath : '';
        const viewer = new toastui.Editor({
            el: div,
            initialValue: e.data.text,
            usageStatistics: false,
            headless: true,
            theme: themeToUse,
            subLevel: subLevel,
            subPath: subPath
        });
        let output = viewer.getHTML();
        let xss = DOMPurify.sanitize(output);
        document.getElementById('sanitized').innerHTML = xss;
        let anchors = document.getElementsByTagName("a");
        for(var i=0; i < anchors.length;i++) {
            let anchor = anchors[i];
            anchor.addEventListener("click", function(e){
                e.preventDefault();
                let url = e.target.href;
                if (url == null) {
                    let media = e.target.parentElement;
                    mainWindow.postMessage({action:'showMedia', path: media.pathname}, origin);
                } else {
                    const requestedResource = new URL(url);
                    if (window.location.host == requestedResource.host) {
                        mainWindow.postMessage({action:'navigateTo', path: requestedResource.pathname}, origin);
                    } else {
                        console.log('invalid link: ' + url);
                    }
                }
            });
        }
        let images = document.getElementsByTagName("img");
        for(var i=0; i < images.length;i++) {
            let image = images[i];
            const requestedResource = new URL(image.src);
            if (window.location.host == requestedResource.host) {
                image.src = '#';
                let generatedId = 'image-' + uuid();
                image.id = generatedId;
                mainWindow.postMessage({action:'loadImage', src: requestedResource.pathname, id: generatedId}, origin);
            } else {
                console.log('invalid link: ' + image.src);
            }
        }
    }
});
function uuid() {
      return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
      );
}