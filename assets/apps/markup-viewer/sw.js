const cacheName = 'BrowserCache_v1';

const precachedAssets = [
    'index.html',
    'init.js',
    'purify.min.js',
    'toastui-editor-viewer.js',
    'purify.min.js.map',
    'attaches.js',
    'image.js',
    'editorjs.js',
    'mermaid.js',
    'css/toastui-editor-viewer.min.css',
    'css/toastui-editor-viewer-dark-mode.css',
    'css/notes-style.css',
];

self.addEventListener('install', event =>  {
      event.waitUntil(caches.open(cacheName).then((cache) => {
        return cache.addAll(precachedAssets);
      }));
    self.skipWaiting();
});
self.addEventListener('activate', event => {
    clients.claim();
});

const TRANSPARENT_GIF = new Uint8Array([71,73,70,56,57,97,1,0,1,0,128,0,0,255,255,255,0,0,0,33,249,4,0,0,0,0,0,44,0,0,0,0,1,0,1,0,0,2,2,68,1,0,59]);

self.onfetch = event => {
    const url = event.request.url;
    let requestURL = new URL(url);
    if (requestURL.pathname.startsWith('/api')) return;
    if (event.request.mode === 'navigate') {
        event.respondWith(caches.open(cacheName).then(async cache => {
            const cached = await cache.match(event.request.url);
            if (cached) return cached;
            const index = await cache.match('index.html');
            if (index) return index;
            return fetch(event.request.url);
        }));
    } else if (event.request.mode === 'no-cors') {
        let cacheKey = requestURL.pathname.substring(1);
        let isPrecached = precachedAssets.indexOf(cacheKey) > -1;
        if (!isPrecached && event.request.destination === 'image') {
            event.respondWith(new Response(TRANSPARENT_GIF, {headers: {'content-type': 'image/gif'}}));
        } else {
            event.respondWith(caches.open(cacheName).then(cache => {
                return fetch(event.request.url).then(fetchedResponse => {
                    cache.put(event.request, fetchedResponse.clone());
                    return fetchedResponse;
                }).catch(() => cache.match(event.request.url));
            }));
        }
    }
}

