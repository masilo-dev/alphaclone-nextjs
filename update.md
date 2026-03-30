# Update Log
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
