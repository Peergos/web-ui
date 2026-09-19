// Web worker that reads a file slice and BLAKE3 hashes it, so the bytes never cross the
// main thread. The BLAKE3 counterpart of sha256-file-worker.js.

import { hash, chainingValue } from './blake3/api.js';

self.onmessage = function(e) {
    var id = e.data.id;
    // either a real file to slice, or the bytes already read for us
    var slice = e.data.buffer !== undefined
        ? Promise.resolve(e.data.buffer)
        : e.data.file.slice(e.data.start, e.data.end).arrayBuffer();
    slice.then(function(buf) {
        var bytes = new Uint8Array(buf);
        var result = e.data.chainingValue
            ? chainingValue(bytes, e.data.startChunkHi * 4294967296 + (e.data.startChunkLo >>> 0))
            : hash(bytes);
        self.postMessage({id: id, result: new Int8Array(result.buffer, result.byteOffset, result.length)});
    }).catch(function(err) { self.postMessage({id: id, error: err.toString()}); });
};
