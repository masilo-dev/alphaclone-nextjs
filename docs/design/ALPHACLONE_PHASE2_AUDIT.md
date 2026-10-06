# AlphaClone Phase 2 implementation and audit

Status: **partial implementation, draft review only**. This is not a complete authenticated-product acceptance report.

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

Two Button implementations have different defaults and translation/loading contracts. Two Input implementations exist: the labeled/validated Input in UIComponents and the native input primitive. Badges/status badges, skeleton/empty/error states, page headers and table wrappers also have multiple implementations. These were not blindly replaced.

Implemented: native Input and Textarea share the canonical field-control class; Textarea no longer invents a sky focus color. Client login/password setup consume native Input. PageHeader, WorkspaceHeader, ModuleShell, StandardPageShell and ModuleHeader use a shared product heading marker and density token. Specialized headers remain distinct APIs rather than losing breadcrumbs, filters or actions. Full Button/Select/Checkbox/Radio/Toggle/Dialog/table consolidation remains outstanding.

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

One intentional replay entry remains in the account menu: **Help · Product Tour**. Sidebar replay duplicates are removed. Explicit replay closes the outcome picker. Tour styles now use readable surface/text tokens and a viewport-bounded tooltip. The passive checklist yields while the tour is active, supports collapse/dismiss, and saves observed completion per tenant/user. It tracks business profile, first client, first project; it does not invent completion from a link click. Email/social connection and verified execution checklist steps remain to be connected to canonical real state.

## Product and mobile changes

Product finishing CSS is scoped to authenticated/client/auth roots, not the homepage. Shared page headings and header gaps are compact. WorkspaceHeader defaults to compact; actions wrap. Mobile data cards are smaller and opaque. Table row actions are revealed for keyboard focus as well as hover. DetailDrawer uses dynamic viewport height plus safe-area inset. Client mobile navigation accounts for the bottom safe area. Reduced-motion rules are scoped to product/auth.

Business logic, provider OAuth, tenant isolation and client relationship/session logic remain unchanged. Client portal project/contract/invoice/message/logout flows still need live acceptance. Notification source layers include react-hot-toast, NotificationCenter, NotificationBell, NotificationsActivityTab and missed-call alerts. No notification backend delivery changes were made, and event-level UI deduplication is not yet verified.

## Automated source inventory

Counts below are broad filename matches, not a claim that every matched screen was manually redesigned or tested. Shared-consumer counts identify existing adoption, not completed migration.

| Area | Matching source files | Existing shared consumers | Verification |
| --- | ---: | ---: | --- |
| Home/Dashboard | 4 | 0 | Shared shell/token coverage; live journey pending |
| CRM/Leads/Clients | 68 | 10 | Shared shell/token coverage; live journey pending |
| Lead Finder | 26 | 1 | Shared shell/token coverage; live journey pending |
| Projects | 14 | 2 | Shared shell/token coverage; live journey pending |
| Email/Outreach | 39 | 6 | Shared shell/token coverage; live journey pending |
| Social | 11 | 0 | Shared shell/token coverage; live journey pending |
| Accounting/Invoices/Quotes | 16 | 6 | Shared shell/token coverage; live journey pending |
| Contracts/Documents | 26 | 5 | Shared shell/token coverage; live journey pending |
| Calendar/Booking | 20 | 12 | Shared shell/token coverage; live journey pending |
| Analytics | 11 | 0 | Shared shell/token coverage; live journey pending |
| Settings/Integrations | 30 | 14 | Shared shell/token coverage; live journey pending |
| Notifications | 6 | 1 | Shared shell/token coverage; live journey pending |
| Client workspace | 4 | 0 | Shared shell/token coverage; live journey pending |

## Validation and limits

- Targeted first-run, first-time UX and walkthrough state tests: 21 passed, including legacy boolean-string migration and no profile write during hydration.
- Typecheck: passed after auth/checklist/shared-component changes.
- Design-system guard: passed.
- Changed-file lint: passed across all changed TS/TSX/MJS files.
- Full unit suite at baseline: 1,262 tests, 1,247 passed, 15 failed. Current full run: 1,263 tests, 1,248 passed, same 15 failures. Additional state tests were run separately after this comparison.
- Full lint: existing error in unchanged `tests/unit/cookie-consent-enforcement.test.mjs` (`no-assign-module-variable`), plus warnings.
- Standard production build: worker killed with SIGKILL in the 8GB runtime. The 4GB-heap retry failed with JavaScript heap exhaustion/SIGABRT. Neither build is verified.
- Playwright Chromium installation failed with truncated/invalid download archives. Browser-based QA did not run.
- No live authenticated test identities or client portal test session were available in this checkout; provider/business actions were not executed as visual tests.

Required widths 320, 360, 375, 390, 412, 430, tablet and desktop are **pending rendered QA**. Required new/existing/completed-onboarding and full module/client-portal journeys are **pending live E2E**. CSS/source checks cannot replace those checks.

## Remaining completion gate

Phase 2 is NOT complete. Finish module-specific migration of remaining ad-hoc primitives, all auth variants, mobile filters/tables/dialogs/keyboard/scrolling, icon consistency, notification surface deduplication, integration/execution checklist state, full client workspace visual QA and the entire requested journey matrix. Resolve build verification and confirm inherited baseline failures separately. Measure bundle/performance changes on a successful build. No dependencies were added; welcome/wizard UI was removed, but performance improvement is not claimed without measurements.
