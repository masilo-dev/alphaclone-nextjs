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

// Safe NetworkOnly handler — never rejects the FetchEvent promise.
const safeNetworkOnly = new NetworkOnly({
    plugins: [
        {
            handlerDidError: async () =>
                new Response(null, { status: 503, statusText: 'Service Unavailable' }),
        },
    ],
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
                        return new Response(null, { status: 503, statusText: 'Service Unavailable' });
                    }
                },
            },
        ],
    },
    runtimeCaching: [
        {
            // ALL dashboard routes must bypass the cache entirely.
            // This covers full page navigations, RSC data fetches, and any other subresources.
            matcher({ url }) {
                return url.pathname.startsWith('/dashboard');
            },
            handler: safeNetworkOnly,
        },
        {
            // Bypass service worker for API calls, Supabase, and Daily.co
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
            handler: safeNetworkOnly,
        },
        {
            // WebSockets cannot be intercepted — route them through safely.
            matcher({ url }) {
                return url.protocol === 'wss:' || url.protocol === 'ws:';
            },
            handler: safeNetworkOnly,
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
        ...defaultCache,
    ],
});

// Ultimate safety net — never allow an unhandled error to throw "no-response".
serwist.setCatchHandler(async ({ request }) => {
    if (request.mode === 'navigate') {
        return (await self.caches.match('/offline.html')) || Response.error();
    }
    return new Response(null, { status: 503, statusText: 'Service Unavailable' });
});

serwist.addEventListeners();
