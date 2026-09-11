# AlphaClone PWA production baseline

## Architecture

AlphaClone uses the Next.js App Router manifest at `/manifest.webmanifest`, a
single Serwist worker at `/sw.js`, the existing authenticated application shell,
and a tenant/user-partitioned IndexedDB database named `AlphaCloneOffline`.
Supabase remains the source of truth. Offline records never grant access: every
sync must reauthenticate and reauthorize the current tenant on the server.

The old static manifest and service worker were removed to prevent two workers or
two install identities from competing for the same scope.

## Cache policy

| Resource | Strategy | Boundary |
| --- | --- | --- |
| Authentication, OAuth, MCP | Network only | Never cached |
| API, Supabase, Daily, third-party data | Network only | Never cached |
| Dashboard HTML | Network only | Generic offline fallback only |
| Next image optimizer | Network only | Deployment-scoped URLs |
| Hashed Next static assets | Cache first | 160 entries, 30 days |
| Public navigation pages | Network first | 24 entries, 24 hours |
| Uploaded/private documents | Network only | Never cached by the worker |

Worker updates wait until the user chooses **Update**. The app tells users to
save active work first, sends `SKIP_WAITING`, and reloads only after the new
worker controls the page.

## Offline data and mutation policy

Every stored object includes `tenantId` and `userId`. Composite partition indexes
prevent cross-workspace reads. Logout, access reset, and tenant switching delete
the entire offline database in addition to protected runtime caches.

Allowed queued mutations:

- `task.create`
- `task.update`
- `note.create`
- `lead.draft`
- `expense.draft`

Blocked offline operations include sending email/messages, publishing social
content, payments/refunds, signatures, invitations, permission changes, account
changes, destructive deletes, exports, and unrestricted API calls. Each allowed
mutation has a unique idempotency key, state, attempt count, timestamps, optional
base version, and a conflict state. A background-sync event only wakes controlled
clients; it does not bypass server authorization.

No production module currently calls the queue automatically. Module owners must
integrate an allowlisted operation with its server-side idempotency and conflict
handler before presenting an offline-success state. This is deliberate: the PWA
must never pretend a high-value action succeeded.

## Install, navigation, share, and notifications

- Install prompting starts only on the dashboard, after a returning engaged
  session, and waits 30 seconds. It never interrupts authentication.
- Installed primary navigation defaults to Home, CRM, Work, Money, and Bonnie,
  with no more than five destinations.
- The web share target accepts text/title/URL through a same-origin dashboard
  intake URL. File share ingestion and camera document capture remain explicit
  online-only work until authenticated storage, antivirus scanning, retention,
  and deletion policies are implemented.
- Push permission is requested only from the notification toggle.
- Push payload routes are restricted to same-origin dashboard, settings, and
  call paths. Expired payloads are ignored and dedupe tags replace repeated
  notifications. Payloads contain routing metadata, not cached business data.
- The destination reauthenticates and reauthorizes tenant access before live data
  loads. Quiet hours, per-category preferences, and device management require a
  future additive database migration and are not claimed as complete.

## Security and privacy

- Service-worker caches contain no API, session, tenant response, payment,
  message, or private-document data.
- IndexedDB rejects missing tenant/user partitions and clones values on write/read.
- Cached summary records expire and are removed on access after expiry.
- Storage is cleared during sign-out, tenant switch, session expiry, access
  revocation, and account removal.
- Notification URLs reject cross-origin and unexpected paths.
- Existing CSP, HSTS, anti-sniffing, referrer, frame, and permissions headers
  continue to apply.

## Accessibility and responsive behavior

The PWA retains the shared responsive shell instead of maintaining a divergent
mobile application. The five destinations use visible labels and existing
accessible navigation controls. Browser zoom remains enabled up to 5× and safe
area/native interaction styles remain shared. Install and update controls are
real buttons with persistent, readable status copy.

Manual verification is still required on iOS Safari, Android Chrome, desktop
Chrome/Edge, keyboard-only navigation, VoiceOver, TalkBack, 200% zoom, landscape,
split-screen, and device safe areas.

## Deployment and rollback

1. Run typecheck, lint, unit tests, design guard, and a production build.
2. Deploy over HTTPS with the existing `/sw.js` `no-store` response header.
3. Verify `/manifest.webmanifest`, `/sw.js`, icon responses, installability, a
   waiting-worker update, offline fallback, logout storage cleanup, and push
   deep links.
4. Monitor service-worker registration failures, install acceptance/dismissal,
   notification subscription failures, and sync/conflict counts without logging
   payload contents.

Rollback by deploying the prior application build. Do not unregister workers or
delete all browser storage during normal rollback. A compatible waiting worker
will activate only after user approval; old versioned caches are cleaned during
activation.

## Browser limitations and remaining risks

- Background Sync, install prompts, push, badges, share targets, and device tilt
  vary by browser and operating system. Core online workflows must remain usable
  without them.
- Safari does not expose Chromium's `beforeinstallprompt`; users need platform
  instructions.
- Reliable offline mutation execution is intentionally incomplete until each
  allowlisted operation has an idempotent, tenant-authorized server adapter and
  conflict UI.
- Push device/category management and binary share/camera ingestion need schema,
  storage, scanning, retention, observability, and end-to-end tests before launch.
- Lighthouse and real-device performance measurements must be captured from the
  production deployment; local scores are not production evidence.

## Files changed in this baseline

- `src/app/manifest.ts`
- `src/app/sw.ts`
- `src/app/layout.tsx`
- `src/lib/pwa/registerServiceWorker.ts`
- `src/lib/pwa/pwaPreferences.ts`
- `src/lib/platformReset.ts`
- `src/services/offlineService.ts`
- `src/services/pwaService.ts`
- `src/config/pwaMobileNav.ts`
- `src/components/common/PwaInstallPrompt.tsx`
- `src/components/pwa/PwaSettingsScreen.tsx`
- removed `public/manifest.json`
- removed `public/service-worker.js`

No database migration or environment variable was added by this baseline.
