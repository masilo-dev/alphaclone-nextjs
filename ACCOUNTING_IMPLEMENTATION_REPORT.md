# Accounting implementation report

## Implemented in this change

- Added canonical collection-state derivation to `src/lib/finance/canonicalDomain.ts` and focused unit coverage.
- Added migration `20260914110000_canonical_payment_projection_and_collection_state.sql`.
  - Backfills legacy payments missing from canonical evidence.
  - Projects every future legacy payment into `finance_payments` and immutable `payment_allocations` in the same transaction.
  - Preserves actual delivery state when a payment is recorded.
  - Adds tenant-RLS-respecting `canonical_invoice_financial_status` with plain-language display and collection state.
- Added audit and integrity reports required for safe rollout.

## Security and data handling

All projection keys and lookups are tenant scoped. The projection reuses the existing immutable allocation trigger and payment idempotency constraints. It preserves legacy payment rows, snapshots, and timestamps; it does not expose credentials or bank data.

## Tests and verification

The finance unit suite covers money calculation, canonical payment state, collection state, allocation-lock migration properties, and the new dual-write migration contract. Database integration, lint, typecheck, and build results must be reported from the actual local environment; they are not claimed here until run.

## Remaining work

The existing accounting/invoicing UI should consume the new view behind canonical feature flags after tenant reconciliation. Banking provider adapters, approval-gated reconciliation UX, full customer financial timeline, and end-to-end cross-tenant test fixtures are intentionally not fabricated in this P0 integrity patch.
