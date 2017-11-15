importScripts('nacl-fast.min.js');

self.onmessage = function(e) {
  let uInt8IdView = new Uint8Array(e.data.id, e.data.id.byteOffset, e.data.id.byteLength);
  let uInt8CipherView = new Uint8Array(e.data.cipher, e.data.cipher.byteOffset, e.data.cipher.byteLength);
  let uInt8NonceView = new Uint8Array(e.data.nonce, e.data.nonce.byteOffset, e.data.nonce.byteLength);
  let uInt8KeyView = new Uint8Array(e.data.key, e.data.key.byteOffset, e.data.key.byteLength);
  let bytes = nacl.secretbox.open(uInt8CipherView, uInt8NonceView, uInt8KeyView);
  let uInt8ResultView = new Uint8Array(bytes, bytes.byteOffset, bytes.byteLength);
  self.postMessage({id: uInt8IdView.buffer, data:uInt8ResultView.buffer}, [uInt8IdView.buffer, uInt8ResultView.buffer]);
};

