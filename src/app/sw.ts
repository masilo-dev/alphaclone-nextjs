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

const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching: [
        {
            // Dashboard pages with query params (e.g. ?mcp=claude) must ALWAYS hit
            // the network — never serve from cache to avoid 'no-response' SW errors.
            matcher({ request, url }) {
                return (
                    request.mode === 'navigate' &&
                    (url.pathname.startsWith('/dashboard') || url.search.length > 0)
                );
            },
            handler: new NetworkOnly(),
        },
        {
            // Bypass service worker for critical API calls, Supabase, and Daily.co
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
            handler: new NetworkOnly(),
        },
        {
            // Explicitly exclude WebSockets from being handled by Serwist/SW
            // Service Workers cannot intercept WebSockets, but returning true in a matcher
            // can sometimes confuse the runtime fetch handler on mobile.
            matcher({ url }) {
                return url.protocol === 'wss:' || url.protocol === 'ws:';
            },
            handler: new NetworkOnly(),
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
                            // If network fails (and no cache), return the precached offline page
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
