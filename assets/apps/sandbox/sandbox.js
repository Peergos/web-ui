var mainWindow;
var origin;
var streamWriter;
var currentPath = '';
var currentTitle = '';
var failed = false;
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
      if (appIFrame != null && appIFrame.contentDocument != null) {
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
          load(e.data.appName, e.data.appPath, e.data.allowBrowsing, e.data.theme, e.data.chatId,
            e.data.username, e.data.props);
      } else if(e.data.type == "respondToLoadedChunk") {
        respondToLoadedChunk(e.data.bytes);
      } else if(e.data.type == "currentTitleRequest") {
        currentTitleRequest(e);
      }
};
function resizeHandler() {
    let iframe = document.getElementById("appSandboxId");
    if (iframe == null) {
        return;
    }
    iframe.style.width = '100%';
    iframe.style.height = window.innerHeight + 'px';
}
window.addEventListener('message', msgHandler);
window.addEventListener("resize", resizeHandler);

function streamFile(seekHi, seekLo, seekLength, streamFilePath) {
    mainWindow.postMessage({action:'streamFile', seekHi: seekHi, seekLo: seekLo, seekLength: seekLength
        , streamFilePath: streamFilePath}, origin);
}
function actionRequest(filePath, requestId, api, apiMethod, bytes, hasFormData, params, isFromRedirect, isNavigate) {
    mainWindow.postMessage({action:'actionRequest', requestId: requestId, filePath: filePath, api: api, apiMethod: apiMethod,
    bytes: bytes, hasFormData: hasFormData, params: params, isFromRedirect: isFromRedirect, isNavigate: isNavigate}, origin);
}
function currentTitleRequest(e) {
    e.source.postMessage({action:'currentTitleResponse', path: currentPath, title: currentTitle}, e.origin);
}
function load(appName, appPath, allowBrowsing, theme, chatId, username, props) {
    let that = this;
    let iframe = document.getElementById("appSandboxId");
    iframe.style.width = '100%';
    iframe.style.height = window.innerHeight + 'px';
    var appNameInSW = props.appDevMode != null && props.appDevMode == true ? appName + '@APP_DEV_MODE' : appName;
    appNameInSW = props.allowUnsafeEvalInCSP != null && props.allowUnsafeEvalInCSP == true ? appNameInSW + '@CSP_UNSAFE_EVAL' : appNameInSW;

    let fileStream = streamSaver.createWriteStream(appNameInSW, "text/html", url => {
            var path = appPath.length > 0 ? "?path=" + appPath : '';
            path = path.length > 0 ? path + '&theme=' + theme : '?theme=' + theme;
            path = chatId.length > 0 ? path + '&chatId=' + chatId : path;
            path = path + '&username=' + username;
            if (props.isPathWritable == true) {
                path = path + '&isPathWritable=' + props.isPathWritable;
            }
            let src = allowBrowsing ? appPath.substring(1) : "index.html" + path;
            iframe.src= src;
            iframe.contentWindow.focus();
        }, function(seekHi, seekLo, seekLength, streamFilePath){
            that.streamFile(seekHi, seekLo, seekLength, streamFilePath);
        }, 0
        ,function(filePath, requestId, api, apiMethod, bytes, hasFormData, params, isFromRedirect, isNavigate){
            that.actionRequest(filePath, requestId, api, apiMethod, bytes, hasFormData, params, isFromRedirect, isNavigate);
        }
    );
    that.streamWriter = fileStream.getWriter();
}
function respondToLoadedChunk(bytes) {
    streamWriter.write(bytes);
}