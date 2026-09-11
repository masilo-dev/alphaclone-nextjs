# Authenticated platform redesign audit

Updated: 2026-07-27

## Architecture discovered

- Next.js 16 App Router with one authenticated catch-all route:
  `src/app/dashboard/[[...slug]]/page.tsx`.
- React 19 client dashboard shell selected by role in
  `DashboardClientPage.tsx`.
- Tenant administrators use `BusinessDashboard.tsx`; other roles use
  `Dashboard.tsx`.
- Supabase supplies authentication, tenant data, storage, realtime, and database
  access. TanStack Query manages server-state caching in newer modules.
- Tailwind CSS v4, global semantic CSS, shared OS primitives, and legacy local
  utility classes coexist. Some older components still use Chakra UI.
- Theme preference supports light, dark, and system modes and is stored per user.
- Dashboard routing is normalized through canonical route helpers and rendered
  through the existing role-aware shells; it must not be replaced with a second
  route tree.

## Authenticated module inventory

| Area | Existing implementation | Audit classification |
| --- | --- | --- |
| Home / operating overview | `OperatingSystemHome`, `BusinessHome` | Complete data path; shared visual system in progress |
| CRM / contacts / accounts / follow-ups | CRM hub, `CRMTab`, CRM subpages | Functionally broad; visually inconsistent legacy surfaces |
| Leads / deals / outreach / quotes | Existing dashboard tabs and lead services | Connected; mixed component generations |
| Projects / tasks / goals | Project and task modules with shared routes | Connected; inconsistent page chrome and responsive density |
| Calendar / meetings / booking | Existing calendar, meeting, and booking modules | Connected; needs common page states |
| Documents / contracts / vault | Shared document workspace and contract lifecycle | Connected; some placeholder subviews and hard-coded dark styles |
| Invoices / accounting / expenses / cash flow | Existing billing and accounting modules | Connected; preserve provider-confirmed financial status |
| Marketing / social / forms / sequences | Existing campaign, composer, provider, and form modules | Connected; several independent visual systems |
| Inbox / email / messages / tickets | Communication hub and provider-specific views | Connected; needs unified shell and theme-safe surfaces |
| Reports / analytics / executive | Multiple report dashboards | Connected; chart and empty-state consistency varies |
| Bonnie / approvals / agents | Bonnie workspace, widget, action centre, durable runtime | Connected; contextual entry points exist |
| Automations | Workflow dashboard and durable execution services | Connected; approval and error records must remain intact |
| Team / settings / integrations / audit | Existing administration routes and APIs | Connected; navigation and control styling varies |
| Mobile PWA | Shared bottom navigation and More catalogue | Functional; primary destinations standardized |

## Primary issues found

1. The former canonical palette was electric blue and violet, conflicting with
   the approved navy, teal, and coral identity.
2. Shared semantic tokens existed, but many modules still contain literal
   slate/blue/teal/white classes that fail light-theme consistency.
3. Two role-specific dashboard shells remain active. They share many primitives
   but duplicate some header and navigation behavior.
4. The real tenant-admin sidebar is a mature component, while an older Chakra
   `Layout/Sidebar.tsx` and `Layout/Header.tsx` remain as duplicate legacy UI.
5. Global search and the command palette both claimed `Cmd/Ctrl+K`, causing an
   interaction conflict.
6. Several very large all-in-one module components mix queries, workflow logic,
   and presentation, raising regression and performance risk during redesign.
7. Empty, loading, and error states exist but are not consistently built from
   the shared responsive state primitives.
8. Some tables intentionally require horizontal scrolling on phones instead of
   using the existing mobile record-card pattern.
9. Shared controls contain hard-coded dark-theme text and surfaces.
10. Dashboard ambience and module surfaces are implemented, but the older blue
    atmosphere is visually stronger than the requested restrained Backlit model.

## Backend and security boundaries

- Do not replace Supabase authorization, RLS, tenant membership validation,
  canonical server routes, provider identity verification, or audit services.
- Client-side hidden actions are presentation only; server handlers remain the
  permission boundary.
- Payment, publishing, messaging, contract, and invoice success states must come
  from provider/backend confirmation.
- Signed contract versions, payment evidence, and durable Bonnie execution
  records are immutable or lifecycle-controlled and must remain so.
- Tenant switching and sign-out already reset protected browser state.

## Implementation map

1. Canonical semantic tokens and restrained Backlit primitive.
2. Shared shell actions, grouped navigation, mobile navigation, and shortcut
   ownership.
3. Theme-safe shared buttons, fields, cards, overlays, page headers, state panels,
   tables, and status badges.
4. Home and cross-module overview.
5. Relationships and sales.
6. Work and scheduling.
7. Money.
8. Growth and communications.
9. Knowledge.
10. Intelligence and administration.
11. Responsive, accessibility, performance, security, and workflow verification.

## Current limitations

This audit is a living implementation document. A route is not marked redesigned
merely because it inherits new tokens. Each functional area still requires
focused desktop, tablet, phone, light-theme, dark-theme, keyboard, empty, loading,
error, permission, and real-mutation verification before the platform-wide task
can be declared complete.
