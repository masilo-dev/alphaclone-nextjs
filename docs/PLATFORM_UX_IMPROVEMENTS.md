# Platform UX Improvements

Audit date: June 2025. Consolidates dashboard, admin, ticketing, email, forms, and registration findings with a prioritized roadmap.

## Executive summary

AlphaClone has a strong hub-based Business OS and working registration/onboarding emails, but fragmented navigation, inconsistent design tokens, and several surfaces that look finished but block users. This document tracks what was fixed and what remains.

## Ticket email — direct answer

| Recipient | Before | After (this pass) |
|-----------|--------|-------------------|
| Customer | No | Yes, when `customerEmail` is set on ticket metadata |
| Tenant team | Broken (client-side env) | Yes, via `/api/tickets/notify` + `notifyTenantOwners` |

WhatsApp/MCP tickets still use the separate `support_tickets` table and are not yet unified with Deep-Desk.

---

## UI/UX no-go area registry

### Fixed in this pass

| Area | Issue | Fix |
|------|-------|-----|
| Public branded forms | Missing `/api/forms/public` | Added route |
| Hub pages | Triple header (shell + hub title) | Hide BusinessDashboard title inside hubs |
| Mobile hub content | Hidden under bottom nav | Bottom padding on HubShell + edge-to-edge tabs |
| FormsHub | Blank first-run | `EmptyState` + create CTA |
| Deep-Desk priority | Local-only mock | Persists via `ticketService.updatePriority` |
| Ticket notifications | Client-side email | Server route `/api/tickets/notify` |
| Super admin nav | Users/Operations undiscoverable | Added to `ADMIN_NAV_ITEMS` |
| Super admin access | No UI guard; `super_admin` excluded | Route guards + `isPlatformAdminRole` |
| `/register` | Hardcoded production URL | Uses request origin |
| Tenants table empty state | Wrong colspan | Fixed to 7 columns |

### Still open (Phase 2+)

| Area | Issue | Priority |
|------|-------|----------|
| Navigation IA | Sidebar groups ≠ hub names | P1 |
| Tenant shell | No command palette / global search | P2 |
| Data tables | Most modules lack mobile card layout | P2 |
| Design tokens | Teal vs violet accent split | P2 |
| Typography | Jakarta/Sora referenced but not loaded | P2 |
| Orphan admin UI | `SuperAdminDashboard.tsx` unused | P2 |
| Ticketing | Dual tables (`tickets` vs `support_tickets`) | P1 |
| External form webhooks | Typeform/Tally URLs not wired | P3 |
| Post-signup | No guided tour for tenant admins | P2 |

---

## Design principles checklist

1. **One scroll root** — HubShell no longer nests its own vertical scroll.
2. **One accent system** — Target teal; remove violet gradients from module heroes (pending).
3. **Three state patterns** — Mandate `EmptyState`, `TableSkeleton`, `ResponsiveTable` (in progress).
4. **Mobile-first tables** — Extend `ResponsiveTable` beyond ExpenseTracker (pending).
5. **Discoverable nav** — Every routable admin page in sidebar (Users, Operations added).
6. **Honest UI** — No mock metrics or local-only state changes (priority fix done).
7. **Safe areas** — Bottom nav clearance on mobile hub and edge-to-edge views.

---

## Notification matrix

| Event | In-app | Email to customer | Email to team |
|-------|--------|-------------------|---------------|
| Registration / welcome | — | Yes | — |
| Onboarding lifecycle | — | Yes | — |
| Form submission | Automation | — | Yes (if notify enabled) |
| Ticket created | Yes (owners) | Yes (if customer email) | Yes |
| Ticket status change | Yes | Yes (if customer email) | Yes |
| Public ticket reply | — | Yes (if customer email) | — |
| WhatsApp ticket | Yes | Text auto-reply only | — |

---

## Registration improvements

- **Canonical signup URL:** `/auth/login?register=true&type=business&plan=starter`
- **`/register` redirect:** Now uses the current environment origin (dev/staging/prod).
- **Welcome email:** Works via `/api/email/welcome` and onboarding workflow.
- **Remaining friction:** 58 modules after signup with no guided tour — add product tour from client Dashboard.

---

## Priority roadmap

### Phase 1 — Critical paths (mostly done)
- [x] `/api/forms/public`
- [x] Ticket server notifications
- [x] Hub header collapse + mobile padding
- [x] FormsHub empty state
- [x] Admin nav + guards

### Phase 2 — Navigation & discoverability (mostly done)
- [x] Align sidebar group names with hub names (Sales, Marketing, Money, Insights, Documents, Channels)
- [x] Reduce Sales Hub tabs (10 → 6) and Money Hub tabs (9 → 7)
- [x] Port command palette + global search to BusinessDashboard
- [x] Post-signup guided tour for tenant admins (auto on first home visit)
- [x] Unified ticket list API (`/api/tickets`) merges `tickets` + `support_tickets` in Deep-Desk

### Phase 3 — Super admin hardening (done)
- [x] Removed orphan `SuperAdminDashboard.tsx` (see `src/components/admin/ARCHIVED.md`)
- [x] Secured platform ops via `/api/admin/users` and `/api/admin/tenants`
- [x] `userService` / `tenantManagementService` platform methods call server APIs
- [x] Route guards on `/dashboard/security` and all `/dashboard/admin/*` pages
- [x] Unified `isPlatformAdminRole` (`admin` + `super_admin`) across Dashboard and SecurityDashboard
- [x] Expanded user role filters in SuperAdminUsersTab
- [x] Removed dead `UserLocationTable` lazy import from Dashboard

### Phase 4 — Design system
- [ ] Load or remove Jakarta/Sora fonts
- [ ] Roll out `ResponsiveTable` to CRM, vault, clients
- [ ] Apply DESIGN_AUDIT_REPORT marketing fixes

### Phase 5 — Ticketing unification (partial)
- [x] Unified read/update API for both ticket tables in Deep-Desk
- [ ] Full DB merge or sync trigger (single source of truth)
- [ ] Customer portal / reply-by-email intake

---

## Key files

| Area | Path |
|------|------|
| Public forms API | `src/app/api/forms/public/route.ts` |
| Ticket notify API | `src/app/api/tickets/notify/route.ts` |
| Ticket service | `src/services/ticketService.ts` |
| Business shell | `src/components/dashboard/business/BusinessDashboard.tsx` |
| Hub chrome | `src/components/dashboard/hubs/HubShell.tsx` |
| Platform admin helper | `src/lib/platformAdmin.ts` |
| Admin nav | `src/constants.ts` (`ADMIN_NAV_ITEMS`) |
