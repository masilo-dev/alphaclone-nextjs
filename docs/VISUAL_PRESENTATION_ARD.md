# AlphaClone Visual Presentation ARD

**Version:** 1.0  
**Date:** June 25, 2026  
**Scope:** UI, routing, copy, and layout only — no data model or sync changes  
**Brand constraint:** All new views use the existing AlphaClone palette (teal, violet, cyan, dark slate)

---

## Executive Summary

AlphaClone is functionally broad (~40+ dashboard modules, real GL/invoicing, campaigns, CRM pipelines) but **visually fragmented**. Competitors win on cohesive record pages, unified dashboards, and purpose-built visual workflows — not on having more features under the hood.

This ARD maps gaps against Salesforce, HubSpot, QuickBooks, and top email/KPI platforms, then defines a phased presentation-layer implementation plan.

---

## Brand Color Preservation (Non-Negotiable)

We adopt competitor **layouts and UX patterns**, not their color systems.

| Token             | Value                                | Use                                             |
| ----------------- | ------------------------------------ | ----------------------------------------------- |
| Primary / actions | `#14b8a6` (teal-500)                 | Buttons, active nav, success, pipeline positive |
| AI / intelligence | `#8b5cf6` (violet-500)               | AI features, secondary CTAs                     |
| Accent / charts   | `#06b6d4` (cyan-500)                 | Chart lines, links, hover glows                 |
| Background deep   | `#020617` (slate-950)                | Page canvas                                     |
| Panels            | `#0f172a` / `#1e293b`                | Cards, sidebars, modals                         |
| Glass             | `bg-slate-800/50` + `border-white/5` | Existing glassmorphism                          |
| Danger            | `#f87171` (red-400)                  | Errors, overdue                                 |

**Forbidden:** Salesforce blue, HubSpot orange, QuickBooks green, Mailchimp yellow as primary UI chrome.

**Gradients:** Simplify 5-stop metallic gradients to 2-stop teal→cyan or teal→violet only.

**Implementation guardrail:** Use `UIComponents.tsx`, existing Tailwind tokens, and chart colors `#14b8a6`, `#06b6d4`, `#8b5cf6`, `#f87171`.

---

## Domain Gap Analysis

### 1. Salesforce CRM — View Gaps

**Exists:** Leads kanban, deals pipeline, clients/contacts via `ClientsPage`, forecast, activity timelines, quotes.

**Missing visually:**

| Pattern                      | Gap                                                    | Fix                                      |
| ---------------------------- | ------------------------------------------------------ | ---------------------------------------- |
| Account record page          | No `/dashboard/crm/companies`; `CompanyService` unused | `AccountsPage.tsx` + tabbed record shell |
| Unified contacts             | `ContactsList.tsx` orphaned                            | Wire route + CRM nav                     |
| Opportunity products/history | Deal detail lacks product tabs                         | Extend `DealDetailModal`                 |
| List views                   | No saved filters/columns                               | `ListViewToolbar` (localStorage)         |
| CRM reports                  | `ReportsPage` is business analytics                    | `CRMReportsTab` templates                |
| Sales console                | Scattered home widgets                                 | `SalesConsole.tsx`                       |
| Lead import                  | `LeadImportModal.tsx` unwired                          | Wire into `CRMTab`                       |
| Deal pipeline alt            | `DealPipeline.tsx` orphaned                            | Merge or toggle in `DealsTab`            |

**Shared component:** `RecordPageShell.tsx` — tabbed record layout for Account, Contact, Deal, Lead.

---

### 2. HubSpot — Marketing Copy Gaps

**Exists:** Landing, pricing, FAQ (5 items), blog, who-we-serve, product SEO pages, HubSpot CRM sync.

**Missing copy:**

| Content type            | Fix                                                       |
| ----------------------- | --------------------------------------------------------- |
| Feature deep-dives      | `/marketing/email`, `/automation`, `/forms`, `/sequences` |
| Persona narratives      | Solopreneur, agency, consultant pages with stack diagrams |
| Case studies            | `/customers` with 3–5 story templates                     |
| Expanded FAQ            | 25–30 items (sequences, scoring, GDPR, vs HubSpot tiers)  |
| Newsletter CTA          | Footer + blog sidebar signup                              |
| Onboarding empty states | HubSpot-familiar in-app copy                              |

**Tone fixes:** Remove excessive ALL CAPS; measured copy; Inter + Space Grotesk only.

---

### 3. QuickBooks — Accounting Visual Gaps

**Exists:** Accounting hub, P&L/BS/trial balance, invoicing, expenses, cash flow forecast, journal entries, chart of accounts.

**Missing visually:**

| QuickBooks pattern  | Fix                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------- |
| Banking center      | `BankingCenterPage.tsx` using existing reconciliation APIs                                         |
| Bills & payables    | `BillsPayablePage.tsx`                                                                             |
| Cash flow statement | Tab in `FinancialReportsPage`                                                                      |
| Period close        | `PeriodClosePage.tsx`                                                                              |
| Unified Money nav   | `MoneyHub.tsx` shell                                                                               |
| Payment matching UI | Match drawer on invoice detail                                                                     |
| Route split         | `Dashboard.tsx` → PnL only; `BusinessDashboard` → full hub — **unify both to AccountingDashboard** |

