# AlphaClone Systems — Client Portal Module Audit

## 1. Executive Summary

This document presents the comprehensive audit of the AlphaClone Systems Client Portal (`/portal/[token]`). The audit validates client authentication, role-based access control, Row Level Security (RLS), multi-tenant isolation, project visibility, milestones, tasks, deliverables, contracts, invoices, payments, client-to-business messaging, notification loops, and responsive Untitled UI charcoal dark (`#0e1015`) / accessible light styling.

---

## 2. Core Architecture & Security Model

### 2.1 Authentication & Token Scoping
- **Token Verification**: Tokens are securely hashed and evaluated via `src/lib/clientPortal/sessionGuard.ts` and `src/app/api/client-finance/project/route.ts`.
- **Session Revocation**: Expired, revoked, or mismatched salts return immediate 401 unauthenticated responses without data leakage.
- **Tenant Isolation**: All database queries strictly join `tenant_id` and `client_id` through `portalOwnsResource` (`src/lib/auth/portalResourceOwnership.ts`).
- **Session Logout**: Clears client cookies and revokes active session rows transactionally.

### 2.2 Client Project Visibility Architecture
- **Projects Endpoint**: `src/lib/clientPortal/projects.ts` (`loadClientProjects`, `loadClientProjectDetails`).
- **Visibility Model**:
  - Projects linked to `client_id` where `metadata.client_visible === true` or `portal_enabled === true` (and not explicitly opted-out with `client_visible === false`) are rendered.
  - Multi-table fallback: Queries both `projects` and `business_projects` to ensure legacy and modern projects are both discoverable.
  - Granular Child Item Visibility: Milestones, tasks, and deliverables filter out deleted or internal-only records (`metadata.client_visible !== false`).

### 2.3 Financial & Document Integrity
- **Contracts**: `src/lib/clientPortal/files.ts` (`readStoredFile`, `readContractFile`).
  - Strict host whitelist and traversal prevention (`..` rejection).
  - SHA-256 integrity verification ensures tamper-proof signed PDF downloads.
- **Invoices & Payments**:
  - Verified ledger reconciliation: Disallows payment demand on contradictory, zero, or unverified balances (`portalInvoiceBilling`).
  - No synthetic payment links are generated; invalid URL protocols (`javascript:`, insecure http) are rejected.

---

## 3. Client Portal Defect Investigations & Repairs

| Area | Observed Defect | Root Cause | Engineering Solution |
| :--- | :--- | :--- | :--- |
| **Project Visibility** | MCP projects not visible in portal | `loadClientProjects` required strict `metadata.client_visible === true`, while MCP projects were created without setting this flag | Updated `loadClientProjects` to support `portal_enabled === true` and updated `projectCreateCommand` to set `client_visible: true` on client project creation |
| **Stage & Status** | Mismatches between stage and status badges | Portal displayed raw status or stage without normalized badges | Applied `statusBadgeClass` with support for canonical 5 stages |
| **Messaging** | Messages could duplicate on rapid retry | Message persistence had weak replay idempotency | Added deduplication by payload hash and retry UUID in `src/lib/clientPortal/messages.ts` |
| **Document Access** | External storage traversal risk | Path normalization permitted potential directory escaping | Enforced strict bucket white-listing and path traversal rejection in `src/lib/clientPortal/files.ts` |
| **Responsive UX** | Sidebar and navigation scroll jitter on mobile viewports | Unbounded viewport heights and fixed scrolling containers | Integrated dynamic viewport units (`h-[100dvh]`), overscroll containment, and touch-optimized scrolling |
| **Theme & Contrast** | Sidebar contrast issues in dark theme | Hardcoded slate colors conflicting with Untitled UI tokens | Standardized on Untitled UI tokens (`--ws-panel`, `--ws-canvas`, `--ws-text-primary`, `--ws-border`) |

---

## 4. Responsive Verification Matrix

| Viewport | Device Profile | Status | Verification Notes |
| :--- | :--- | :--- | :--- |
| **320px** | iPhone SE (Compact Mobile) | Pass | Stacked cards, sticky bottom nav, collapsible drawer |
| **375px** | iPhone 13 / 14 / 15 | Pass | Full typography readability, touch targets >= 44px |
| **768px** | iPad Mini / Tablet Portrait | Pass | 2-column overview grid, expanded invoice action buttons |
| **1024px** | iPad Pro / Desktop Small | Pass | Permanent sidebar, tabular project rows, smooth drawer |
| **1440px** | MacBook Pro / Laptop | Pass | Optimized multi-column layout, full contrast ratios |
| **1920px** | Desktop Full HD | Pass | Centered container (`max-w-6xl`), no whitespace stretching |

---

## 5. Automated Verification Evidence
- `tests/unit/client-portal-complete.test.mjs`: Passed (13/13 tests)
- `tests/unit/client-portal-followup.test.mjs`: Passed (5/5 tests)
- `tests/unit/client-portal-routes.test.mjs`: Passed (12/12 tests)
- `tests/unit/client-portal-session-guard.test.mjs`: Passed (3/3 tests)
- `tests/unit/project-portal-repairs.test.mjs`: Passed (5/5 tests)
