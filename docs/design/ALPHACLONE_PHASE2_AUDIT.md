# AlphaClone Phase 2 implementation and audit

Status: **expanded product implementation; acceptance gates remain blocked**. Draft PR #169 contains the changes. Phase 2 is not declared complete until the remaining rendered/live journeys and production build pass.

Baseline: `4b8c23a303210eb694b893fe6adbc0788c3376d6` on master. Public homepage, marketing components, root layout, global CSS and marketing styles are unchanged. No new dependencies, schema migrations, business-record mutations, execution API changes, or provider delivery changes.

## Architecture discovered

The repository implements a local Untitled-aligned design layer in `src/styles/alphaclone-theme.css`: semantic `--color-bg-*`, `--color-text-*`, `--color-border-*`, brand scale, radius, shadows and focus tokens. `StandardPageShell`, `StandardPanel`, native Input and AlphaClone workspace wrappers consume it. No vendor Untitled React dependency or direct vendor component imports were found; the existing local foundation was preserved.

The application has several generations:

| Layer | Existing implementation | Decision |
| --- | --- | --- |
| Brand and theme | `constants/brand.ts`, `constants/design.ts`, globals, AlphaClone theme | Preserve brand; scope product refinements |
| Shared primitives | `ui/UIComponents.tsx`, native button/input/textarea/badge, Radix-backed sheet | Preserve APIs and accessibility behavior |
| Focused workspace | WorkspaceShell/Header/Toolbar, HelpDisclosure, FocusedTaskShell | Compact shared headers; retain passive help |
| OS layer | ModuleFrame/Header, BacklitSurface, OS states and cards | Preserve functional patterns; shared heading marker |
| Other shells | StandardPageShell, ModuleShell, responsive PageHeader/EnterpriseModuleChrome | Harmonize density through existing wrappers |
| Application | Dashboard and BusinessDashboard, Sidebar, BottomNav, account menu | One first-run trigger in each shell; one replay entry |
| Responsive panels | DetailDrawer + Sheet, ResponsiveTable desktop/mobile wrappers | Dynamic viewport height; compact mobile rows |
| Client workspace | `/portal/[token]`, portal-login, set-password | Same tokens; distinct authentication and client navigation |

Existing icon families include AlphaClone module icons, Lucide, Heroicons and react-icons. No icon library was added. Tailwind 4 is configured through PostCSS/@theme; responsive patterns include 767/768px and 1024px. Z-index is centralized in design constants, including the existing tour layer. Older global, OS, PWA, Apple-fluid and crispness CSS layers remain; collapsing all of them without live visual QA would be unsafe.

## Primitive duplication and consolidation

Two Button implementations had different defaults and translation/loading contracts. They now share one renderer; the legacy wrapper preserves its translation and primary-button default while the native primitive preserves its neutral default. Two Input implementations exist: the labeled/validated Input in UIComponents and the native input primitive. Badges/status badges, skeleton/empty/error states, page headers and table wrappers also have multiple implementations. These were not blindly replaced.

Implemented: native Input and Textarea share the canonical field-control class; Textarea no longer invents a sky focus color. Client login/password setup consume native Input. PageHeader, WorkspaceHeader, ModuleShell, StandardPageShell and ModuleHeader use a shared product heading marker and density token. Specialized headers remain distinct APIs rather than losing breadcrumbs, filters or actions. Native Select now shares the same field-control class and retains the mobile OS picker. 413 text inputs, 99 textareas and 163 selects (675 fields in 164 product files) now consume the canonical controls across dashboard, CRM/leads, projects, email/outreach, social, accounting, contracts/documents, calendar/booking, analytics, settings/integrations and client workspace. Per-file coverage is in `ALPHACLONE_PHASE2_FIELD_MIGRATION.md`. Checkbox/radio/file/range/color/dynamic-type inputs and specialized validated wrappers retain their functional contracts. Dialog scrolling has a bounded flex region, an accessible fallback name, and focus is no longer reset by callback identity changes. Specialized table/dialog APIs were retained instead of forcing incompatible contracts together.

## Auth changes

A scoped light authentication surface overrides inherited dark-mode canvas/text conflicts. The form canvas is quiet and opaque; text and placeholders use readable neutral tokens. Submit actions use existing navy/white brand treatment. Inputs preserve 44px height and 16px mobile text to avoid iOS zoom. Auth cards have compact phone padding and restrained shadows. Login/MFA/reset errors use semantic readable error text and alert roles. Invitations no longer use white body text on light surfaces. Client auth routes share the auth treatment while preserving their existing session flows.

Sign-in, registration, inline forgot-password, password reset, invitation and client login/setup were inspected in source. OAuth, verification and provider redirect behavior were not changed or live verified. The legacy LoginModal remains and needs visual verification in its embedding context.

