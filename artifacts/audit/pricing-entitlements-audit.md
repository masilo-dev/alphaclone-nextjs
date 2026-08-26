# AlphaClone Unified Pricing & Entitlements Audit

**Date:** 2026-08-26  
**Scope:** Normalize Free=50/day · Pro=300/day · Premium=Unlimited across all modules

---

## 1. Files Changed

| File | Change |
|------|--------|
| `src/lib/entitlements/planEntitlements.ts` | Authoritative resolver: Free=50, Pro=300, Premium=`null`/`-1` |
| `src/lib/entitlements/actionCategoryLabels.ts` | Shared UI labels for usage dashboard |
| `src/services/quotaService.ts` | Delegates to planEntitlements; Premium returns `unlimited: true` |
| `src/lib/mcp/toolQuotaPolicy.ts` | MCP read tools exempt; write tools map to resource categories |
| `src/config/pricingPlans.ts` | 3-tier public plans (Free / Pro / Premium) |
| `src/services/tenancy/types.ts` | PLAN_PRICING feature lists aligned |
| `src/components/dashboard/PlanAndUsageView.tsx` | Premium shows "Unlimited", no % meters |
| `src/components/marketing/system/PricingPage.tsx` | 3-column comparison, 50/300/Unlimited |
| `src/components/marketing/system/AllInOnePlatformShowcase.tsx` | Seamless non-clickable hero image |
| `src/services/leadService.ts` | Removed duplicate lead counting; uses quotaService |
| `src/services/quotaEnforcementService.ts` | Unlimited = `limit < 0`, not 999999 |
| `src/components/UsageDashboard.tsx` | Premium analytics-only display |
| `supabase/migrations/20260826140000_unified_plan_entitlements.sql` | RPC: 50/300/-1 |
| `tests/unit/plan-entitlements.test.mjs` | 7 entitlement tests |
| `tests/unit/email-gateway-and-quota.test.mjs` | MCP read/send quota policy (existing) |

---

## 2. Old Limits Found & Status

| Location | Old Value | Status |
|----------|-----------|--------|
| `PricingPage.tsx` comparison | 25/150/750 email, 1500 MCP | **Replaced** with 50/300/Unlimited |
| `types.ts` PLAN_PRICING | 750 email, 1500 MCP, 500 leads | **Replaced** |
| `pricingPlans.ts` | 4-tier starter/enterprise scattered limits | **Replaced** with 3-tier |
| `leadService.checkLeadLimit` | Free-only 50 via leads table count; Pro `remaining: 999` | **Replaced** with quotaService |
| `quotaEnforcementService` | `999999` = unlimited | **Replaced** with `limit < 0` |
| `UsageDashboard.tsx` | `999999 ? 'Unlimited'` | **Replaced** |
| `20260824000000_alphaclone_pricing_and_quotas.sql` | Per-resource 750/1500 CASE | **Superseded** by 20260826140000 |
| `20260826120000_email_quota_metrics_and_audit.sql` | Per-resource CASE limits | **Superseded** by 20260826140000 |
| `ALL_MIGRATIONS_COMBINED.sql` | 999999 enterprise | Historical artifact only |
| Production RPC (Aug 25) | email_actions=750, mcp_executions=1500 | **Migrated** via apply_migration |

**Retained (not subscription quotas):** timeouts (1500ms), z-index 9999, invoice amounts, commercial product prices, scraper campaign `daily_limit`, provider rate limits.

---

## 3. Duplicated Quota Logic Removed

- `leadService.checkLeadLimit` — removed independent 24h leads table count for free-only; now uses `quota_usage.leads` via `quotaService.getTenantUsageSummary`
- `PricingPage` / `types.ts` / `pricingPlans.ts` — removed per-category mismatched limits (25 email free, 750 pro, etc.)
- `quotaEnforcementService` — removed `999999` fake unlimited sentinel in favor of `-1`
- MCP email reads — no longer fall through to `email_actions` bucket (prior production incident)

---

## 4. Centralized Entitlement Implementation

**Module:** `src/lib/entitlements/planEntitlements.ts`

```
FREE    → 50/day per QuotaResourceType
PRO     → 300/day (includes legacy starter)
PREMIUM → unlimited (null in TS, -1 in RPC/DB)
```

