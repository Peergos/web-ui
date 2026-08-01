// Web worker that reads a file slice and hashes it.
// Uses crypto.subtle when available; falls back to the sha256 polyfill.

var hasCryptoSubtle = typeof self.crypto !== 'undefined' && typeof self.crypto.subtle !== 'undefined';

if (!hasCryptoSubtle) {
    importScripts('/js/sha256.min.js');
}

function digest(buf) {
    if (hasCryptoSubtle)
        return self.crypto.subtle.digest({name: 'SHA-256'}, buf);
    // the polyfill needs a typed array - an ArrayBuffer has no length and hashes as empty
    return Promise.resolve(sha256(new Uint8Array(buf)));
}

self.onmessage = function(e) {
    var id = e.data.id;
    var file = e.data.file;
    var start = e.data.start;
    var end = e.data.end;
    file.slice(start, end).arrayBuffer()
        .then(digest)
        .then(function(hash) { self.postMessage({id: id, result: new Int8Array(hash)}); })
        .catch(function(err) { self.postMessage({id: id, error: err.toString()}); });
};
