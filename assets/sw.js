/* global self ReadableStream Response */

const downloadMap = new Map()
// urls already handed to the browser: the entry is removed as it is served, so a repeat
// request for one is a duplicate, not a download this worker has lost
const servedDownloads = new Set()
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
          'Content-Disposition': "attachment; filename*=UTF-8''" + filename,
          // the page is cross origin isolated, so a document embedded by it has to say it is
          // too, otherwise the load is blocked before the download ever starts
          'Cross-Origin-Resource-Policy': 'same-origin',
          'Cross-Origin-Embedder-Policy': 'require-corp'
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
    // reads we have skipped past. The page can't be told to stop mid chunk, so
    // its remaining writes are dropped rather than left to pile up in fileMap.
    this.abandoned = new Set();
    this.getFileSize = function() {
        return this.fileSize;
    }
    this.abandon = function(uuid) {
        this.abandoned.add(uuid);
        this.fileMap.delete(uuid);
    }
    this.enqueue = function(moreData) {
        var offset = 0;
        let uuidSize = moreData[offset];
        var offset = offset + 1;
        let uuidBytes = moreData.subarray(offset, uuidSize + offset);
        let uuid = new TextDecoder().decode(uuidBytes);

        offset =  offset + uuidSize;

        if (this.abandoned.has(uuid))
            return;
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
  'js/webauthn.js',
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
    const streamingEntry = streamingMap ? streamingMap.get(url) : null
    const rangeHeader = event.request.headers.get('range')
    if (streamingEntry) {
        const asked = rangeHeader ? /^bytes\=(\d+)\-(\d+)?$/g.exec(rangeHeader) : null
        // WebKit's media loader sends no Range header at all, and takes a truncated
        // 206 as the end of the media - it plays that block then fires ended without
        // ever asking for more. So an open ended request (or one with no Range) is
        // served as a stream running to the end of the file, pulling a chunk at a
        // time as it is read. Seeking cancels it and starts a new one at the offset,
        // so we still only fetch what is played.
        if (!rangeHeader) {
            return event.respondWith(streamToEndOfFile(streamingEntry, 0, false))
        }
        if (asked && asked[2] === undefined) {
            return event.respondWith(streamToEndOfFile(streamingEntry, Number(asked[1]), true))
        }
        if (!asked) {
            return event.respondWith(new Response(null, { status: 416 }))
        }
    }
    if (rangeHeader) {
        if (!streamingEntry) {
            console.log("Ignoring service worker request for " + url);
            return;
        }
        const cacheEntry = streamingEntry.entry;
        const port = streamingEntry.port;
        const mimeType = streamingEntry.mimeType;

        const bytes = /^bytes\=(\d+)\-(\d+)?$/g.exec(rangeHeader);
        const start = Number(bytes[1]);
        const desiredEnd = Number(bytes[2]);
        var firstBlockSize = oneMegBlockSize - 1;
        if (desiredEnd == 1) {
            firstBlockSize = 1;
        }
        // the first block is only a short one when it really is the start of the
        // file - otherwise end lands before start and the length goes negative
        var end = cacheEntry.firstRun && start == 0 ?
            firstBlockSize :
            alignToChunkBoundary(start, Number(bytes[2]));
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
                if (!downloadEntry) {
                    // A url this worker never had, rather than one it has already served: it was
                    // restarted after the download was registered, so the stream it was going to
                    // serve died with it. Falling through to the network saves nothing and says
                    // nothing, so tell the pages instead - silently producing no file at all is
                    // the worst of the ways this can fail.
                    if (!servedDownloads.has(url)) {
                        self.clients.matchAll().then(cs => cs.forEach(c =>
                            c.postMessage({unknownDownload: url})))
                    }
                    return;
                }

                const [stream, headers] = downloadEntry
                downloadMap.delete(url)
                servedDownloads.add(url)
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
// Everything from start to the end of the file, as one response, pulling a chunk
// at a time from the page as the consumer reads it.
function streamToEndOfFile(streamingEntry, start, isRangeRequest) {
    const cacheEntry = streamingEntry.entry;
    const port = streamingEntry.port;
    const fileSize = cacheEntry.getFileSize();
    // the opening short block only makes sense at the start of the file
    cacheEntry.firstRun = false;
    var position = start;
    var inFlight = null;
    var cancelled = false;
    const stream = new ReadableStream({
        pull(controller) {
            if (position >= fileSize) {
                controller.close();
                return;
            }
            var end = alignToChunkBoundary(position);
            if (end > fileSize - 1) {
                end = fileSize - 1;
            }
            const length = end - position + 1;
            const id = uuid();
            inFlight = id;
            port.postMessage({
                seekHi: (position - (position % Math.pow(2, 32))) / Math.pow(2, 32),
                seekLo: position,
                seekLength: length,
                uuid: id
            });
            return awaitBlock(cacheEntry, id, length).then(block => {
                inFlight = null;
                cacheEntry.fileMap.delete(id);
                if (cancelled)
                    return;
                if (block == null) {
                    controller.error('Timed out waiting for ' + length + ' bytes at ' + position);
                    return;
                }
                position = position + block.byteLength;
                controller.enqueue(block);
            });
        },
        // a skip abandons this response and starts a new one
        cancel() {
            cancelled = true;
            if (inFlight != null) {
                cacheEntry.abandon(inFlight);
                // tell the page to stop reading, and drop whatever still arrives
                port.postMessage({ cancel: inFlight });
            }
        }
    });
    if (!isRangeRequest) {
        return new Response(stream, {
            status: 200,
            headers: [
                ['Content-Type', streamingEntry.mimeType],
                ['accept-ranges', 'bytes'],
                ['content-length', fileSize]
            ]
        });
    }
    return new Response(stream, {
        status: 206,
        statusText: 'Partial Content',
        headers: [
            ['Content-Type', streamingEntry.mimeType],
            ['accept-ranges', 'bytes'],
            ['Content-Range', `bytes ${start}-${fileSize - 1}/${fileSize}`],
            ['content-length', fileSize - start]
        ]
    });
}

// Resolves with the block once the page has written all of it, or null if it never does.
function awaitBlock(cacheEntry, uuid, length) {
    return new Promise(resolve => {
        var attempts = 0;
        const check = () => {
            const store = cacheEntry.fileMap.get(uuid);
            if (cacheEntry.abandoned.has(uuid)) {
                resolve(null);
            } else if (store != null && store.byteLength == length) {
                resolve(store);
            } else if (attempts++ > 30) {
                resolve(null);
            } else {
                setTimeout(check, 1000);
            }
        };
        check();
    });
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

