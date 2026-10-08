var mainWindow;
var origin;
var streamWriter;
var lastLoadParams = null;
var reinitializingPort = false;
var portReinitPending = false;
// Set when the host is the feed rather than the full app: the page loaded is the app's tile,
// and the only messages that cross between it and the host are the tile's own.
var tileMode = false;
let msgHandler = function (e) {
      let appFrame = document.getElementById("appSandboxId");
      if (tileMode && appFrame != null && e.source === appFrame.contentWindow) {
          if (e.origin === window.location.origin && mainWindow != null)
              relayFromTile(e.data);
          return;
      }
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
      } else if (e.data.type == "init") {
          load(e.data.appName, e.data.appPath, e.data.allowBrowsing, e.data.theme, e.data.chatId,
            e.data.username, e.data.props, e.data.lang);
      } else if(e.data.type == "respondToLoadedChunk") {
        respondToLoadedChunk(e.data.bytes);
      } else if (e.data.type == "setTheme" && tileMode) {
        let frame = document.getElementById("appSandboxId");
        if (frame != null && frame.contentWindow != null)
            frame.contentWindow.postMessage({type: 'setTheme', theme: String(e.data.theme)}, window.location.origin);
      }
};
function relayFromTile(data) {
    if (data == null || typeof data !== 'object')
        return;
    if (data.type == 'resize') {
        let height = Number(data.height);
        if (isFinite(height))
            mainWindow.postMessage({action: 'tileResize', height: height}, origin);
    } else if (data.type == 'ready') {
        mainWindow.postMessage({action: 'tileReady'}, origin);
    } else if (data.type == 'open') {
        mainWindow.postMessage({action: 'tileOpen'}, origin);
    }
}
function tileSrc(props, theme, username, lang) {
    let page = String(props.tilePage || '');
    if (!/^[A-Za-z0-9_-][A-Za-z0-9_.\/-]*$/.test(page) || page.split('/').some(part => part == '..'))
        return null;
    return page + '?theme=' + encodeURIComponent(theme) + '&username=' + encodeURIComponent(username)
        + '&name=' + encodeURIComponent(props.tileName || '')
        + (lang ? '&lang=' + encodeURIComponent(lang) : '');
}
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
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', evt => {
        if (evt.data && evt.data.type === 'need-port' && lastLoadParams && !portReinitPending) {
            portReinitPending = true;
            reinitializingPort = true;
            load(...lastLoadParams);
        }
    });
}

function streamFile(seekHi, seekLo, seekLength, streamFilePath) {
    mainWindow.postMessage({action:'streamFile', seekHi: seekHi, seekLo: seekLo, seekLength: seekLength
        , streamFilePath: streamFilePath}, origin);
}
function actionRequest(filePath, requestId, api, apiMethod, bytes, hasFormData, params, isFromRedirect, isNavigate) {
    mainWindow.postMessage({action:'actionRequest', requestId: requestId, filePath: filePath, api: api, apiMethod: apiMethod,
    bytes: bytes, hasFormData: hasFormData, params: params, isFromRedirect: isFromRedirect, isNavigate: isNavigate}, origin);
}
function load(appName, appPath, allowBrowsing, theme, chatId, username, props, lang) {
    lastLoadParams = [appName, appPath, allowBrowsing, theme, chatId, username, props, lang];
    var reinit = reinitializingPort;
    reinitializingPort = false;
    let that = this;
    let iframe = document.getElementById("appSandboxId");
    iframe.style.width = '100%';
    iframe.style.height = window.innerHeight + 'px';
    tileMode = props.tile === true;
    if (tileMode) {
        document.body.style.margin = '0';
        document.body.style.overflow = 'hidden';
    }
    var appNameInSW = props.appDevMode != null && props.appDevMode == true ? appName + '@APP_DEV_MODE' : appName;
    appNameInSW = props.allowUnsafeEvalInCSP != null && props.allowUnsafeEvalInCSP == true ? appNameInSW + '@CSP_UNSAFE_EVAL' : appNameInSW;

    let fileStream = streamSaver.createWriteStream(appNameInSW, "text/html", url => {
            portReinitPending = false;
            if (!reinit) {
                var path = appPath.length > 0 ? "?path=" + appPath : '';
                path = path.length > 0 ? path + '&theme=' + theme : '?theme=' + theme;
                path = chatId.length > 0 ? path + '&chatId=' + chatId : path;
                path = path + '&username=' + username;
                if (lang) {
                    path = path + '&lang=' + encodeURIComponent(lang);
                }
                if (props.isPathWritable == true) {
                    path = path + '&isPathWritable=' + props.isPathWritable;
                }
                if (tileMode) {
                    let src = tileSrc(props, theme, username, lang);
                    if (src != null)
                        iframe.src = src;
                } else {
                    let anchor = props.htmlAnchor.length > 0 ? '#' + props.htmlAnchor : "";
                    let src = allowBrowsing ? appPath.substring(1) + anchor : "index.html" + path;
                    iframe.src= src;
                    iframe.contentWindow.focus();
                }
            }
            that.startPing(url + "/ping");
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
function startPing(pingUrl) {
    sendPingRequest(pingUrl);
    setTimeout(() => this.startPing(pingUrl), 5000);
}
function sendPingRequest(url) {
    var req = new XMLHttpRequest();
    req.open('GET', url);
    req.onload = function() {
        if (!req.status == 200) {
            console.log('sendPingRequest-status-!200. status:' + req.status);
        }
    };
    req.onerror = function(e) {
        console.log('sendPingRequest-onerror. error:' + e.toString());
    };
    req.send();
}