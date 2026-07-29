/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, Serwist, NetworkOnly, NetworkFirst, disableNavigationPreload } from "serwist";

declare global {
    interface WorkerGlobalScope extends SerwistGlobalConfig {
        __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    }
}

declare const self: ServiceWorkerGlobalScope;

// Explicitly disable navigation preload on every activate.
// Without this, a previous SW that called enableNavigationPreload() leaves the
// browser-level preload enabled permanently, and error preload responses reach
// PrecacheStrategy (which has no handlerDidError) causing uncaught "no-response".
disableNavigationPreload();

// Network-only with one live retry, then real network error (never a fake HTTP 503).
const networkOnlyRetryOrError = new NetworkOnly({
    plugins: [
        {
            handlerDidError: async ({ request }) => {
                try {
                    const req = request instanceof Request ? request : new Request(request);
                    return await fetch(new Request(req, { cache: 'no-store' }));
                } catch {
                    return Response.error();
                }
            },
        },
    ],
});

// API and dashboard: same behavior — synthetic 503 breaks debugging and hides real status codes.
const apiNetworkOnly = networkOnlyRetryOrError;
const dashboardNetworkOnly = networkOnlyRetryOrError;
const nextAssetNetworkOnly = networkOnlyRetryOrError;

// Drop Serwist defaults that cache deployment-scoped URLs (stale dpl_* breaks after deploy).
// Also skip image-extension rules: SW fetch() is governed by connect-src, not img-src.
const deploymentSafeDefaultCache = defaultCache.filter((rule) => {
    if (rule.matcher instanceof RegExp) {
        const src = rule.matcher.source;
        if (src.includes("_next\\/image") || src.includes("_next/image")) return false;
        if (/\\\.(?:png|jpe?g|gif|svg|ico|webp)/i.test(src)) return false;
    }
    return true;
});

const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    // A waiting worker is activated only after the user accepts the in-app update.
    // This prevents a new bundle taking control halfway through an invoice or draft.
    skipWaiting: false,
    clientsClaim: false,
    navigationPreload: false,
    // PrecacheRoute is always registered first and can match any pre-rendered page,
    // including dashboard routes.  Add handlerDidError so PrecacheStrategy never
    // throws an uncaught "no-response" error when the precache/network fails.
    precacheOptions: {
        plugins: [
            {
                handlerDidError: async ({ request }) => {
                    // Fall back to a live network fetch so the page still loads
                    // even when the precache entry is missing or stale.
                    try {
                        return await fetch(request instanceof Request ? request : new Request(request));
                    } catch {
                        return Response.error();
                    }
                },
            },
        ],
    },
    runtimeCaching: [
        {
            // OAuth consent + approve must never be SW-intercepted (524/Response.error breaks Claude).
            matcher({ url }) {
                return (
                    url.pathname === '/authorize' ||
                    url.pathname.startsWith('/authorize/') ||
                    url.pathname.startsWith('/api/mcp/') ||
                    url.pathname === '/api/mcp'
                );
            },
            handler: new NetworkOnly(),
        },
        {
            // ALL dashboard routes must bypass the cache entirely.
            matcher({ url }) {
                return url.pathname.startsWith('/dashboard');
            },
            handler: dashboardNetworkOnly,
        },
        {
            // Next.js image optimizer URLs are deployment-scoped — never cache them.
            matcher({ url }) {
                return url.pathname.startsWith('/_next/image');
            },
            handler: nextAssetNetworkOnly,
        },
        {
            // Immutable, content-hashed build assets are safe and efficient cache-first.
            matcher({ url }) {
                return url.pathname.startsWith('/_next/static');
            },
            handler: new CacheFirst({
                cacheName: 'ac-next-static-v1',
                plugins: [
                    new ExpirationPlugin({ maxEntries: 160, maxAgeSeconds: 30 * 24 * 60 * 60 }),
                    {
                        cacheWillUpdate: async ({ response }) => (response?.ok ? response : null),
                        handlerDidError: async ({ request }) => {
                            try {
                                const req = request instanceof Request ? request : new Request(request);
                                return await fetch(new Request(req, { cache: 'no-store' }));
                            } catch {
                                return Response.error();
                            }
                        },
                    },
                ],
            }),
        },
        {
            // API and third-party: pass through to network without synthetic 503 on failure.
            matcher({ url }) {
                return (
                    url.pathname.startsWith("/api/") ||
                    url.hostname.includes("supabase.co") ||
                    url.hostname.includes("daily.co") ||
                    url.hostname.includes("challenges.cloudflare.com") ||
                    url.pathname.includes("/auth/v1/") ||
                    url.pathname.includes("/rest/v1/")
                );
            },
            handler: apiNetworkOnly,
        },
        {
            // WebSockets cannot be intercepted — route them through safely.
            matcher({ url }) {
                return url.protocol === 'wss:' || url.protocol === 'ws:';
            },
            handler: networkOnlyRetryOrError,
        },
        {
            // All other page navigations: NetworkFirst with offline fallback
            matcher({ request }) {
                return request.mode === 'navigate';
            },
            handler: new NetworkFirst({
                networkTimeoutSeconds: 10,
                cacheName: 'ac-public-pages-v1',
                plugins: [
                    new ExpirationPlugin({ maxEntries: 24, maxAgeSeconds: 24 * 60 * 60 }),
                    {
                        handlerDidError: async () => {
                            return (await self.caches.match('/offline.html')) || Response.error();
                        },
                    },
                ],
            }),
        },
        ...deploymentSafeDefaultCache,
    ],
});

