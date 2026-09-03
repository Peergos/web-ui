const cacheName = 'BrowserCache_v5';

const precachedAssets = [
    'index.html',
    'calendar.js',
    'calendar.css',
    'fonts/inter/Inter-Regular.woff2',
    'fonts/inter/Inter-SemiBold.woff2',
    'vendor/fullcalendar/dist/fullcalendar.global.js',
    'vendor/fullcalendar/dist/skeleton.css',
    'vendor/fullcalendar/dist/locales-all/global.js',
    'vendor/fullcalendar/dist/themes/breezy/global.js',
    'vendor/fullcalendar/dist/themes/breezy/theme.css',
    'vendor/fullcalendar/dist/themes/breezy/palettes/indigo.css',
    'vendor/fullcalendar-rrule/global.js',
    'vendor/rrule/dist/es5/rrule.min.js'
];

self.addEventListener('install', event =>  {
      event.waitUntil(caches.open(cacheName).then((cache) => {
        return cache.addAll(precachedAssets);
      }));
    self.skipWaiting();
});
self.addEventListener('activate', event => {
    // Drops the previous engine's cache, which pinned assets this app no
    // longer ships.
    event.waitUntil(caches.keys().then(names =>
        Promise.all(names.filter(n => n !== cacheName).map(n => caches.delete(n)))
    ));
    clients.claim();
});

self.onfetch = event => {
    const url = event.request.url;
    let requestURL = new URL(url);
    if (requestURL.pathname.startsWith('/api')) return;
    if (event.request.mode === 'navigate') {
        // Network first: cache-first served a previous build's index.html
        // until a later load happened to refresh it, which pairs a stale
        // document with freshly-fetched scripts - and a missing element
        // takes the whole app down. Cache stays as the offline fallback.
        event.respondWith(caches.open(cacheName).then(async cache => {
            try {
                const fresh = await fetch(event.request.url, {cache: 'no-store'});
                if (fresh && fresh.ok) {
                    cache.put(event.request.url, fresh.clone());
                    return fresh;
                }
            } catch (e) { /* offline - fall through to the cache */ }
            const cached = await cache.match(event.request.url);
            if (cached) return cached;
            const index = await cache.match('index.html');
            if (index) return index;
            return fetch(event.request.url);
        }));
    } else if (event.request.mode === 'no-cors') {
        event.respondWith(caches.open(cacheName).then(cache => {
            return fetch(event.request.url).then(fetchedResponse => {
                cache.put(event.request, fetchedResponse.clone());
                return fetchedResponse;
            }).catch(() => cache.match(event.request.url));
        }));
    }
}
