const cacheName = 'BrowserCache_v1';

const precachedAssets = [
    'index.html',
    'init.js',
    'index.min.js',
    'todo.css',
    'images/edit.png',
    'images/plus.png',
    'images/trash.png'
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

