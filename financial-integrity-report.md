# Financial integrity report

Generated from source audit on 2026-09-14. No live data scan was performed, so record counts are intentionally not fabricated.

## Inconsistencies detected in architecture

| Risk | Impact | Resolution |
| --- | --- | --- |
| Post-foundation legacy payments not represented by canonical allocations | Canonical AR/payment status can lag invoice UI | Additive backfill plus transactional after-insert projection |
| Payment marks delivery as delivered | Incorrect delivery evidence and collections reporting | Before-update guard preserves actual delivery state |
| Legacy state fields can conflict with canonical evidence | Contradictory status labels | Canonical financial-status view derives payment, collection, and display state |

## Safe reconciliation procedure

Run `scripts/finance-migration-reconciliation.sql` in a staging or controlled production session. It reports tenant and record-level payment evidence gaps and line-total discrepancies without mutation. Review and retain output with the matching `finance_migration_batches` record. Do not enable `canonical_read` until the batch is verified.

## Invariants introduced

- A legacy payment inserted after this migration has a tenant-scoped canonical payment and allocation in the same transaction.
- Duplicate legacy payment delivery remains protected by the existing tenant/idempotency uniqueness and the canonical idempotency key derived from the immutable legacy payment ID.
- A payment cannot manufacture an invoice delivery state.
- Display and collection state are derived from canonical balance, payment evidence, due date, and active collection work—not from a raw legacy enum.

## Unresolved risks

- Existing mismatches require a real database scan; this repository alone cannot identify affected records.
- Older direct invoice mutation paths should be migrated to one canonical writer before feature-flag cutover.
- Bank-provider connectivity and reconciliation approvals remain a later phase.
