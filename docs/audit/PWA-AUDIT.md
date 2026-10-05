# PWA Security & Reliability Audit

## Components

| File | Purpose |
|------|---------|
| `src/lib/pwa/registerServiceWorker.ts` | Register `/sw.js`, `updateViaCache: 'none'` |
| `src/services/pwaService.ts` | Updates, push subscriptions |
| `src/services/offlineService.ts` | Offline queue / SW messages |
| `src/hooks/useOfflineSync.ts` | Sync hook |
| `proxy.ts` | Excludes `sw.js`, workbox from middleware matcher |

## Service worker scope

- Scope `/` — can intercept same-origin navigations if configured in generated SW (Serwist/next-pwa build output).

## Cache strategy

- `updateViaCache: 'none'` on registration reduces stale SW cache of script.
- **Risk:** If API JSON responses cached by SW custom rules, tenant data could persist — **NEEDS VALIDATION** of generated `sw.js` precache/runtime rules post-build.

## Authentication caching

- Staff auth: Supabase cookies httpOnly (SSR client) — not typically visible to SW.
- Client portal: separate cookie — logout must clear cookie + any IndexedDB/offline queues.

## Offline behavior

`offlineService.ts` may queue actions — ensure queued writes include tenant context and replay with same auth.

## Push notifications

- Uses `PushManager` + service worker ready.
- Subscription endpoints **NEEDS VALIDATION** for tenant binding.

## Logout

- Must: Supabase signOut, clear portal cookie, unregister or skip cache for dashboard routes.
- **NEEDS VALIDATION:** manual test logout → back button → no sensitive data.

## Findings

- **PWA-CACHE-001** (P2, NEEDS VALIDATION): Build-time SW may cache authenticated API responses — inspect production `sw.js`.  
- **PWA-OFFLINE-001** (P3, NEEDS VALIDATION): Offline queue replay authorization.  
