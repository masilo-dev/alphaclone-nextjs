# Pages System Review

## Current state (quick assessment)

1. The app has **30 routes** under `src/app`, but **0 route-level loading boundaries** and **0 route-level error boundaries** before this change.
2. Several pages are very large and mix orchestration + UI logic directly inside route files (for example auth and booking pages), which makes testing and ownership harder.
3. Routing intent is clear in some places (e.g. `/login` redirecting to `/auth/login`), but route concerns are not consistently layered (marketing, auth, app shell) via route groups.
4. API routes are numerous and broad, which is fine, but page-system resilience was missing at the app level.

## Improvement delivered in this PR

- Added `src/app/loading.tsx` to provide a global loading fallback for route transitions and suspense boundaries.
- Added `src/app/error.tsx` to provide a global error boundary with a reset/retry path.

## Why this matters

- Improves perceived reliability: users no longer see blank states while routes stream.
- Improves recovery: uncaught render errors now have a user-facing retry action.
- Establishes a baseline so page-specific loading/error files can be added later in high-traffic areas (`/auth`, `/dashboard`, `/book`).

## Recommended next steps

1. Split `src/app/auth/login/page.tsx` into smaller view + hooks + service modules.
2. Add route-group layouts like `(marketing)`, `(auth)`, `(app)` for clearer ownership and performance tuning.
3. Add per-segment loading and error boundaries for `/dashboard/[[...slug]]` and booking pages.
4. Add smoke Playwright tests that verify loading and error UI for at least one route per segment.
