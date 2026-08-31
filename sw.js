const CACHE_NAME = 'nova-ai-v2';
const ASSETS = ['./', './index.html', './styles.css', './app.js', './config.js'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', e => {
    if (e.request.url.includes('googleapis') || e.request.url.includes('api')) return;
    e.respondWith(caches.match(e.request).then(res => res || fetch(e.request)));
});