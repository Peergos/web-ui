let host = window.location.hostname

// Service worker only works on https, 127.0.0.1 and localhost
// So we just redirect asap
if (window.location.host == host && window.location.protocol != "https:")
    window.location.protocol = "https:"

// This will prevent the sw from restarting
let keepAlive = sw => {
  keepAlive = () => {}
  // Everything a download needs - its stream and headers - lives in the worker's memory, so if
  // the worker is stopped the request for that download falls through to the network and no
  // file is saved, while the page carries on writing to a stream no one is reading. Pinging
  // every four and a half minutes against a five minute limit leaves half a minute of slack,
  // and a timer on a loaded machine is not delivered that punctually.
  setInterval(() => {
    sw.postMessage('ping', [new MessageChannel().port2])
  }, 3E4) // 30s
}

// message event is the first thing we need to setup a listner for
// don't want the opener to do a random timeout - instead they can listen for
// the ready event
window.onmessage = event => {
	let {data, ports} = event

	// It's important to have a messageChannel, don't want to interfere
	// with other simultaneous downloads
    if(!ports || !ports.length)
        throw new TypeError("Mehhh! You didn't send a messageChannel")

    // Register the worker, then forward the dataChannel to the worker
    // So they can talk directly, so we don't have to be "the middle man" any
    // longer
    navigator.serviceWorker.getRegistration('./').then(swReg => {
		return swReg || navigator.serviceWorker.register('sw.js', {scope: './'})
    }).then(swReg => {
		// This sends the message data as well as transferring
		// messageChannel.port2 to the service worker. The service worker can
		// then use the transferred port to reply via postMessage(), which
		// will in turn trigger the onmessage handler on messageChannel.port1.
                if (swReg.active) {
                    keepAlive(swReg.active)
                    return swReg.active.postMessage(data, [ports[0]])
                }

		let swRegTmp = swReg.installing || swReg.waiting
                // A registration can have no worker in any of the three states, briefly, while
                // one is being replaced. Reading onstatechange off nothing throws, and with no
                // catch on this chain the port is simply never handed over: the download then
                // waits for a url that cannot arrive, showing progress it is not making.
                if (swRegTmp == null) {
                    return navigator.serviceWorker.ready.then(ready => {
                        keepAlive(ready.active)
                        ready.active.postMessage(data, [ports[0]])
                    })
                }

		swRegTmp.onstatechange = () => {
                    if (swRegTmp.state === 'activated') {
                        swRegTmp.onstatechange = null
                        swReg.active.postMessage(data, [ports[0]])
                        keepAlive(swReg.active)
                }
            }
    }).catch(e => {
        // Nothing downstream is watching this chain, so a failure here is otherwise invisible
        console.log('could not hand the download to the service worker', e)
    })
}

// The opener can't listen to onload event, so we need to help em out!
// (telling them that we are ready to accept postMessage's)
window.opener && window.opener.postMessage('StreamSaver::loadedPopup', '*')
