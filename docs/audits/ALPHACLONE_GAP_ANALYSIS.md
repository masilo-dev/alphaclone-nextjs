# AlphaClone Systems: Architectural Gap Analysis & Security Review

**Date:** 2026-10-04  
**Audit Type:** Codebase, Database & Infrastructure Gap Analysis  
**Reference Evidence:** Production Schema (653 tables), Baseline Row Counts, Migrations, Application Services, and 1,152 Passing Unit Tests.

---

## 1. Prioritized Gap Matrix

| Domain | Finding & Severity | Evidence / Code Path | Risk & Impact | Recommended Remediation |
| :--- | :--- | :--- | :--- | :--- |
| **Database Security** | **Materialized View Direct Read (`general_ledger`)**<br>`SEV-1 (High)` | `src/services/accounting/generalLedgerService.ts` lines 93, 136 query `.from('general_ledger')` directly. | In PostgreSQL, materialized views do not support RLS. Direct SELECT access exposes entries across tenants unless filtered via the secure RPC. | Update `generalLedgerService.ts` to call `get_general_ledger_entries(tenant_id, ...)`. Revoke `SELECT` on `public.general_ledger` from `authenticated`. |
| **Commercial Lifecycle** | **Quotes & Contracts Missing Direct Foreign Keys**<br>`SEV-2 (Medium)` | `quotes` schema lacks direct `deal_id` DB foreign key; `contracts` lacks direct `quote_id` column. | Conversion requires metadata parsing (`converted_invoice_id`, `converted_from_quote_id`), creating relational fragility. | Apply additive migration adding nullable `deal_id` on `quotes` and `quote_id` on `contracts`. |
| **Execution Gateway** | **Ad-Hoc UI Actions Bypassing Action Receipts**<br>`SEV-2 (Medium)` | `src/lib/mcp/executionGateway.ts` is called by MCP tools (194 receipts), but some manual UI quick-sends write directly to tables without creating an `mcp_action_receipts` row. | Audit trails are split between `audit_logs` and `mcp_action_receipts`. Inability to verify execution state from a single ledger. | Route all high-impact UI writes through the shared execution ledger wrapper. |
| **Activity Timeline** | **Timeline Fragmentation Across 6 Tables**<br>`SEV-2 (Medium)` | Events split across `activity_logs` (47k), `audit_logs` (2.8k), `lead_activities`, `deal_activities`, `domain_events`. | Client 360 view previously omitted cross-module touches (deals, contracts, invoices). | `src/lib/audit/entityTimelineService.ts` enhanced to union deals, contracts, invoices, and projects concurrently. |
| **Finance & Invoicing** | **Paid Invoices Omitted from Client Portal View**<br>`SEV-3 (Low)` | `src/services/finance/clientFinancePortalService.ts` filtered status to `['sent', 'viewed', 'partially_paid', 'overdue']`. | Paid invoices disappeared from portal client view; customers could not download receipts or historical invoices. | Status query updated to include `paid` and `completed` while retaining open balance isolation. |
| **Social Publishing** | **Destination Verification & Organization Mismatches**<br>`SEV-2 (Medium)` | `src/lib/social/linkedinPublisher.ts` requires strict personal URN vs organization URN separation. | Accidental posting to an employer or personal page when an organization was intended, or silent fallback. | Enforce fail-closed validation: personal requests with organization destinations immediately throw `TARGET_AMBIGUOUS` with remediation hints. |

---

## 2. In-Depth Component Analysis

### 2.1. Database Security & Tenant Isolation (Section 4 Verification)
- **`document_themes` & `document_templates`**: RLS enabled via `20260911061917_enable_rls_on_autonomous_and_document_tables.sql`. Anon access revoked. Authenticated users restricted to their `tenant_id` or public system defaults (`tenant_id IS NULL`).
- **`durable_jobs` & `worker_heartbeats`**: Anon and authenticated access fully revoked. Service-role only.
- **`domain_events` & `activity_feed`**: RLS enabled with tenant isolation policies.
- **`is_super_admin()` & Trigger Functions**: Pinned `search_path = pg_catalog, public, auth` via `20260911061816_harden_super_admin_function_privileges.sql`.
- **`general_ledger`**: The secure RPC `get_general_ledger_entries` exists. The client service `generalLedgerService.ts` must be transitioned to call this RPC to allow complete removal of direct SELECT privileges.

### 2.2. Email Architecture & Quotas (Section 8 Verification)
- Outbound emails route through `sendEmailServer.ts`.
- Quotas are decremented only upon provider acceptance (`provider_accepted`).
- Bounces and suppressions are checked prior to dispatch via `isEmailSuppressed()`.

### 2.3. Social Publishing Pipeline (Section 7 Verification)
- Strict destination resolver ensures:
  1. Personal LinkedIn requests reject organization URNs.
  2. Organization requests verify administrator privileges via OAuth scopes.
  3. Image/video media hashes are validated against stored SHA checksums.
  4. Zero placeholder fallback images.

### 2.4. Open-Source Component Readiness (Sections 11–14)
- **Paperless-ngx:** Suitable for document ingestion and OCR. Architecture requires an isolated HTTP adapter storing internal documents with private tokenized storage callbacks.
- **Documenso:** Production-ready open-source electronic signature platform. Requires private deployment, webhook authentication secret verification, and contract mapping adapter.
- **Mautic:** Marketing sequence automation. Requires strict tenant identity mapping and suppression list synchronization.
- **Chatwoot:** Customer messaging and live chat. Requires mapping Chatwoot conversation IDs to AlphaClone `contacts` and `unified_messages`.
