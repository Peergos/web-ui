module.exports = {
    /** Start a service worker mediated download without navigating the page.
     *
     *  A top level navigation - which is what clicking an anchor does - makes the browser
     *  cancel every request the page still has in flight, and those XHRs then fire no
     *  load, error, abort or timeout event at all. Every future waiting on one of them is
     *  stranded, so an earlier download silently stops part way through. Loading the url in
     *  a hidden iframe still reaches the service worker, but leaves the page's requests alone.
     *
     *  The frame is the client the service worker is streaming into, so taking it away mid
     *  transfer aborts the fetch and the browser discards what it had written. Writing the last
     *  byte into the stream is not the end of the transfer: the bytes can still be queued in
     *  front of a browser that has not taken them yet. So the frame stays until the worker says
     *  the body was read to the end, and the caller only disposes it explicitly when the
     *  download has failed.
     */
    startDownload(url) {
        let frame = document.createElement('iframe');
        frame.hidden = true;
        frame.src = url;
        document.body.appendChild(frame);
        let listener = null;
        let remove = function () {
            if (listener != null && navigator.serviceWorker != null) {
                navigator.serviceWorker.removeEventListener('message', listener);
                listener = null;
            }
            if (frame.parentNode != null)
                frame.parentNode.removeChild(frame);
        };
        // The worker closes the body once the consumer has pulled the last chunk it enqueued,
        // which can be one chunk ahead of the browser draining its queue. Waiting a moment
        // after that costs nothing - the frame is hidden - and removing it early costs the file.
        let grace = null;
        if (navigator.serviceWorker != null) {
            listener = function (e) {
                if (e.data != null && e.data.finishedDownload === url && grace == null)
                    grace = setTimeout(remove, 5000);
            };
            navigator.serviceWorker.addEventListener('message', listener);
        }
        // Only a backstop, for a download that neither finishes nor is disposed.
        let fallback = setTimeout(remove, 30 * 60 * 1000);
        return function () {
            clearTimeout(fallback);
            if (grace != null)
                clearTimeout(grace);
            remove();
        };
    }
}
