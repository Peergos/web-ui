/* The token the local server requires on its local only apis: sync, the drive, the server
 * url, security keys and stopping it. Any other process on the machine can reach those over
 * loopback, so the app opens us at ?local-auth=<code>, a single use code we swap for the token.
 *
 * Kept per origin, so a reload or another tab here still has it.
 */
(function () {
    var HEADER = 'X-Peergos-Local-Token';
    var KEY = 'peergos-local-token';
    var PARAM = 'local-auth';

    var token = null;
    try {
        token = localStorage.getItem(KEY);
    } catch (e) {}

    var ready = Promise.resolve();
    var params = new URLSearchParams(window.location.search);
    var code = params.get(PARAM);
    if (code != null) {
        params.delete(PARAM);
        var query = params.toString();
        history.replaceState(history.state, '',
                             window.location.pathname + (query ? '?' + query : '') + window.location.hash);
        ready = fetch('/peergos/v0/local-auth/redeem?code=' + encodeURIComponent(code), {method: 'POST'})
            .then(function (response) {
                // a reload of the launch url finds the code used, and the token already stored
                return response.ok ? response.text() : null;
            })
            .then(function (redeemed) {
                if (! redeemed)
                    return;
                token = redeemed;
                try {
                    localStorage.setItem(KEY, redeemed);
                } catch (e) {}
            })
            .catch(function () {});
    }

    window.peergosLocalAuth = {
        // the headers to send to a local only api, once any launch code has been swapped
        headers: function () {
            return ready.then(function () {
                var headers = {};
                if (token)
                    headers[HEADER] = token;
                return headers;
            });
        }
    };
})();
