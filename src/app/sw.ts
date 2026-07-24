/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkOnly, NetworkFirst, disableNavigationPreload } from "serwist";

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
    skipWaiting: true,
    clientsClaim: true,
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
            // Hashed static assets: network-first so a new deploy wins quickly.
            matcher({ url }) {
                return url.pathname.startsWith('/_next/static');
            },
            handler: new NetworkFirst({
                networkTimeoutSeconds: 5,
                cacheName: 'next-static-live',
                plugins: [
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
                cacheName: 'pages',
                plugins: [
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

// Push Notification Event Listeners
self.addEventListener('push', (event: any) => {
    if (!event.data) return;

    try {
        const data = event.data.json();
        const title = data.title || 'AlphaClone';
        const options = {
            body: data.body || '',
            icon: data.icon || '/favicon-192x192.png',
            badge: data.badge || '/favicon-96x96.png',
            data: {
                url: data.url || '/'
            }
        };

        event.waitUntil(self.registration.showNotification(title, options));
    } catch (err) {
        console.error('Error parsing push data:', err);
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

self.addEventListener('notificationclick', (event: any) => {
    event.notification.close();
    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url.indexOf(urlToOpen) !== -1 && 'focus' in client) {
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(urlToOpen);
            }
        })
    );
});

