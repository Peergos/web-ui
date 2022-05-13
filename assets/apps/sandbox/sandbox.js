var mainWindow;
var origin;
var streamWriter;
var currentPath = '';
var currentTitle = '';
let msgHandler = function (e) {
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

      let appIFrame = document.getElementById("appSandboxId");
      if (appIFrame != null) {
          let path = appIFrame.contentDocument.location.pathname;
          let title = appIFrame.contentDocument.title;
          if (path != null && path != currentPath) {
              currentTitle = title;
              currentPath = path;
          }
      }

      if (e.data.type == "ping") {
        mainWindow.postMessage({action:'pong'}, e.origin);
      } else if (e.data.type == "init") {
          load(e.data.appName, e.data.appPath, e.data.allowBrowsing);
      } else if(e.data.type == "respondToLoadedChunk") {
        respondToLoadedChunk(e.data.bytes);
      } else if(e.data.type == "currentTitleRequest") {
        currentTitleRequest(e);
      } else if(e.data.type == "shutdown") {
        window.removeEventListener("resize", this.resizeHandler);
        removeServiceWorkerRegistration(() => { mainWindow.postMessage({action:'postShutdown'}, origin)});
      }
};
function resizeHandler() {
    let iframe = document.getElementById("appSandboxId");
    if (iframe == null) {
        return;
    }
    iframe.style.width = window.innerWidth + 'px';
    iframe.style.height = window.innerHeight + 'px';
}
window.addEventListener('message', msgHandler);
window.addEventListener("resize", resizeHandler);

function removeServiceWorkerRegistration(callback) {
    if (navigator.serviceWorker == null) {
        console.log("navigator.serviceWorker == null");
        mainWindow.postMessage({action:'failedInit'}, origin);
    } else {
        navigator.serviceWorker.getRegistrations().then(
            function(registrations) {
                for(let registration of registrations) {
                    try {
                    registration.unregister();
                    } catch(ex) {
                        console.log(ex);
                    }
                }
                callback();
            }
        ).catch(err => {
            console.log("Failed initialisation:" + err);
            mainWindow.postMessage({action:'failedInit'}, origin);
        });
    }
}
function streamFile(seekHi, seekLo, seekLength, streamFilePath) {
    mainWindow.postMessage({action:'streamFile', seekHi: seekHi, seekLo: seekLo, seekLength: seekLength
        , streamFilePath: streamFilePath}, origin);
}
function actionRequest(filePath, requestId, apiMethod, bytes, hasFormData, params) {
    mainWindow.postMessage({action:'actionRequest', requestId: requestId, filePath: filePath, apiMethod: apiMethod,
    bytes: bytes, hasFormData: hasFormData, params: params}, origin);
}
function currentTitleRequest(e) {
    e.source.postMessage({action:'currentTitleResponse', path: currentPath, title: currentTitle}, e.origin);
}
function load(appName, appPath, allowBrowsing) {
    let that = this;
    let iframe = document.getElementById("appSandboxId");
    iframe.style.width = window.innerWidth + 'px';
    iframe.style.height = window.innerHeight + 'px';
    let sandboxPath = (allowBrowsing && appPath.length > 0) ?
        appPath.substring(0, appPath.lastIndexOf('/') +1) : appName;
    removeServiceWorkerRegistration(() => {
        let fileStream = streamSaver.createWriteStream(sandboxPath, "text/html", url => {
                let path = appPath.length > 0 ? "?path=" + appPath : '';
                let src = allowBrowsing ? "/apps/sandbox/" + appPath : "assets/index.html" + path;
                iframe.src= src;
            }, function(seekHi, seekLo, seekLength, streamFilePath){
                that.streamFile(seekHi, seekLo, seekLength, streamFilePath);
            }, 0
            ,function(filePath, requestId, apiMethod, bytes, hasFormData, params){
                that.actionRequest(filePath, requestId, apiMethod, bytes, hasFormData, params);
            }
        );
        that.streamWriter = fileStream.getWriter();
    });
}
function respondToLoadedChunk(bytes) {
    streamWriter.write(bytes);
}