## Onboarding map before consolidation

| Component/system | Original trigger | Audience | Persisted state | Purpose / result |
| --- | --- | --- | --- | --- |
| ProductTour | Auto-start and explicit replay in both dashboard shells | Role-specific workspace users | `alphaclone:tour:v2:<user>`, legacy tour keys, profile walkthrough_completed | Keep one canonical replayable tour; remove auto-start callers |
| OnboardingFlow | Welcome close / incomplete onboarding | New workspace user | profile onboarding_completed/role, auth metadata, onboarding_completed/goal keys | Keep short first-run outcome picker; teach Connect → Direct → Approve → Execute → Verify |
| WelcomeModal | Dashboard gate before OnboardingFlow | Dashboard users | welcome_seen/business_welcome_seen | Removed trigger and unused component |
| BusinessWelcomeModal | BusinessDashboard gate before OnboardingFlow | Business users | same welcome flags | Removed trigger and unused component |
| NewUserSetupPanel | Empty stats and incomplete onboarding on BusinessHome | New workspace | setup_checklist_dismissed | Replace with one passive checklist after first-run |
| Chosen-first-task card | Completed outcome picker on BusinessHome | Users with saved goal | onboarding_goal_dismissed | Replaced by checklist; dismissal preserved |
| PlatformExecutionWelcome | Home/projects/admin module mount | Workspace users | platform_execution_welcome_<surface>_<user> | No proactive rendering; compatibility/event adapter retained |
| OnboardingWizard | No source consumers found | Historical setup | Existing wizard state | Unused component removed after source reference search |
| HelpDisclosure / WorkspaceGuide | User click, default collapsed | Contextual users | Usually component state | Preserve passive module guidance |
| CreateBusinessOnboarding/gate | Missing required business setup | New tenant owner | Tenant/auth state | Preserve: creates business, not a competing tutorial |
| OnboardingPipelines / ClientOnboardingTab | Business workflow selection | Tenant/client intake | Business workflow records | Preserve: operational onboarding |
| StripeConnectOnboarding | Payment-account connection | Tenant owner | Provider/account state | Preserve: financial setup |

### State preservation and behavior

The first-run gate requires a known incomplete profile, account created within the previous 24 hours, no existing guidance/completion flags, and successfully verified empty tenant clients/invoices/leads/projects. Missing tenant/profile, failed counts, restricted storage, old accounts, previous welcome, completed/dismissed tour and existing data suppress proactive guidance. The 24-hour eligibility window deliberately favors avoiding surprise prompts; older unfinished accounts use intentional replay.

Legacy `1` and `true` completion/dismissal values migrate safely. Existing record version rules remain. Hydrating durable completion never writes the same completion back to the profile. The gate no longer marks established workspaces artificially completed in the database. Completed users avoid extra workspace count requests; eligible count reads run concurrently and remain tenant scoped.

One intentional replay entry remains in the account menu: **Help · Product Tour**. Sidebar replay duplicates are removed. Explicit replay closes the outcome picker. Tour styles now use readable surface/text tokens and a viewport-bounded tooltip. The passive checklist yields while the tour is active, supports collapse/dismiss, and saves observed completion per tenant/user. It tracks business profile, first client, first project; it does not invent completion from a link click. Six steps now observe business profile, client, project, connected outbound mailbox, active publishable social identity and completed external action. A read-only, authenticated tenant-scoped endpoint projects booleans/null without retrieving provider secrets or changing business records. Failed reads leave state unknown; clicking a link never counts as completion. Previously observed completion remains persisted.

## Product and mobile changes

Product finishing CSS is scoped to authenticated/client/auth roots, not the homepage. Shared page headings and header gaps are compact. WorkspaceHeader defaults to compact; actions wrap. Mobile data cards are smaller and opaque. Table row actions are revealed for keyboard focus as well as hover. DetailDrawer uses dynamic viewport height plus safe-area inset. Client mobile navigation accounts for the bottom safe area. Reduced-motion rules are scoped to product/auth.

Business logic, provider OAuth, tenant isolation and client relationship/session logic remain unchanged. Client portal project/contract/invoice/message/logout flows still need live acceptance. Notification source layers include react-hot-toast, NotificationCenter, NotificationBell, NotificationsActivityTab and missed-call alerts. NotificationCenter now deduplicates initial and realtime rows by event ID, using the existing panel tokens and a viewport-bounded width. Backend notification delivery is unchanged. Live notification delivery/center acceptance remains unverified.

## Automated source inventory

Counts below are broad filename matches, not a claim that every matched screen was manually redesigned or tested. Shared-consumer counts identify existing adoption, not completed migration.

