const cacheName = 'BrowserCache_v1';

const precachedAssets = [
    'purify.min.js',
    'purify.min.js.map',
    'tui-code-snippet.js',
    'tui-calendar.js',
    'moment.js',
    'tui-time-picker.js',
    'jquery-3.js',
    'init.js',
    'css/bootstrap.css',
    'css/tui-color-picker.css',
    'css/default.css',
    'tui-date-picker.js',
    'bootstrap.js',
    'images/ic-arrow-line-left@3x.png',
    'images/download.png',
    'images/user-plus.svg',
    'images/ic-view-week@3x.png',
    'images/envelope.png',
    'images/ic-view-month@3x.png',
    'images/ic-view-month.png',
    'images/ic-arrow-line-right@3x.png',
    'images/ic-arrow-line-right@2x.png',
    'images/ic-traveltime-w.png',
    'images/ic-view-week.png',
    'images/ic-view-day.png',
    'images/trash.png',
    'images/ic-view-day@2x.png',
    'images/ic-arrow-line-left@2x.png',
    'images/ic-view-day@3x.png',
    'images/edit.png',
    'images/cog.png',
    'images/ic-view-week@2x.png',
    'images/ic-arrow-line-right.png',
    'images/ic-view-month@2x.png',
    'images/external-link-square.png',
    'images/ic-arrow-line-left.png',
    'tui-color-picker.js',
    'ical.min.js',
    'index.html',
    'moment-timezone-with-data-10-year-range.js',
    'ical-expander.js'
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

