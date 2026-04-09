/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkOnly, NetworkFirst } from "serwist";

declare global {
    interface WorkerGlobalScope extends SerwistGlobalConfig {
        __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    }
}

declare const self: ServiceWorkerGlobalScope;

// Safe NetworkOnly handler that never throws — returns a fallback error response
// instead of a rejected Promise (which causes "no-response" SW crashes).
const safeNetworkOnly = new NetworkOnly({
    plugins: [
        {
            handlerDidError: async () => {
                return new Response(null, { status: 503, statusText: 'Service Unavailable' });
            },
        },
    ],
});

const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true,
    clientsClaim: true,
    // Disable navigationPreload — it causes "no-response" errors when the
    // preloaded response is dropped before the SW handler can consume it.
    navigationPreload: false,
    runtimeCaching: [
        {
            // ALL dashboard routes must bypass the cache entirely.
            // This covers /dashboard, /dashboard/business/facebook, etc.
            matcher({ request, url }) {
                return (
                    request.mode === 'navigate' &&
                    (url.pathname.startsWith('/dashboard') || url.search.length > 0)
                );
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

serwist.addEventListeners();
