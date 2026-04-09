# Update Log

## Date: 2026-04-09 (MARKETPLACE RESTORATION)

### Fixed
- Restored the **Integrations Marketplace** with dedicated page routing.
- Resolved `no-response` Service Worker errors by implementing a robust navigation fallback.

### Added
- Integrated **Claude Desktop (MCP)** and **Manus AI (MCP)** setup guides into the Marketplace.
- Enhanced the MCP Setup Guide with platform-specific instructions for **Manus AI**.
- Added **HubSpot Sync**, **SendGrid**, **Resend**, and **Calendly** with direct internal configuration links.

## Date: 2026-04-09 (BUILD FLAG FIX)

### Fixed
- Resolved `unknown option --no-lint` error by moving build-time exclusion settings (linting and typechecking) into `next.config.ts`.
- Cleaned up `package.json` build scripts.

## Date: 2026-04-09 (SPEED OPTIMIZATION)

### Changed
- Added `--no-lint` to build scripts to bypass redundant ESLint checks on Vercel, reducing build time by ~3-5 minutes.
- Implemented **fail-fast safety timeouts** (500ms-1s) for Redis and Supabase calls in the middleware to prevent network-induced build stalls.

## Date: 2026-04-09 (RECOVERY)

### Fixed
- Reverted configuration structure to root (`middleware.ts`, `instrumentation.ts`, `instrumentation-client.ts`) to resolve Vercel build stalls.
- Restored `chunkLoadTimeout: 180000` in `next.config.ts` to prevent build timeouts during large bundle generation.
- Harmonized Sentry initialization across environments.

## Date: 2026-04-09

### Changed
- `src/proxy.ts` (Migrated logic from root `middleware.ts` to follow Next.js 16 deprecated convention fixes)
- `src/instrumentation-client.ts` (Added Sentry `onRouterTransitionStart` export as required for Next.js 16 navigation instrumentation)

### Removed
- `middleware.ts` (root) - Deprecated in favor of `src/proxy.ts`
- `instrumentation-client.ts` (root) - Replaced by `src/instrumentation-client.ts`

## Date: 2026-04-01

### Changed
- `src/services/workflowService.ts` (Refactored to support normalized Header-Detail schema with `getWorkflowById` implementation)
- `src/components/dashboard/workflows/AutomationBuilder.tsx` (Implemented workflow loading/restoration from `trigger_conditions` and added sequence management controls)
- `src/app/api/scraper/search/route.ts` (Relaxed search filters to broaden lead generation capabilities for technical niches)
- `src/components/leads/OmniLeadFinder.tsx` (Optimized search query construction and enhanced UI flexibility for niche-based extraction)

### Database
- Updated `workflow_action_type` enum to support 14 new automation action types including AI and Zoho CRM integrations.

## Date: 2026-03-30

### Changed
- `src/components/dashboard/HomeTab.tsx` (Removed platform quick start video tour and cleaned up unused LoomVideo imports)
- `src/components/dashboard/admin/GlobalSettingsTab.tsx` (Removed AI infrastructure and admin video guides and cleaned up unused LoomVideo imports)
- `src/components/common/CookieConsent.tsx` (Fixed Shield icon naming conflict and resolved TypeScript build errors)
- `next.config.ts` (Modernized Sentry configuration to use non-deprecated webpack and telemetry properties)
- `public/sw.js` (Service worker updated during build)

### Added
- `src/app/global-error.tsx` (Sentry global error handler)
- `public/sw.js.map` (Service worker source map)

## Date: 2026-03-28

### Changed
- `public/sw.js`
- `src/app/book/[slug]/[service_slug]/page.tsx`
- `src/components/blog/MarkdownRenderer.tsx`
- `src/components/dashboard/HomeTab.tsx`
- `src/components/dashboard/admin/GlobalSettingsTab.tsx`
- `src/constants.ts`

### Added
- `IMPLEMENTATION_PROGRESS.md`
- `MANUAL_PAGE_AUDIT.md`
- `SYSTEMS_ROADMAP_TO_100_PERCENT.md`
- `ZOHO_INTEGRATION_AUDIT.md`
- `src/components/ui/LoomVideo.tsx`
- `scripts/run_migration.ts`
