/* global self ReadableStream Response */

const map = new Map()

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

  const stream = event.data.readableStream || createStream(port)
  var filename = event.data.filename         
  var headers
  if(filename.startsWith("media")){
      headers = {
          'Content-Type': 'video/mp4'
      }
  } else {   
      // Make filename RFC5987 compatible
      filename = encodeURIComponent(filename).replace(/['()]/g, escape)
          .replace(/\*/g, '%2A')
      headers = {
          'Content-Type': 'application/octet-stream; charset=utf-8',
          'Content-Disposition': "attachment; filename*=UTF-8''" + filename
      }
      if(event.data.size) headers['Content-Length'] = event.data.size
  }
  map.set(uniqLink, [stream, headers])
    
  port.postMessage({ download: uniqLink, ping: self.registration.scope + 'ping' })

  // Mistage adding this and have streamsaver.js rely on it
  // depricated as from 0.2.1
  port.postMessage({ debug: 'Mocking a download request' })
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

self.addEventListener('install', event =>  {                                                                                  self.skipWaiting();
});
self.addEventListener('activate', event => {
    clients.claim();
});

self.onfetch = event => {
  const url = event.request.url

  if (url.endsWith('/ping')) {
    return event.respondWith(new Response('pong', {
      headers: { 'Access-Control-Allow-Origin': '*' }
    }))
  }

  const hijacke = map.get(url)

  if (!hijacke) return null
  console.log("*** SW Handling ", url)

  const [stream, headers] = hijacke

  map.delete(url)

  return event.respondWith(new Response(stream, { headers }))
}
