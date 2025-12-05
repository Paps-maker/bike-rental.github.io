const CACHE_NAME = "moviedrift-v1";
const ASSETS = [
  "/",
  "/index.html",
  "/img/logo.png",
  "/img/logo-192.png",
  "/img/logo-512.png"
];

// Install Service Worker
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

// Fetch Cached Assets
self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(response => 
      response || fetch(e.request)
    )
  );
});