// Ultimate safety net — avoid synthetic 503 on APIs (use real network error instead).
serwist.setCatchHandler(async ({ request }) => {
    if (request.mode === 'navigate') {
        return (await self.caches.match('/offline.html')) || Response.error();
    }
    return Response.error();
});

serwist.addEventListeners();

<<<<<<< HEAD
const ALLOWED_NOTIFICATION_PATHS = [
    '/dashboard',
    '/settings',
    '/call/',
];

function safeNotificationUrl(candidate: unknown): string {
    if (typeof candidate !== 'string') return '/dashboard';
    try {
        const parsed = new URL(candidate, self.location.origin);
        if (parsed.origin !== self.location.origin) return '/dashboard';
        return ALLOWED_NOTIFICATION_PATHS.some((path) =>
            path.endsWith('/') ? parsed.pathname.startsWith(path) : parsed.pathname === path || parsed.pathname.startsWith(`${path}/`)
        ) ? `${parsed.pathname}${parsed.search}` : '/dashboard';
    } catch {
        return '/dashboard';
    }
}

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const names = await caches.keys();
        await Promise.all(
            names
                .filter((name) =>
                    (name.startsWith('ac-next-static-') && name !== 'ac-next-static-v1') ||
                    (name.startsWith('ac-public-pages-') && name !== 'ac-public-pages-v1') ||
                    ['next-static-live', 'pages'].includes(name)
                )
                .map((name) => caches.delete(name))
        );
        await self.clients.claim();
    })());
});

self.addEventListener('sync', (event: ExtendableEvent & { tag?: string }) => {
    if (event.tag !== 'alphaclone-safe-mutations') return;
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
            for (const client of clients) client.postMessage({ type: 'ALPHACLONE_SYNC_REQUESTED' });
        })
    );
});

// Push payloads contain only routing metadata; the client reauthorizes and fetches live data.
self.addEventListener('push', (event: PushEvent) => {
=======
// Push Notification Event Listeners
self.addEventListener('push', (event: any) => {
>>>>>>> origin/main
    if (!event.data) return;

    try {
        const data = event.data.json();
        const title = data.title || 'AlphaClone';
<<<<<<< HEAD
        const expiresAt = Number(data.expiresAt || 0);
        if (expiresAt && expiresAt < Date.now()) return;
        const options: NotificationOptions = {
            body: data.body || '',
            icon: data.icon || '/favicon-192x192.png',
            badge: data.badge || '/favicon-96x96.png',
            tag: String(data.dedupeKey || data.id || `alphaclone-${data.type || 'activity'}`),
            data: {
                url: safeNotificationUrl(data.url),
                tenantId: typeof data.tenantId === 'string' ? data.tenantId : undefined,
                type: typeof data.type === 'string' ? data.type : 'activity',
=======
        const options = {
            body: data.body || '',
            icon: data.icon || '/favicon-192x192.png',
            badge: data.badge || '/favicon-96x96.png',
            data: {
                url: data.url || '/'
>>>>>>> origin/main
            }
        };

        event.waitUntil(self.registration.showNotification(title, options));
<<<<<<< HEAD
    } catch {
=======
    } catch (err) {
        console.error('Error parsing push data:', err);
>>>>>>> origin/main
        const text = event.data.text();
        event.waitUntil(
            self.registration.showNotification('AlphaClone', {
                body: text,
                icon: '/favicon-192x192.png',
                badge: '/favicon-96x96.png'
            })
        );
    }
});

<<<<<<< HEAD
self.addEventListener('notificationclick', (event: NotificationEvent) => {
    event.notification.close();
    const urlToOpen = safeNotificationUrl(event.notification.data?.url);

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if ('focus' in client) {
                    void client.navigate(urlToOpen);
=======
self.addEventListener('notificationclick', (event: any) => {
    event.notification.close();
    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url.indexOf(urlToOpen) !== -1 && 'focus' in client) {
>>>>>>> origin/main
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(urlToOpen);
            }
        })
    );
});
<<<<<<< HEAD
=======

>>>>>>> origin/main
