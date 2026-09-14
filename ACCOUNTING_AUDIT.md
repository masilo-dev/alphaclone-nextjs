# Accounting audit

Audit date: 2026-09-14. Scope: accounting, invoicing, payment, reconciliation, and deal-to-cash code currently in this repository. This was a source audit; no production database was queried or changed.

## Current architecture

- `business_invoices` and `business_invoice_payments` remain the operational write model. Invoice APIs authenticate tenant membership with `requireTenantAccess` and scope most record lookups by `tenant_id`.
- The additive canonical foundation in `20260726220000_canonical_finance_foundation.sql` introduces independent lifecycle, delivery, payments, adjustments, immutable allocations, status events, recurring profiles, tenant RLS, and `canonical_invoice_balances`.
- Invoice issue posts AR/revenue journals; payment posts cash/AR journals. The accounting dashboard obtains a parallel operational and ledger snapshot.
- The UI already contains an accounting home, invoice workspace/timeline, recurring invoices, bank centre, reminders, lifecycle drawer, payment recording, and linked deal revenue timeline.

## Material findings and risks

1. **P0 fixed locally:** `record_business_invoice_payment` writes `business_invoice_payments`, but canonical allocations were initially backfilled only once. Payments created afterwards could therefore make the legacy invoice appear paid while `canonical_invoice_balances` still showed unpaid.
2. **P0 fixed locally:** the legacy payment RPC changes `delivery_status` to `DELIVERED` when paid. Payment confirmation is not proof that an invoice was delivered.
3. Legacy `status`, `amount_paid`, and `delivery_status` still exist for compatibility. They must not be used as the sole reporting truth once a tenant enables canonical read.
4. The invoice creation route currently creates legacy-compatible records directly. It needs a subsequent cutover to the canonical invoice writer after tenant-by-tenant dual-read reconciliation.
5. Several older UI paths show legacy status text. The new canonical status view supplies plain-language display values; callers should move to it gradually, keeping internal enum data inside audit views.

## Tenant isolation review

The audited invoice payment, reconciliation, invoice creation, workspace, and void routes resolve access through tenant membership and scope the primary invoice lookup. The new database projection carries the tenant from the inserted legacy payment, validates the invoice tenant, and relies on existing allocation locks/RLS.

Remaining review work: run the supplied cross-tenant tests against a non-production Supabase environment, then audit every historical client-side direct Supabase query before enabling canonical reads for a tenant.

## Migration strategy

`20260914110000_canonical_payment_projection_and_collection_state.sql` is additive and repeatable. It backfills missed legacy payment evidence, creates an after-insert dual-write projection, preserves source records, blocks the erroneous delivery-state side effect, and adds `canonical_invoice_financial_status` for display/collection state. It does not delete or overwrite historical evidence.

Before setting a tenant's canonical feature flags, run `scripts/finance-migration-reconciliation.sql`, investigate every returned row, record the result in `finance_migration_batches`, and retain legacy snapshots for review.

## Recommended next work

1. Switch invoice list/detail reads to `canonical_invoice_financial_status` behind the existing feature flags.
2. Replace legacy invoice creation/update mutations with a canonical transactional RPC.
3. Add a provider-neutral bank transaction/reconciliation write model and approval-gated matching UI.
4. Add database-backed cross-tenant and duplicate-webhook integration tests using isolated fixtures.
