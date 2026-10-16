# AlphaClone Systems — Implementation Backlog & Rollout Safety Plan

**Phase**: Post-Repair Production Readiness  
**Target Release**: Q4 2026

---

## 1. Prioritized Work Items

| ID | Domain | Work Item | Priority | Dependencies | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **BOS-01** | Core Invoicing | Repair invoice lifecycle status contracts & PDF fallback | P0 | None | `COMPLETED` |
| **BOS-02** | Client Portal | Restore outbound client reply email notifications | P0 | None | `COMPLETED` |
| **BOS-03** | Email Transport | Fix Zoho Mail HTTP 415 binary upload fallback MIME type | P0 | None | `COMPLETED` |
| **BOS-04** | Outreach | Auto-link positive replies to deals in lifecycle graph | P0 | None | `COMPLETED` |
| **BOS-05** | Legal E-Sign | Fix canonical party signing progression & lifecycle status | P0 | None | `COMPLETED` |
| **BOS-06** | Projects | Restore client milestone notification emails | P0 | None | `COMPLETED` |
| **BOS-07** | Dashboard UX | Restore zero-loading session cache & tab focus sync | P0 | None | `COMPLETED` |
| **BOS-08** | Contract Flow | Ensure idempotent default project task creation | P1 | None | `COMPLETED` |
| **BOS-09** | Mail Layout | Maintain bounded viewport internal scrolling contract | P1 | None | `COMPLETED` |
| **BOS-10** | Database | Execute additive migrations on production Supabase | P0 | BOS-01..09 | `AWAITING_APPROVAL` |
| **BOS-11** | DevOps | Merge `feat/a-z-autonomous-engineering-repair` & deploy | P0 | BOS-10 | `AWAITING_APPROVAL` |

---

## 2. Safety Gates for Production Rollout

Before promoting these repairs to production (`main` branch / Railway / live Supabase), the following validation gates must be observed:

1. **Gate 1: Branch Isolation**:
   - All code edits reside strictly on branch `feat/a-z-autonomous-engineering-repair`.
   - No untracked files or unstaged hotfixes exist outside the auditable Git tree.

2. **Gate 2: Zero Regression Guard**:
   - `npm run validate:prod-guards` passes (charcoal density, design system guard, no raw hex).
   - Targeted unit test suites for all modified modules pass 100% with 0 failures.

3. **Gate 3: Explicit Human Authorization**:
   - Do NOT run database migrations or apply DDL scripts to the live Supabase instance without explicit user confirmation.
   - Do NOT trigger automated Railway production webhooks or git push to remote `main` without explicit user sign-off.
