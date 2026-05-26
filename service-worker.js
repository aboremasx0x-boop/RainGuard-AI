const CACHE_NAME = "rainguard-cache-v1";

const urlsToCache = [
    "/",
    "/index.html",
    "/style.css",
    "/app.js",
    "/manifest.json",
    "https://unpkg.com/leaflet/dist/leaflet.css",
    "https://unpkg.com/leaflet/dist/leaflet.js"
];

// =========================
// تثبيت Service Worker
// =========================
self.addEventListener("install", (event) => {

    event.waitUntil(

        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(urlsToCache);
            })
    );
});

// =========================
// جلب الملفات من الكاش
// =========================
self.addEventListener("fetch", (event) => {

    event.respondWith(

        caches.match(event.request)
            .then((response) => {

                return response || fetch(event.request);
            })
    );
});

// =========================
// تحديث الكاش القديم
// =========================
self.addEventListener("activate", (event) => {

    event.waitUntil(

        caches.keys().then((cacheNames) => {

            return Promise.all(

                cacheNames.map((cache) => {

                    if (cache !== CACHE_NAME) {

                        return caches.delete(cache);
                    }
                })
            );
        })
    );
});
