/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkOnly } from "serwist";

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
            // Bypass service worker for critical API calls, Supabase, and Daily.co
            matcher({ url }) {
                return (
                    url.pathname.startsWith("/api/") ||
                    url.hostname.includes("supabase.co") ||
                    url.hostname.includes("daily.co") ||
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
        ...defaultCache,
    ],
});

serwist.addEventListeners();