| Area | Matching source files | Existing shared consumers | Verification |
| --- | ---: | ---: | --- |
| Home/Dashboard | 4 | 0 | Shared shell/token and canonical form coverage; live journey pending |
| CRM/Leads/Clients | 68 | 10 | Shared shell/token and canonical form coverage; live journey pending |
| Lead Finder | 26 | 1 | Shared shell/token and canonical form coverage; live journey pending |
| Projects | 14 | 2 | Shared shell/token and canonical form coverage; live journey pending |
| Email/Outreach | 39 | 6 | Shared shell/token and canonical form coverage; live journey pending |
| Social | 11 | 0 | Shared shell/token and canonical form coverage; live journey pending |
| Accounting/Invoices/Quotes | 16 | 6 | Shared shell/token and canonical form coverage; live journey pending |
| Contracts/Documents | 26 | 5 | Shared shell/token and canonical form coverage; live journey pending |
| Calendar/Booking | 20 | 12 | Shared shell/token and canonical form coverage; live journey pending |
| Analytics | 11 | 0 | Shared shell/token and canonical form coverage; live journey pending |
| Settings/Integrations | 30 | 14 | Shared shell/token and canonical form coverage; live journey pending |
| Notifications | 6 | 1 | Shared shell/token and canonical form coverage; live journey pending |
| Client workspace | 4 | 0 | Shared shell/token and canonical form coverage; live journey pending |

## Validation and limits

- Final focused regression run: 32 tests passed (first-run policy/contrast, first-time UX, walkthrough state and consent enforcement), including legacy boolean-string migration and no profile write during hydration.
- Typecheck: passed again after the full field migration, Button consolidation, read-only progress endpoint and modal changes.
- Design-system guard: passed.
- Changed-file lint: passed across all changed TS/TSX/MJS files.
- Earlier full unit comparison: baseline 1,262 tests / 1,247 passed / 15 failed; initial Phase 2 1,263 tests / 1,248 passed / the same 15 failures. The expanded serial rerun stalled in unrelated live research/search network timeouts and did not produce a final summary. It is not counted as a successful final full-suite run. Final relevant regression run: 32/32 passed.
- Full lint: passed, 0 errors and 60 warnings. The existing test-loader `module` variable lint error was repaired without changing assertions; generated Workflow output is explicitly ignored.
- Production build: not verified. Prior standard/4GB retries failed with SIGKILL/heap exhaustion. The final sequential 6GB-heap attempt, with unuploadable Sentry maps temporarily disabled, again ended in worker SIGKILL; the container reached approximately 8.1GB of its 8GB limit. Temporary build-heap/source-map changes were reverted, preserving the established deployment configuration.
- Browser QA: installed an isolated Chromium executable outside product dependencies after the standard CDN archive failed. 39 unique rendered checks passed: login at all requested widths in light/dark states; new/existing/completed onboarding; CRM mobile matrix; and 12 desktop module routes. Exact checks and limits are in `ALPHACLONE_PHASE2_RENDERED_QA.json`. Local fixture CSP bypass only allows the synthetic localhost provider; production CSP was not changed. Authenticated checks assert the app remains on dashboard routes, preventing redirected login screens from being counted as module passes.
- No live authenticated test identities or client portal test session were available in this checkout; provider/business actions were not executed as visual tests.

Required widths 320, 360, 375, 390, 412, 430, 768 and 1280 passed for login and the CRM workspace. All three onboarding scenarios passed with synthetic state, including dismissal followed by reload. Full live journeys, provider redirects, client workspace, intentional tour replay, device keyboard/safe-area behavior, and data-rich mobile filters/tables remain acceptance gates. The all-module dev run exhausted memory; later browser batches hit the OS file-watch limit. No blocked check is counted as passed.

## Remaining completion gate

Phase 2 is NOT complete. Finish remaining specialized primitive/icon review, complete auth-variant/provider acceptance, data-rich mobile filters/tables/dialogs/keyboard/scrolling, notification delivery acceptance, intentional tour replay, full client workspace visual QA and the entire live journey matrix. Resolve build verification and confirm inherited baseline failures separately. Measure bundle/performance changes on a successful build. No dependencies were added; welcome/wizard UI was removed, but performance improvement is not claimed without measurements.

## Performance and repository hygiene

No product dependencies, animation libraries or global state stores were added. Chromium is QA-only and is not in package.json or the lockfile. Temporary source-map and heap workarounds did not make the build pass and were reverted. Production build configuration is unchanged. No successful production bundle comparison is available, so no performance improvement is claimed. Public homepage/marketing/root styles are unchanged, and `git diff --check` passed.
