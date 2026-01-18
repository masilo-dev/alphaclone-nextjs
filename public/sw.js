const CACHE_NAME = 'alphaclone-v4';
const urlsToCache = [
    '/',
    '/index.html',
    '/manifest.json',
    '/favicon.png'
];

self.addEventListener('install', (event) => {
    // Force immediate activation - skip waiting
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(urlsToCache).catch(() => {
                    // Silently fail cache preload - not critical
                });
            })
    );
});

self.addEventListener('fetch', (event) => {
    // Skip external domains and API calls to avoid CORS issues
    const url = new URL(event.request.url);
    const isExternal = url.origin !== location.origin;
    const isApiCall = url.pathname.includes('/api/') || url.host.includes('supabase.co') || url.host.includes('ipapi.co');

    if (isExternal || isApiCall) {
        // Let external requests and API calls pass through without service worker interference
        return;
    }

    // Navigation requests (HTML) should try Network first, then Cache
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Cache the fresh version
                    if (response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request);
                })
        );
        return;
    }

    // Asset requests: Cache First, falling back to Network
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});

self.addEventListener('activate', (event) => {
    // Take control of all clients immediately
    event.waitUntil(
        Promise.all([
            // Delete old caches
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            // Take control immediately
            self.clients.claim()
        ])
    );
});
