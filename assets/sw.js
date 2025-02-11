/* global self ReadableStream Response */

const downloadMap = new Map()
var streamingMap

// This should be called once per download
// Each event has a dataChannel that the data will be piped through
self.onmessage = event => {
  // We send a heartbeat every x secound to keep the
  // service worker alive
  if (event.data === 'ping') {
    return
  }

  // Create a uniq link for the download
  const uniqLink = self.registration.scope + 'intercept-me-nr' + Math.random()
  const port = event.ports[0]

  var filename = event.data.filename
  var headers
  if (filename.startsWith("media")) {
      var entry = new CacheEntry(event.data.size);
      setupStreamingEntry(port, entry)
      streamingMap = new Map()
      streamingMap.set(uniqLink, {entry: entry, port: port, mimeType: event.data.mimeType})
  } else if (event.data.mimeType != null) {
      // Make filename RFC5987 compatible
      filename = encodeURIComponent(filename).replace(/['()]/g, escape)
          .replace(/\*/g, '%2A')
      headers = {
          'Content-Type': event.data.mimeType,
          'Content-Disposition': "attachment; filename*=UTF-8''" + filename
      }
      const stream = event.data.readableStream || createStream(port)
      if (event.data.size) headers['Content-Length'] = event.data.size
      downloadMap.set(uniqLink, [stream, headers])
  }

  port.postMessage({ download: uniqLink, ping: self.registration.scope + 'ping' })

  // Mistage adding this and have streamsaver.js rely on it
  // depricated as from 0.2.1
  port.postMessage({ debug: 'Mocking a download request' })
}

function CacheEntry(fileSize) {
    this.fileSize = fileSize;
    this.firstRun = true;
    this.fileMap = new Map();
    this.getFileSize = function() {
        return this.fileSize;
    }
    this.enqueue = function(moreData) {
        var offset = 0;
        let uuidSize = moreData[offset];
        var offset = offset + 1;
        let uuidBytes = moreData.subarray(offset, uuidSize + offset);
        let uuid = new TextDecoder().decode(uuidBytes);

        offset =  offset + uuidSize;

        var file = this.fileMap.get(uuid)
        if(file == null) {
            file = new Uint8Array(0);
        }
        const combinedSize = file.byteLength + moreData.byteLength - offset;
        var newFile = new Uint8Array(combinedSize);
        newFile.set(file);
        newFile.set(moreData.subarray(offset), file.byteLength);
        this.fileMap.set(uuid, newFile);
    }
}

function setupStreamingEntry(port, entry) {
    port.onmessage = ({ data }) => {
        if (data != 'end' && data != 'abort') {
            if (data.byteLength != 0) {
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
      };
        port.onmessageerror = (error) => {
            console.log(error);
        };
    },
    cancel () {
      console.log('user aborted')
    }
  })
}

const cacheName = 'BrowserCache_v1';

const precachedAssets = [
  'index.html',
  'worker.html?version=1.1.0',
  'privacy.html',
  'pro.html',
  'terms.html',
  'images/arrows-alt.svg',
  'js/sha256.min.js',
  'js/sha256stream.min.js',
  'js/nacl-fast.min.js',
  'js/scrypt.js',
  'js/blake2b.js',
  'js/vendor.js',
  'js/peergoslib.nocache.js',
  'js/wrapper.js',
  'js/StreamSaver.js',
  'js/emoji-button-3.1.1.min.js',
  'js/idb-keyval.js',
  'js/peergos.js',
  'css/vendor.css',
  'css/peergos.css',
  'fonts/inter/Inter-Regular.woff2',//?v=3.19
  'fonts/inter/Inter-Regular.woff',//?v=3.19
  'favicon.ico',
  'fonts/inter/Inter-SemiBold.woff2',//?v=3.19
  'fonts/inter/Inter-SemiBold.woff',//?v=3.19
];

self.addEventListener('install', event =>  {
      event.waitUntil(caches.open(cacheName).then((cache) => {
        return cache.addAll(precachedAssets);
      }));
    self.skipWaiting();
});
self.addEventListener('activate', event => {
    clients.claim();
});

const maxBlockSize = 1024 * 1024 * 5;
const oneMegBlockSize = 1024 * 1024 * 1;
self.onfetch = event => {
    const url = event.request.url

    if (url.endsWith('/ping')) {
      return event.respondWith(new Response('pong', {
        headers: { 'Access-Control-Allow-Origin': '*' }
      }))
    }
    if (event.request.headers.get('range')) {
        const streamingEntry = streamingMap.get(url)
        if (!streamingEntry) {
            console.log("Ignoring service worker request for " + url);
            return;
        }
        const cacheEntry = streamingEntry.entry;
        const port = streamingEntry.port;
        const mimeType = streamingEntry.mimeType;

        const bytes = /^bytes\=(\d+)\-(\d+)?$/g.exec(
            event.request.headers.get('range')
        );
        const start = Number(bytes[1]);
        const desiredEnd = Number(bytes[2]);
        var firstBlockSize = oneMegBlockSize - 1;
        if (desiredEnd == 1) {
            firstBlockSize = 1;
        }
        var end = cacheEntry.firstRun ? firstBlockSize : alignToChunkBoundary(start, Number(bytes[2]));
        if(end > cacheEntry.fileSize - 1) {
            end = cacheEntry.fileSize - 1;
        }
        cacheEntry.firstRun = false;
        const seekHi = (start - (start % Math.pow(2, 32)))/Math.pow(2, 32);
        const seekLength = end-start + 1;
        let id = uuid();
        port.postMessage({ seekHi: seekHi, seekLo: start, seekLength: seekLength, uuid: id})
        return event.respondWith(returnRangeRequest(start, end, cacheEntry, mimeType, id))
    } else {
        let requestURL = new URL(url);
        if (requestURL.pathname.startsWith('/public/')) {
            return;
        }

          if (event.request.mode === 'navigate' && !requestURL.pathname.startsWith('/intercept-me-nr')) {
                event.respondWith(caches.open(cacheName).then((cache) => {
                  return fetch(event.request.url).then((fetchedResponse) => {
                    cache.put(event.request, fetchedResponse.clone());
    
                    return fetchedResponse;
                  }).catch(() => {
                    if (requestURL.pathname == '/') {
                        requestURL.pathname = '/index.html';
                    }
                    return cache.match(requestURL.toString());
                  });
                }));
          } else {
                const downloadEntry = downloadMap.get(url)
                if (!downloadEntry) return;

                const [stream, headers] = downloadEntry
                downloadMap.delete(url)
                return event.respondWith(new Response(stream, { headers }))
          }
    }
}
function alignToChunkBoundary(start, end) {
    if (end) {
        let modifiedEnd = end - start > maxBlockSize ?
            alignToChunkBoundary(start) : end;
        return modifiedEnd;
    } else {
        let endOfRange = ((Math.floor(start / maxBlockSize) + 1) * maxBlockSize) - 1;
        let len = endOfRange - start;
        if(len < oneMegBlockSize) {
            endOfRange = endOfRange + maxBlockSize;
        }
        return endOfRange;
    }
}
function returnRangeRequest(start, end, cacheEntry, mimeType, uuid) {
    return new Promise(function(resolve, reject) {
        let pump = (currentCount) => {
            const store = cacheEntry.fileMap.get(uuid);
            if (store == null || store.byteLength != end-start + 1) {
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
        cacheEntry.fileMap.delete(uuid);
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
                ['Content-Type', mimeType],
                ['accept-ranges', 'bytes'],
                ['Content-Range', `bytes ${start}-${bytesProvided}/${fileSize}`],
                ['content-length', arrayBuffer.byteLength]
              ]
            });
        }
    });
}
//https://stackoverflow.com/questions/105034/how-to-create-guid-uuid
function uuid() {
  return '-' + ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

