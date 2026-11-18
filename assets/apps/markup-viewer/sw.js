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
        // Network first: a cached index.html carries SRI hashes for the scripts of an older deploy
        event.respondWith(caches.open(cacheName).then(cache => {
            return fetch(event.request.url).then(fetchedResponse => {
                if (fetchedResponse.ok)
                    cache.put(event.request.url, fetchedResponse.clone());
                return fetchedResponse;
            }).catch(async () => {
                const cached = await cache.match(event.request.url);
                return cached || cache.match('index.html');
            });
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

