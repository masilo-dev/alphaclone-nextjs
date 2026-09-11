# AlphaClone PWA Companion Mode — Repository Audit

This audit was completed before the companion-mode foundation was added. The implementation extends the existing Next.js/PWA application only.

## Existing infrastructure reused

- `src/app/manifest.ts` — canonical Next.js PWA manifest; already standalone and supports window-controls-overlay.
- Serwist `/sw.js` infrastructure — existing service-worker runtime; no replacement worker is introduced.
- `src/contexts/PWAContext.tsx` — canonical installed-mode detection; extended by OS v3 to classify mobile/tablet/desktop installed surfaces.
- `src/components/shells/AppShell.tsx` — existing installed-PWA shell; retained and refined rather than duplicated.
- `src/components/shells/ShellSwitcher.tsx` — existing browser/PWA presentation switch.
- `src/components/common/PwaInstallPrompt.tsx` — canonical install UX; existing duplicate nudge remains deprecated/no-op.
- `src/components/pwa/PwaPushBootstrap.tsx` and existing notification infrastructure — retained for push registration and delivery.
- `src/services/offlineService.ts` / `src/services/pwaService.ts` — existing offline/PWA services remain canonical.
- `src/components/dashboard/BottomNav.tsx` — existing phone bottom navigation; upgraded for companion mode.
- `src/components/dashboard/responsive/MobileMoreSheet.tsx` — existing all-module mobile catalogue; retained.
- `src/config/responsive/mobileNav.ts` and `src/config/pwaMobileNav.ts` — existing route/catalogue definitions; companion capability policy is layered on top rather than replacing routing.
- `src/hooks/useBreakpoint.ts` — existing breakpoint primitive; reused by `useDeviceExperience()`.
- Existing AlphaClone OS v3 design layer — reused for material, motion, safe-area and accessibility behavior.

## Existing product behavior relevant to Companion

- Canonical Home is already attention-first (`AttentionFirstDashboard`) and uses canonical tenant stats, Bonnie approvals and Bonnie morning brief data.
- Bonnie already has shared MCP/tool authorization and approval infrastructure. Companion mode must not fork or create mobile-only Bonnie tools.
- Mobile More already exposes grouped business modules instead of cloning the desktop sidebar hierarchy.
- Manifest shortcuts already deep-link into Home, CRM, Work, Money and Bonnie.
- Installed PWA already bypasses the marketing landing experience for authenticated users and restores into the application shell.

## Gaps found

1. Device behavior had no single capability contract. Width checks existed, but advanced-workspace capabilities were not centralized.
2. Installed bottom navigation was preference-driven and did not enforce the intended Companion information architecture.
3. There was no canonical mobile module capability matrix for FULL / COMPANION / READ_ONLY / DESKTOP behavior.
4. There was no shared non-error desktop handoff primitive.
5. Installed AppShell still used an old hard-coded generic background rather than the canonical AlphaClone design tokens.
6. Mobile restrictions and desktop-first actions need progressive adoption inside module interiors; they must not be scattered as arbitrary width checks.
7. Heavy surfaces (Gantt, advanced editors, dense analytics, builders) still require per-module lazy-loading/code-splitting audits.
8. Direct client-side Supabase access exists in legacy surfaces and requires incremental audit/migration where it bypasses established API/service boundaries; companion mode must not add new privileged browser writes.
9. Push/deep-link coverage needs a route-by-route validation pass to ensure notification taps open the correct mobile record.
10. Offline cache policy needs route/data classification before expanding read caching; consequential writes must remain online-only.

## Foundation added on this branch

- `src/config/pwaCompanionCapabilities.ts` — canonical mobile capability policy.
- `src/hooks/useDeviceExperience.ts` — centralized behavior capability hook.
- `src/components/ui/os/DesktopRequired.tsx` — reusable desktop handoff UI.
- Installed PWA bottom navigation fixed to Home / Work / Bonnie / Inbox / More.
- Installed AppShell uses AlphaClone semantic design tokens and explicit companion shell classification.

## Architecture rule

Companion mode is a presentation/capability layer only. Authentication, tenancy, RLS, APIs, MCP, Bonnie, CRM, Projects, Finance, Documents, Calendar, Social, Marketing, Leads, Contracts, Invoices, Nexus, Control System, Settings, notifications and business logs remain shared canonical systems.

No mobile-specific business-data tables, backend, service layer or tool catalog are permitted.
