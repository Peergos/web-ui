// Tells the page it is running in the desktop app.
//
// Chromium has WebAuthn of its own and the page would use it in preference.
// From a page served at localhost it scopes credentials to rpId 'localhost', so
// a key registered in a browser for peergos.net cannot be offered, and one
// registered in the app is no use in a browser. This flag makes the page route
// security keys through the local server instead, which drives the key for the
// relying party the account actually lives on. A browser at the same address is
// left alone: it is a real one, and never sees this set.
//
// exposeInMainWorld rather than an assignment: with context isolation on, a
// plain `window.__peergosDesktop = true` here would land in the preload's own
// world and the page would never see it.

const {contextBridge} = require('electron');

try {
    contextBridge.exposeInMainWorld('__peergosDesktop', true);
} catch (e) {
    // exposeInMainWorld throws if the key is already taken, which happens when
    // both the window preload and the per-frame one run in the same frame. The
    // flag is already there in that case, so there is nothing to do.
}
