importScripts('nacl-fast.min.js');

self.onmessage = function(e) {
  let uInt8IdView = new Uint8Array(e.data.id);
  let uInt8CipherView = new Uint8Array(e.data.cipher);
  let uInt8NonceView = new Uint8Array(e.data.nonce);
  let uInt8KeyView = new Uint8Array(e.data.key);
  let bytes = nacl.secretbox.open(uInt8CipherView, uInt8NonceView, uInt8KeyView);
  let uInt8ResultView = new Uint8Array(bytes);
  self.postMessage({id: uInt8IdView.buffer, data:uInt8ResultView.buffer}, [uInt8IdView.buffer, uInt8ResultView.buffer]);
};

