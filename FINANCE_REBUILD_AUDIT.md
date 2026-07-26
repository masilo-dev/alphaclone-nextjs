# Alphaclone finance rebuild: architecture audit and controlled cutover

Date: 2026-07-26

## Executive finding

The repository already contains useful invoice, payment, credit-note, receipt,
expense, journal, chart-of-accounts, period-close, and reporting code. It is not
one financial domain, however. `business_invoices` is the dashboard billing
model while `invoices` remains a legacy Stripe/client-billing model. Several
services calculate money in JavaScript numbers, invoice `status` combines
lifecycle and payment state, and manual payment recording changes delivery
state.

This change begins a controlled rebuild. It does not claim a production cutover
or mutate the live database.

## Current contradictions found in code

| Area | Finding | Risk | Disposition |
| --- | --- | --- | --- |
| Invoice identity | Both `business_invoices` and `invoices` are active | Counts and reports disagree | Migrate behind adapter/flag |
| Money | API and `businessInvoiceService` use JS multiplication and rounding | Precision drift | Replace with scaled-decimal domain |
| Status | `business_invoices.status` includes sent, overdue, paid, disputed | Contradictory state | Separate lifecycle, delivery, derived payment, due |
| Payment | `amount_paid`, `paid_at`, and `status` are stored on invoice | State can lack evidence | Derive from allocations |
| Accounting | Manual-payment RPC debits cash and credits revenue | AR is not cleared; revenue timing is wrong | Replace during canonical-write phase |
| Delivery | Full payment forces `delivery_status = DELIVERED` | Payment invents delivery evidence | Remove coupling during canonical-write phase |
| Line items | JSON and relational rows coexist; `rate`, `unit_price`, `amount`, `line_total` coexist | Totals disagree | Canonical columns plus preserved legacy snapshot |
| Public access | Legacy invoice exposure includes generic/public mechanisms | Token governance is incomplete | Dedicated hashed share records |
| Recurring | Multiple recurring paths and metadata-based configuration exist | Duplicate occurrence risk | First-class profile and idempotent occurrence |
| Tests | Existing finance integrity test contains a literal `expect(true)` placeholder | No accounting evidence | Add domain tests and DB reconciliation queries |

## Keep / improve / migrate / replace / remove

- Keep: dashboard shell, tenant membership, CRM clients, projects, products,
  Documents, audit logging, automation events, Stripe adapters, invoice PDFs,
  chart of accounts, journals, accounting periods, credit notes, receipts.
- Improve: tenant permissions, invoice numbering, immutable version snapshots,
  journal posting constraints, provider webhook evidence, report provenance.
- Migrate: business invoices, relational and JSON line items, invoice payments,
  recurring metadata, public links, customer snapshots.
- Replace: authoritative invoice payment status, direct `amount_paid` mutation,
  floating-point server totals, cash-to-revenue payment journals.
- Remove later: legacy service paths and duplicate fields only after verified
  dual-read comparisons. No historical table or record is removed in this phase.

## Implemented canonical foundation

- `src/lib/finance/canonicalDomain.ts`: decimal-safe calculation, payment-status
  derivation, and journal-balance validation.
- `20260726220000_canonical_finance_foundation.sql`: additive invoice dimensions,
  versions, status events, canonical payments, allocations, adjustments, secure
  public shares, recurring profiles/occurrences, RLS, indexes, feature flags,
  legacy snapshots, and compatibility balance view.
- `finance-migration-reconciliation.sql`: tenant totals, payment-evidence gaps,
  contradictory states, and line-item discrepancies.
- Allocation validation locks both the payment and invoice in a stable order,
  preventing concurrent over-allocation. Allocation evidence is immutable;
  corrections require reversal and replacement records.
- Rollback removes only the unused canonical projection and intentionally keeps
  evidence-bearing additive columns.

## Cutover and deployment

1. Take and verify a database backup.
2. Apply the migration in staging.
3. Run `scripts/finance-migration-reconciliation.sql`.
4. Categorise every returned discrepancy; do not invent missing `paid_at`.
5. Record a verified migration batch and checksum.
6. Enable `canonical_dual_read` for an internal tenant.
7. Compare counts, totals, balances, status, PDFs, reminders, and reports.
8. Replace payment posting with Cash debit / Accounts Receivable credit, while
   invoice issuance posts Accounts Receivable debit / Revenue and Tax credit.
9. Enable canonical writes, repeat reconciliation, then enable canonical reads.
10. Monitor balance gaps, duplicate numbers, webhook idempotency, jobs, RLS
    denials, and report differences before expanding tenant rollout.

Rollback disables flags first, restores legacy reads/writes, runs the down
migration only if no canonical-only records were created, and retains all
historical source records and legacy snapshots.

## Known limitations / work still required

This foundation is not the complete 73-deliverable production rebuild. The UI
route expansion, quotes and credit-note workflows, supplier/AP domain, banking,
tax engine, period controls, reporting, Documents integration, automation
catalogue, Bonnie tools, provider webhooks, background jobs, full permissions,
mobile/accessibility work, and end-to-end security tests still require phased
implementation. Existing production invoice/payment counts and reconciliation
results cannot truthfully be reported until the migration is run against an
authorised database environment.
