/* global self ReadableStream Response */

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim())
})

const downloadMap = new Map()
const streamingMap = new Map()

// This should be called once per download
// Each event has a dataChannel that the data will be piped through
self.onmessage = event => {
  // We send a heartbeat every x secound to keep the
  // service worker alive if a transferable stream is not sent
  if (event.data === 'ping') {
    return
  }

  const data = event.data
  const downloadUrl = self.registration.scope + 'intercept-me-nr' + Math.random();//data.url || self.registration.scope + Math.random() + '/' + (typeof data === 'string' ? data : data.filename)
  const port = event.ports[0]
  const metadata = new Array(3) // [stream, data, port]

  metadata[1] = data
  metadata[2] = port


  let headers = new Headers(data.headers || {})

  let size = Number(headers.get('Content-Length'));
  let disposition = headers.get('Content-Disposition');
  let startIndex = disposition.indexOf("''");
  let filename = disposition.substring(startIndex+2, disposition.length);
  
  if (filename.startsWith("media")) {
      var entry = new CacheEntry(size);
      setupStreamingEntry(port, entry)
      streamingMap.set(downloadUrl, [entry, port])
  } else {
  	metadata[0] = createStream(port)
  	downloadMap.set(downloadUrl, metadata)
  }
  
  port.postMessage({ download: downloadUrl })
}

function CacheEntry(fileSize) {
    this.fileSize = fileSize;
    this.bytes = new Uint8Array(0);
    this.skip = false;
    this.firstRun = true;
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

  // this only works for Firefox
  if (url.endsWith('/ping')) {
    return event.respondWith(new Response('pong'))
  }

    if (event.request.headers.get('range')) {
        const streamingEntry = streamingMap.get(url)
        if (!streamingEntry) {
	    	console.log("Ignoring service worker request for " + url);
	    	return;
		}
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
        port.postMessage({ seekHi: seekHi, seekLo: start, seekLength: seekLength })
        return event.respondWith(returnRangeRequest(start, end, cacheEntry))
    } else {
    
  		const downloadEntry = downloadMap.get(url)
  		if (!downloadEntry) return null
  		const [ stream, data, port ] = downloadEntry
  		downloadMap.delete(url)

  		// Not comfortable letting any user control all headers
  		// so we only copy over the length & disposition
  		const responseHeaders = new Headers({
    		// To be on the safe side, The link can be opened in a iframe.
   		 	// but octet-stream should stop it.
    		'Content-Security-Policy': "default-src 'none'",
    		'X-Content-Security-Policy': "default-src 'none'",
    		'X-WebKit-CSP': "default-src 'none'",
    		'X-XSS-Protection': '1; mode=block'
  		})

  		let headers = new Headers(data.headers || {})
    	responseHeaders.set('Content-Length', headers.get('Content-Length'))
    	responseHeaders.set('Content-Disposition', headers.get('Content-Disposition'))
    	responseHeaders.set('Content-Type', headers.get('Content-Type'))
  		event.respondWith(new Response(stream, { headers: responseHeaders }))
  		port.postMessage({ debug: 'Download started' })
  	}
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
            if (cacheEntry.getSkip() || store.byteLength != end-start + 1) {
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