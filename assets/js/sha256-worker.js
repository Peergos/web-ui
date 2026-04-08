// Web worker for SHA-256 computation.
// Uses crypto.subtle when available; falls back to the sha256 polyfill.

var hasCryptoSubtle = typeof self.crypto !== 'undefined' && typeof self.crypto.subtle !== 'undefined';

if (!hasCryptoSubtle) {
    importScripts('/js/sha256.min.js');
}

self.onmessage = function(e) {
    var id = e.data.id;
    var data = e.data.data;
    if (hasCryptoSubtle) {
        self.crypto.subtle.digest({name: 'SHA-256'}, data)
            .then(function(hash) {
                self.postMessage({id: id, result: new Int8Array(hash)});
            })
            .catch(function(err) {
                self.postMessage({id: id, error: err.toString()});
            });
    } else {
        try {
            self.postMessage({id: id, result: new Int8Array(sha256(data))});
        } catch(err) {
            self.postMessage({id: id, error: err.toString()});
        }
    }
};
