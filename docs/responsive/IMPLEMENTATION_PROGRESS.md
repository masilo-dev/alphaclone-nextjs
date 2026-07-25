# Responsive implementation progress

Branch: `bonnie/responsive-dashboard-shell-bd76`  
PR: https://github.com/masilo-dev/alphaclone-nextjs/pull/99

Baseline: platform UX audit + `ROUTE_IMPLEMENTATION_MATRIX.md`.

## Shipped

### Foundations
- Responsive tokens: `src/constants/responsive.ts`
- App colour roles wired into workspace CSS (`--app-*` in `globals.css`)
- Breakpoints aligned in `ENTERPRISE.breakpoints` (phone / tablet / laptop / desktop)
- Shared `PageHeader`, `MobileMoreSheet`, `StatePanel`
- Accessibility CSS imported; skip link mounted in `Providers`
- Reduced-motion expanded; phone overflow clip; sticky CTA clearance

### Shell & navigation
- Phone bottom nav: **Home · Customers · Work · Inbox · More** (`mobileNav.ts` + `BottomNav.tsx`)
- More opens job-grouped catalogue (Sell / Deliver / Get paid / Grow / Operate)
- HubShell: jump select on phone/tablet; tab strip from laptop up
- Channels hub → **Inbox** with Unified Inbox first; Marketing “Inbox” → Email
- **Expenses** sidebar → `/dashboard/business/expenses`
- BusinessDashboard `<main id="main-content">` landmark fixed
- ModulePageLayout phone bottom-nav safe padding
- Sheets: full-width on phone for detail drawers

### Workflows / a11y / productivity
- Deal → Invoice: `clientId` via `crm_contact_id`, navigate to billing, next-step toasts
- Deal detail: Open customer / Create quote / Schedule follow-up
- Modal dialog a11y + phone sheet behaviour; Input label association
- Keyboard shortcuts help = real shortcuts only
- Command palette expanded; duplicate mail entries removed

### Module screens (intentional reflow)
- **Home** — attention-first phone feed; overview charts optional/desktop
- **Invoices (EnhancedBillingPage)** — PageHeader, mobile cards, Create always visible
- **Expenses** — PageHeader, Add Expense primary, receipt secondary
- **Quotes** — PageHeader + New Quote primary
- **CRM / Clients** — PageHeader, phone cards, primary Add
- **CRMTab** — detail PageHeader; ResponsiveTable split at `lg`
- **Settings** — phone category list → drill-in; Danger Zone separated
- **HomeTab** expenses shortcut fixed

## Remaining (continue implementation order 12–24)

| Area | Status |
|---|---|
| Accounting tables / banking / vendors phone rows | Pending |
| Campaign builder phone stepper | Pending |
| Social composer unify + phone flow | Pending |
| Calendar agenda default on phone | Pending |
| Documents / contracts phone list | Pending |
| Tasks / projects unify + phone list | Pending |
| Reports stacked charts on phone | Pending |
| Bonnie full-screen on phone | Pending |
| Inbox three-pane → list/thread on phone | Pending |
| PermissionGate shared UI | Pending |
| VirtualList on largest lists | Pending |
| Full viewport matrix QA (1920→320 + intermediates) | Pending |

No marketing or database changes in this branch.
