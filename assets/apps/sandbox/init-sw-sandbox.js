let host = window.location.hostname

// Service worker only works on https, 127.0.0.1 and localhost
// So we just redirect asap
if (window.location.host == host && window.location.protocol != "https:")
    window.location.protocol = "https:"

// This will prevent the sw from restarting
let keepAlive = sw => {
  keepAlive = () => {}
  setInterval(() => {
    sw.postMessage('ping', [new MessageChannel().port2])
  }, 27E4) // 4.5min
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
		return swReg || navigator.serviceWorker.register('sw-sandbox.js', {scope: './'})
    }).then(swReg => {
		// This sends the message data as well as transferring
		// messageChannel.port2 to the service worker. The service worker can
		// then use the transferred port to reply via postMessage(), which
		// will in turn trigger the onmessage handler on messageChannel.port1.
		let swRegTmp = swReg.installing || swReg.waiting

                if (swReg.active) {
                    keepAlive(swReg.active)
                    return swReg.active.postMessage(data, [ports[0]])
                }

		swRegTmp.onstatechange = () => {
                    if (swRegTmp.state === 'activated') {
                        swRegTmp.onstatechange = null
                        swReg.active.postMessage(data, [ports[0]])
                        keepAlive(swReg.active)
                }
            }
    })
}

// The opener can't listen to onload event, so we need to help em out!
// (telling them that we are ready to accept postMessage's)
window.opener && window.opener.postMessage('StreamSaver::loadedPopup', '*')