**Consumers:**
- `quotaService.consumeQuotaAtomically` → RPC `consume_daily_resource_quota`
- `quotaService.getTenantUsageSummary` → dashboard UI
- `toolQuotaPolicy.ts` → MCP pre/post charge decisions
- `evaluateEntitlement()` → error messages & upgrade prompts
- `formatUsageDisplay()` → consistent "32 / 50" vs "Unlimited"

---

## 5. Modules Audited

| Module | Quota Path | Status |
|--------|------------|--------|
| Email send (gateway) | `emails_sent` via gateway | ✅ Centralized |
| Outreach / campaigns | `outreach_actions`, `emails_sent` | ✅ Centralized |
| MCP tool registry | `toolQuotaPolicy` + RPC | ✅ Centralized |
| Lead creation | `leads` via RPC | ✅ Centralized |
| CRM mutations (MCP) | `leads` / `mcp_executions` | ✅ Via toolQuotaPolicy |
| Social publish | `linkedin_posts`, etc. | ✅ RPC categories |
| Documents/contracts/invoices | `contracts`, `invoices`, `receipts` | ✅ RPC categories |
| Dashboard usage UI | `PlanAndUsageView` | ✅ Premium Unlimited |
| Marketing pricing | `PricingPage`, `pricingPlans` | ✅ 50/300/Unlimited |
| Lead finder UI | `leadService.checkLeadLimit` | ✅ Fixed |
| Legacy usage dashboard | `UsageDashboard` | ✅ Unlimited display |
| Monthly infra limits | `planLimits.ts` (users/storage) | Separate from daily actions — unchanged |

---

## 6. MCP Action Categories Audited

| Category | Resource Key | Read Exempt | Write Charged |
|----------|--------------|-------------|---------------|
| Email read/sync | — | ✅ | — |
| Email send | `emails_sent` | — | On success |
| Lead create/import | `leads` | — | ✅ |
| CRM update | `leads` / `mcp_executions` | Reads exempt | ✅ |
| Outreach send | `outreach_actions` | — | ✅ |
| Social publish | `linkedin_posts` etc. | — | ✅ |
| Contract/proposal | `contracts` | — | ✅ |
| Invoice/quote | `invoices` | — | ✅ |
| Automation/agent | `mcp_executions` | Health/read exempt | ✅ |
| Internal LLM/planning | — | ✅ Never charged | — |

---

## 7. Tests — Free (50/day)

- `plan-entitlements.test.mjs`: `getDailyLimitForPlan('free') === 50`
- `evaluateEntitlement`: blocks at usage=50
- `formatUsageDisplay`: `32 / 50 today`
- All 13 metered resources resolve to 50 for free plan

---

## 8. Tests — Pro (300/day)

- `normalizePlanId('starter') === 'pro'` → 300
- `evaluateEntitlement`: allows at 299, blocks at 300
- `formatUsageDisplay`: `184 / 300 today`
- RPC migration: `starter` and `pro` both → 300

---

## 9. Tests — Premium (Unlimited)

- `getDailyLimitForPlan('enterprise') === null`
- `getDailyLimitRpc('premium') === -1` (never 9999/1000)
- `evaluateEntitlement`: allowed=true at usage=18493
- `formatUsageDisplay`: returns `Unlimited` (never `812 / 1000`)
- `isUnlimitedPlan('enterprise'|'custom') === true`
- Production RPC applied: Premium tenants get `v_limit := -1`

---

## 10. Premium Confirmation

**No AlphaClone subscription usage ceiling for Premium/Enterprise/Custom tenants.**

- DB RPC returns `limit: -1`, `unlimited: true`, `allowed: true` regardless of usage volume
- Usage still recorded in `quota_usage` for analytics/abuse monitoring
- UI shows **Unlimited** badge and analytics-only counts — no progress bars or `%` for unlimited metrics
- Provider limits distinguished via `formatProviderLimitMessage()` — never labeled "Premium quota exceeded"
- Marketing showcase images: borderless, non-clickable, seamless fade (no boxed chrome)

**Test run:** 14/14 pass (`plan-entitlements.test.mjs` + `email-gateway-and-quota.test.mjs`)

**Production migration:** `unified_plan_entitlements` applied to project `ehekzoioqvtweugemktn` ✅