---

### 4. Email Marketing — Visual Gaps

**Exists:** `CampaignBuilder.tsx` (primary), sequences in DB/MCP, Brevo/Resend.

**Missing visually:**

| Pattern            | Fix                                                   |
| ------------------ | ----------------------------------------------------- |
| Sequence builder   | `SequenceBuilder.tsx` step timeline                   |
| Drag-drop editor   | `EmailBlockEditor.tsx`                                |
| A/B test UI        | Split % modal on send                                 |
| Segment builder    | `SegmentBuilder.tsx` filter chips                     |
| Campaign analytics | Wire `CampaignAnalytics.tsx` → `emailCampaignService` |
| Deliverability     | `DeliverabilityPanel.tsx`                             |
| Marketing hub      | `MarketingHub.tsx` shell                              |

---

### 5. KPI & Analytics — Gaps

**Critical issue:** `/dashboard/analytics` → `AnalyticsTab.tsx` uses **hardcoded mock data** while `AnalyticsDashboard.tsx` (real `analyticsService`) is **never routed**.

| Surface                       | Data quality         |
| ----------------------------- | -------------------- |
| `/dashboard/analytics`        | Mock                 |
| `/dashboard/performance`      | Real                 |
| `/dashboard/business/reports` | Real                 |
| Home KPI cards                | Mixed; mock fallback |

**Fixes:**

1. Replace mock `AnalyticsTab` with `analyticsService` (keep compact mobile UI)
2. Retune `AnalyticsDashboard` chart colors to brand palette
3. Build `ExecutiveDashboard.tsx` with widget grid + drill-down links
4. Wire date range pills to API everywhere
5. Link report catalog items to real routes

---

## Cross-Cutting Requirements

- **Design system:** `UIComponents.tsx` canonical; typography Inter + Space Grotesk
- **Navigation:** 5 hubs — Sales, Marketing, Money, Operations, Settings
- **Record pages:** Breadcrumbs + `RecordPageShell`
- **Empty states:** Teal CTA, illustrated per module
- **Mobile:** Hub structure in bottom nav "More" sheet

---

## Implementation Phases

### Phase 0 — Quick wins

- [x] Replace mock `AnalyticsTab` with real `analyticsService` data
- [x] Wire `ContactsList`, `LeadImportModal`, `EmailCampaignAnalytics`
- [x] Fix accounting route in `Dashboard.tsx` → `AccountingDashboard`
- [x] Brand colors on `AnalyticsDashboard` pie chart

### Phase 1 — Hub shells

- [x] `HubShell.tsx`, `SalesHub`, `MarketingHub`, `MoneyHub`, `InsightsHub`
- [x] `RecordPageShell.tsx`
- [x] Hub wrapping in `BusinessDashboard` + nav items in `constants.ts`

### Phase 2 — CRM visual parity

- [x] `AccountsPage`, `ListViewToolbar`, `SalesConsole`, `CRMReportsTab`
- [x] Enhanced deal record tabs (Products, Stage History)

### Phase 3 — Accounting visual parity

- [x] `BankingCenterPage`, `BillsPayablePage`, cash flow statement tab, `PeriodClosePage`

### Phase 4 — Email visual parity

- [x] `SequenceBuilder`, `SegmentBuilder`, A/B test UI, `DeliverabilityPanel`

### Phase 5 — KPI unification

- [x] `ExecutiveDashboard` with goal tracking and drill-down

### Phase 6 — Marketing copy

- [x] Expanded FAQ (25 items), `/marketing/*` pages, `/customers`

### Phase 7 — Polish

- [x] `EmptyState` component, hub sub-nav breadcrumbs via `HubShell`, brand teal on report tabs

---

## Orphan Component Inventory

| Component              | Path                                                       | Action                            |
| ---------------------- | ---------------------------------------------------------- | --------------------------------- |
| `ContactsList`         | `src/components/dashboard/crm/ContactsList.tsx`            | Wire route                        |
| `LeadImportModal`      | `src/components/dashboard/crm/LeadImportModal.tsx`         | Wire CRMTab                       |
| `DealPipeline`         | `src/components/dashboard/crm/DealPipeline.tsx`            | Evaluate/merge                    |
| `AnalyticsDashboard`   | `src/components/dashboard/AnalyticsDashboard.tsx`          | Merge into AnalyticsTab or route  |
| `CampaignManager/List` | `src/components/dashboard/marketing/`                      | Consolidate under CampaignBuilder |
| `CampaignAnalytics`    | `src/components/dashboard/marketing/CampaignAnalytics.tsx` | Migrate to emailCampaignService   |

---

## Success Metrics

- Zero mock KPI data on primary analytics route
- All orphan components wired or removed
- Tabbed record pages for Account, Contact, Deal, Lead, Invoice
- Single executive dashboard replaces fragmented analytics
- Marketing feature-depth pages live
- Money hub with Banking + Reports visible
- No competitor brand hex codes in new components

---

## Out of Scope

- Database migrations
- HubSpot/Zoho/QuickBooks sync changes
- New OAuth integrations
- MCP tool changes
