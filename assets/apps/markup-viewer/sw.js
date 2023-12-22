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

self.onfetch = event => {
    const url = event.request.url

    let requestURL = new URL(url);
    if ((event.request.mode === 'navigate' || event.request.mode === 'no-cors') && !requestURL.pathname.startsWith('/api')) {
        event.respondWith(caches.open(cacheName).then((cache) => {
            return fetch(event.request.url).then((fetchedResponse) => {
                cache.put(event.request, fetchedResponse.clone());
                
                return fetchedResponse;
            }).catch(() => {
                return cache.match(event.request.url);
            });
        }));
    }    
}

