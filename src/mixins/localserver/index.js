// POST to the peergos server running on this machine. Errors come back as the message the
// server put in the Trailer header, so a caller can show what actually went wrong.
module.exports = {
    methods: {
        localPost(url, body, responseType) {
            return new Promise(function(resolve, reject) {
                var req = new XMLHttpRequest();
                req.open('POST', url);
                req.responseType = responseType != null ? responseType : 'json';

                req.onload = function() {
                    // This is called even on 404 etc so check the status
                    if (req.status == 200) {
                        resolve(req.response);
                    } else {
                        try {
                            let trailer = req.getResponseHeader("Trailer");
                            if (trailer == null) {
                                reject('Unexpected error from server');
                            } else {
                                // the server form encodes the message, so spaces arrive as +
                                reject(decodeURIComponent(trailer.replace(/\+/g, ' ')));
                            }
                        } catch (e) {
                            reject(e);
                        }
                    }
                };

                req.onerror = function(e) {
                    reject(Error("Unable to connect"));
                };

                req.ontimeout = function() {
                    reject(Error("Network timeout"));
                };

                req.send(body != null ? body : new Int8Array(0));
            })
        }
    }
}
