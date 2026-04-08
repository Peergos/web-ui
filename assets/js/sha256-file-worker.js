self.onmessage = function(e) {
    var id = e.data.id;
    var file = e.data.file;
    var start = e.data.start;
    var end = e.data.end;
    file.slice(start, end).arrayBuffer()
        .then(function(buf) { return self.crypto.subtle.digest({name: 'SHA-256'}, buf); })
        .then(function(hash) { self.postMessage({id: id, result: new Int8Array(hash)}); })
        .catch(function(err) { self.postMessage({id: id, error: err.toString()}); });
};
