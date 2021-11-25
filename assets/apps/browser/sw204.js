let APP_FILE_MODE = 0;
let STREAMING_MODE = 1;

let peergosToken = "/$peergos/";
let webBrowserToken = '/apps/browser/';
var appData = null;
var appPort = null;
var streamingFilePath = "";
var streamingAppEntry = new CacheEntry(-1);
var downloadUrl = null;
let appName = null;
/* global self ReadableStream Response */

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

const downloadMap = new Map()
var streamingMap

// This should be called once per download
// Each event has a dataChannel that the data will be piped through
self.onmessage = event => {
  // We send a heartbeat every x secound to keep the
  // service worker alive if a transferable stream is not sent
  if (event.data === 'ping') {
    return
  }

  const data = event.data
  downloadUrl = self.registration.scope + 'intercept-me-nr' + Math.random();//data.url || self.registration.scope + Math.random() + '/' + (typeof data === 'string' ? data : data.filename)
  const port = event.ports[0]
  const metadata = new Array(3) // [stream, data, port]

  metadata[1] = data
  metadata[2] = port


  let headers = new Headers(data.headers || {})

  let size = Number(headers.get('Content-Length'));
  let disposition = headers.get('Content-Disposition');
  let startIndex = disposition.indexOf("''");
  appName = disposition.substring(startIndex+2, disposition.length);
  setupNewApp(port);
  port.postMessage({ download: downloadUrl })
}

function CacheEntry(fileSize) {
    this.fileSize = fileSize;
    this.bytes = new Uint8Array(0);
    this.skip = false;
    this.firstRun = true;
    this.setFileSize = function(fileSize) {
        this.fileSize = fileSize;
    }
    this.getFileSize = function() {
        return this.fileSize;
    }
    this.setSkip = function() {
        if(this.firstRun) {
            this.firstRun = false;
        } else {
            this.skip = true;
        }
    }
    this.getSkip = function() {
        return this.skip;
    }
    this.reset = function() {
        this.bytes = new Uint8Array(0);
        this.skip = false;
    }
    this.enqueue = function(moreData) {
        const currentBytes = this.bytes;
        const combinedSize = currentBytes.byteLength + moreData.byteLength;
        var newStore = new Uint8Array(combinedSize);
        newStore.set(currentBytes);
        newStore.set(moreData, currentBytes.byteLength);
        this.bytes = newStore;
    }
}

function setupStreamingEntry(port, entry) {
    port.onmessage = ({ data }) => {
        if (data != 'end' && data != 'abort') {
            if (data.byteLength == 0) {
                entry.reset()
            } else {
                entry.enqueue(data)
            }
        }
    }
}

function createStream (port) {
  // ReadableStream is only supported by chrome 52
  return new ReadableStream({
    start (controller) {
      // When we receive data on the messageChannel, we write
      port.onmessage = ({ data }) => {
        if (data === 'end') {
          return controller.close()
        }

        if (data === 'abort') {
          controller.error('Aborted the download')
          return
        }

        controller.enqueue(data)
      }
    },
    cancel () {
      console.log('user aborted')
    }
  })
}

const maxBlockSize = 1024 * 1024 * 5;
const oneMegBlockSize = 1024 * 1024 * 1;

