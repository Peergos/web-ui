module.exports = {
    /** Start a service worker mediated download without navigating the page.
     *
     *  A top level navigation - which is what clicking an anchor does - makes the browser
     *  cancel every request the page still has in flight, and those XHRs then fire no
     *  load, error, abort or timeout event at all. Every future waiting on one of them is
     *  stranded, so an earlier download silently stops part way through. Loading the url in
     *  a hidden iframe still reaches the service worker, but leaves the page's requests alone.
     */
    startDownload(url) {
        let frame = document.createElement('iframe');
        frame.hidden = true;
        frame.src = url;
        document.body.appendChild(frame);
        let remove = function () {
            if (frame.parentNode != null)
                frame.parentNode.removeChild(frame);
        };
        // The frame is the client the service worker is streaming the download into, so taking
        // it away mid transfer aborts the fetch and the browser discards what it had written.
        // It goes when the download is done, and the timer is only a backstop for a caller that
        // never says so.
        let fallback = setTimeout(remove, 30 * 60 * 1000);
        return function () {
            clearTimeout(fallback);
            remove();
        };
    }
}
