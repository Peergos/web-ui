// Web worker that BLAKE3 hashes a buffer it is handed.
//
// A module worker, because the implementation is shipped as ES modules and nothing here
// may be generated at runtime. There is no WebCrypto BLAKE3 to fall back to.

import { hash, chainingValue } from './blake3/api.js';

self.onmessage = function(e) {
    var id = e.data.id;
    try {
        var bytes = new Uint8Array(e.data.data);
        // a chaining value when this is one chunk of a larger file, otherwise the root
        var result = e.data.chainingValue
            ? chainingValue(bytes, e.data.startChunkHi * 4294967296 + (e.data.startChunkLo >>> 0))
            : hash(bytes);
        self.postMessage({id: id, result: new Int8Array(result.buffer, result.byteOffset, result.length)});
    } catch (err) {
        self.postMessage({id: id, error: err.toString()});
    }
};
