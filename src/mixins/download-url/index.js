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
        // the download is owned by the download manager once it has started, so the frame
        // is only needed long enough to hand it over
        setTimeout(function () {
            if (frame.parentNode != null)
                frame.parentNode.removeChild(frame);
        }, 60000);
    }
}