self.onfetch = event => {
    const url = event.request.url
    if (url.endsWith('/ping')) {
      return event.respondWith(new Response('pong', {
        headers: { 'Access-Control-Allow-Origin': '*' }
      }))
    }
    if (appPort == null) {
        return;
    }
    if (url == downloadUrl) {
      return event.respondWith(new Response('', {
        headers: { 'Access-Control-Allow-Origin': '*' }
      }))
    }
    const requestedResource = new URL(event.request.url)
    var filePath = requestedResource.pathname;
    if (filePath.startsWith(webBrowserToken)) {
        var tempFilePath = filePath.substring(webBrowserToken.length -1);
        let peergosTokenIdx = tempFilePath.indexOf(peergosToken);
        if (peergosTokenIdx > -1) {
            filePath = tempFilePath.substring(peergosTokenIdx + peergosToken.length - 1);
        } else {
            filePath = tempFilePath;
        }
    }
    //console.log("service worker filePath=" + filePath);
    if (event.request.headers.get('range')) {
        if (filePath != streamingFilePath) {
            streamingFilePath = filePath;
            streamingAppEntry = new CacheEntry(-1);
        }
        var streamingEntry = [streamingAppEntry, appPort];
        const [cacheEntry, port] = streamingEntry

        const bytes = /^bytes\=(\d+)\-(\d+)?$/g.exec(
            event.request.headers.get('range')
        );
        const start = Number(bytes[1]);
        var end = cacheEntry.firstRun ? oneMegBlockSize - 1 : alignToChunkBoundary(start, Number(bytes[2]));
        if(end > cacheEntry.fileSize - 1) {
            end = cacheEntry.fileSize - 1;
        }
        const seekHi = (start - (start % Math.pow(2, 32)))/Math.pow(2, 32);
        const seekLength = end-start + 1;
        cacheEntry.setSkip();
        port.postMessage({ seekHi: seekHi, seekLo: start, seekLength: seekLength, streamFilePath: filePath })
        return event.respondWith(returnRangeRequest(start, end, cacheEntry))
    } else {
        let method = event.request.method;
        if (method == 'OPTIONS' || method == 'HEAD') {
            return event.respondWith(new Response('Not Implemented!', {
                status: 400
            }));
        } else {
            var restFilePath = filePath;
            let uniqueId = method == 'GET' && restFilePath ==  filePath ? '' : uuid();
            if (uniqueId == '' && method != 'GET') {
                return new Response('Unexpected url', {status: 400})
            }
            return event.respondWith(
                (async function() {
                    var formData = null;
                    var buffer = null;
                    appPort.postMessage({ filePath: restFilePath, requestId: uniqueId, apiMethod: method, bytes: buffer,
                        hasFormData: formData != null});
                    return returnAppData(restFilePath, uniqueId);
                })()
            )
        }
  	}
}
//https://stackoverflow.com/questions/105034/how-to-create-guid-uuid
function uuid() {
  return '-' + ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}
function alignToChunkBoundary(start, end) {
    if (end) {
        return end;
    } else {
        let endOfRange = ((Math.floor(start / maxBlockSize) + 1) * maxBlockSize) - 1;
        let len = endOfRange - start;
        if(len < oneMegBlockSize) {
            endOfRange = endOfRange + maxBlockSize;
        }
        return endOfRange;
    }
}
function returnRangeRequest(start, end, cacheEntry) {
    return new Promise(function(resolve, reject) {
        let pump = (currentCount) => {
            const store = cacheEntry.bytes;
            if (cacheEntry.getSkip() || (end > 0 && store.byteLength != end-start + 1) || store.byteLength == 0) {
                if(currentCount > 30) {
                    resolve(null);
                } else {
                    setTimeout(function(){pump(++currentCount);}, 1000);
                }
            } else {
                resolve(store);
            }
        }
        pump(0);
    }).then(function(arrayBuffer, err) {
        const fileSize = cacheEntry.getFileSize();
        if (arrayBuffer == null) {
            return new Response(null, {
              status: 416,
              statusText: 'Range Not Satisfiable',
              headers: [['Content-Range', `*/${fileSize}`]]
            });
        } else {
            const bytesProvided = start +  arrayBuffer.byteLength - 1;
            return new Response(arrayBuffer, {
              status: 206,
              statusText: 'Partial Content',
              headers: [
//               'Content-Type': 'video/mp4',
                ['accept-ranges', 'bytes'],
                ['Content-Range', `bytes ${start}-${bytesProvided}/${fileSize}`],
                ['content-length', arrayBuffer.byteLength]
              ]
            });
        }
    });
}

