# Production readiness remediation log

## Batch 1 — P0 data trust + accessibility + canonical IA

### Issue: Fabricated / misleading dashboard metrics
- **Severity:** Critical
- **Module:** Executive, Analytics, CRM Reports, Cash Flow, Business Performance, orphaned homes
- **Files changed:**
  - `src/domain/metrics/*` (new)
  - `src/components/dashboard/ExecutiveDashboard.tsx`
  - `src/components/dashboard/AnalyticsDashboard.tsx` → shim to AnalyticsTab
  - `src/components/dashboard/crm/CRMReportsTab.tsx`
  - `src/components/dashboard/accounting/CashFlowStatement.tsx`
  - `src/components/dashboard/business/BusinessPerformanceDashboard.tsx`
  - `src/components/dashboard/BusinessHomeDashboard.tsx` → AttentionFirst shim
  - `src/components/dashboard/business/EngagingDashboard.tsx` → AttentionFirst shim
  - `src/components/dashboard/HomeTab.tsx` → AttentionFirst shim
- **Root cause:** Hardcoded deltas/NPS/health scores; qualified treated as won; zero used for untracked cash-flow.
- **Implementation:** Domain metric helpers; unavailable states; orphaned homes re-export canonical AttentionFirst / AnalyticsTab.
- **Data impact:** None (display-only). No DB changes.
- **Tests added:** `tests/unit/metrics-and-canonical-routes.test.mjs`, `scripts/design-system-guard.mjs`

### Issue: Dual invoice manage UIs
- **Severity:** Critical
- **Module:** Finance
- **Route:** `/dashboard/finance/manage` (+ aliases)
- **Files changed:** `src/components/Dashboard.tsx`, `src/lib/dashboard/canonicalRoutes.ts`
- **Root cause:** Admin/client shell rendered `FinanceTab` while tenant_admin rendered `EnhancedBillingPage`.
- **Implementation:** Both shells render `EnhancedBillingPage` for invoice manage aliases.

### Issue: Accessibility landmarks / dialogs
- **Severity:** Critical
- **Files changed:**
  - `src/components/Dashboard.tsx`
  - `src/components/dashboard/business/BusinessDashboard.tsx`
  - `src/components/ui/UIComponents.tsx` (Modal + Input)
  - `src/components/dashboard/CommandPalette.tsx`
  - `src/app/globals.css` (import accessibility.css + expanded reduced-motion)
- **Implementation:** SkipToMainContent wired; unique `main#main-content`; Modal/CommandPalette dialog semantics + focus trap/Escape; Input `htmlFor`/`aria-invalid`/`aria-describedby`.

### Issue: Dead mobile Quick Actions
- **Severity:** High
- **Files changed:** `mobile/src/screens/DashboardScreen.tsx`
- **Implementation:** Navigate to Projects / CRM / Finance tabs; settings affordance replaces dead notifications bell.

### Issue: Sales hub 11-tab overflow
- **Severity:** High
- **Files changed:** `src/components/dashboard/hubs/SalesWorkspaceTabs.tsx`
- **Implementation:** 6 primary tabs + More menu for secondary tools.

### Issue: Breakpoint drift
- **Severity:** Medium
- **Files changed:** `src/constants/design.ts`
- **Implementation:** ENTERPRISE breakpoints aligned to Tailwind sm/md/lg/xl.

### Issue: Attention-First loading / currency
- **Severity:** Medium
- **Files changed:** `src/components/dashboard/AttentionFirstDashboard.tsx`, `src/components/dashboard/MetricCard.tsx`
- **Implementation:** Skeleton loading; `formatCurrency`; MetricCard unavailable/loading/error API.
