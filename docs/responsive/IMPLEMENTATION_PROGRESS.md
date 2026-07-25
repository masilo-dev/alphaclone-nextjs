# Responsive implementation progress

Branch: `bonnie/responsive-dashboard-shell-bd76`

Baseline: platform UX audit + `ROUTE_IMPLEMENTATION_MATRIX.md`.

## Shipped in this pass

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
- HubShell: jump select on phone/tablet; tab strip from laptop up (avoids triple nav)
- Channels hub → **Inbox** with Unified Inbox first; Marketing “Inbox” renamed to Email
- Sidebar Expenses → `/dashboard/business/expenses` (audit P0)
- Tenant Communication nav labels clarified
- BusinessDashboard `<main id="main-content">` landmark fixed
- ModulePageLayout phone bottom-nav safe padding
- Sheets: full-width on phone for detail drawers

### Workflows / a11y / productivity
- Deal → Invoice: resolves `clientId` via `crm_contact_id`, navigates to billing, next-step toasts
- Deal detail: Open customer / Create quote / Schedule follow-up
- `UIComponents.Modal`: dialog semantics, Escape, focus trap, phone bottom sheet behaviour
- `UIComponents.Input`: label `htmlFor` / `id` association
- Keyboard shortcuts help lists only real shortcuts
- Command palette expanded (accounting, expenses, campaigns, Bonnie, etc.; duplicate mail entries removed)
- Tables: card layout through tablet (`lg` breakpoint); improved empty presentation
- Business home: phone-first priority feed; overview charts optional / desktop-preferred

## Still required (matrix remaining)

Per-module intentional layouts still need progressive adoption of `PageHeader` + card lists + full-screen sheets across:
- Invoice create progressive sections
- Accounting expandable rows on phone
- Campaign builder stepper on phone
- Calendar agenda default on phone
- Settings category list → screen on phone
- Bonnie full-screen conversation on phone
- PermissionGate UI across modules
- VirtualList adoption on largest CRM/invoice lists
- Full viewport matrix QA (1920 → 320 + intermediates)

Continue from implementation order items 10–24 in the prompt.