function AppData() {
    this.resultMap = new Map();
    this.fileStatusMap = new Map();
    this.isReady = function(fullPath) {
        var status = this.fileStatusMap.get(fullPath)
        return status == true;
    }
    this.getAndRemoveFile = function(fullPath) {
        let fileData = this.resultMap.get(fullPath);
        this.resultMap.delete(fullPath);
        this.fileStatusMap.delete(fullPath);
        return fileData;
    }
    this.convertStatusCode = function(code) {
        if (code == '0') {        //              APP_FILE_MODE = 0
            return 200;
        } else if (code == '2') { //            FILE_NOT_FOUND: 2,
            return 404;
        } else if (code == '3') { //            ACTION_FAILED: 3,
            return 400;
        } else if (code == '4') { //            DELETE_SUCCESS: 4,
            return 204;
        } else if (code == '5') { //            DIRECTORY_NOT_FOUND: 5,
            return 404;
        } else if (code == '6') { //            CREATE_SUCCESS: 6,
            return 201;
        } else if (code == '7') { //            UPDATE_SUCCESS: 7,
            return 200;
        } else if (code == '8') { //            GET_SUCCESS: 8,
            return 200;
        } else {
            return 400;
        }
    }
    this.enqueue = function(moreData, code) {
        let filePathSize = readUnsignedLeb128(moreData.subarray(1, 6));
        let offset = 1 + unsignedLeb128Size(filePathSize);
        let filePathBytes = moreData.subarray(offset, filePathSize + offset);
        let filePath = new TextDecoder().decode(filePathBytes);

        var entry = this.resultMap.get(filePath);
        var file = null;
        if(entry == null) {
            file = new Uint8Array(0);
        } else {
            file = entry.file;
        }
        const combinedSize = file.byteLength + moreData.byteLength - filePathSize - offset;
        var newFile = new Uint8Array(combinedSize);
        newFile.set(file);
        newFile.set(moreData.subarray(filePathSize + offset), file.byteLength);
        let httpStatusCode = this.convertStatusCode(code);
        this.resultMap.set(filePath, {file: newFile, statusCode: httpStatusCode});
        this.fileStatusMap.set(filePath, true);
    }
}

function setupNewApp(port) {
    appData = new AppData();
    appPort = port;
    port.onmessage = ({ data }) => {
    if (data != 'end' && data != 'abort') {
            var offset = 1;
            let filePathSize = readUnsignedLeb128(data.subarray(offset, offset + 4));
            offset += unsignedLeb128Size(filePathSize);
            let filePathBytes = data.subarray(offset, filePathSize + offset);
            let filePath = new TextDecoder().decode(filePathBytes);
            if (data[0] == STREAMING_MODE) {
                streamingAppEntry.reset();
                if (filePath != streamingFilePath) {
                    streamingFilePath = filePath;
                }
                offset += filePathBytes.byteLength;
                let sizeHigh = readUnsignedLeb128(data.subarray(offset, offset + 4));
                offset += unsignedLeb128Size(sizeHigh);
                let sizeLow = readUnsignedLeb128(data.subarray(offset, offset + 4));
                offset += unsignedLeb128Size(sizeLow);
                var low = sizeLow;
                if (low < 0) low = low + Math.pow(2, 32);
                let fileSize = low + (sizeHigh * Math.pow(2, 32));
                streamingAppEntry.setFileSize(fileSize);
                streamingAppEntry.enqueue(data.subarray(offset));
            } else {
                appData.enqueue(data, data[0]);
            }
        }
    }
}

function returnAppData(filePath, uniqueId) {
    return new Promise(function(resolve, reject) {
        let key = filePath + uniqueId;
        let pump = () => {
            if (!appData.isReady(key)) {
                setTimeout(pump, 100)
            } else {
                let fileData = appData.getAndRemoveFile(key)
                resolve(fileData);
            }
        }
        pump()
    }).then(function(fileData, err) {
        if (fileData.statusCode == 201) {
            let location = new TextDecoder().decode(fileData.file);
            return new Response(null, {
                status: fileData.statusCode,
                headers: [
                    ['location', location]
                ]
            });
        } else {
            return new Response(fileData.file.byteLength == 0 ? null : fileData.file, {
                status: fileData.statusCode,
                headers: [
                    ['content-length', fileData.file.byteLength]
                ]
            });
        }
    });
}

function unsignedLeb128Size(value) {
    var remaining = value >> 7;
    var count = 0;
    while (remaining != 0) {
        remaining >>= 7;
        count++;
    }
    return count + 1;
}
function readUnsignedLeb128(value) {
    var result = 0;
    var cur;
    var count = 0;
    do {
        cur = value[count];
        result |= (cur & 0x7f) << (count * 7);
        count++;
    } while (((cur & 0x80) == 0x80) && count < 5);
    if ((cur & 0x80) == 0x80) {
        throw new Error("invalid LEB128 sequence");
    }
    return result;
}