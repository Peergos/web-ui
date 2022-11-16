const cacheName = 'BrowserCache_v1';

const precachedAssets = [
    'index.html',
    'worker.html?version=1.1.0',
    'init.js',
    'codemirror.js',
    'codemirror.css',
    'mode/markdown/markdown.js',
    'mode/markdown/index.js',
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
    if (event.request.mode === 'navigate' && !requestURL.pathname.startsWith('/api')) {
        if (requestURL.pathname == '/') {
            return event.respondWith(Response.redirect('index.html', 302));
        } else {
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
}

