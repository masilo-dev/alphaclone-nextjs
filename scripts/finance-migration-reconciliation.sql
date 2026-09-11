-- Run after 20260726220000_canonical_finance_foundation.sql.
-- Read-only reconciliation: any returned row needs review before enabling
-- canonical_write or canonical_read for that tenant.

WITH legacy AS (
  SELECT
    tenant_id,
    count(*) AS invoice_count,
    COALESCE(sum(total), 0)::numeric(20,4) AS invoice_total,
    COALESCE(sum(amount_paid), 0)::numeric(20,4) AS stored_paid
  FROM public.business_invoices
  GROUP BY tenant_id
),
canonical AS (
  SELECT
    tenant_id,
    count(*) AS invoice_count,
    COALESCE(sum(total_amount), 0)::numeric(20,4) AS invoice_total,
    COALESCE(sum(allocated_amount), 0)::numeric(20,4) AS allocated_total
  FROM public.canonical_invoice_balances
  GROUP BY tenant_id
)
SELECT
  l.tenant_id,
  l.invoice_count AS legacy_invoice_count,
  c.invoice_count AS canonical_invoice_count,
  l.invoice_total AS legacy_invoice_total,
  c.invoice_total AS canonical_invoice_total,
  l.stored_paid AS legacy_stored_paid,
  c.allocated_total AS evidenced_allocations,
  (l.stored_paid - c.allocated_total)::numeric(20,4) AS payment_evidence_gap
FROM legacy l
FULL OUTER JOIN canonical c USING (tenant_id)
WHERE l.invoice_count IS DISTINCT FROM c.invoice_count
   OR l.invoice_total IS DISTINCT FROM c.invoice_total
   OR l.stored_paid IS DISTINCT FROM c.allocated_total
ORDER BY COALESCE(l.tenant_id, c.tenant_id);

-- Record-level contradictions.
SELECT
  i.tenant_id,
  i.id AS invoice_id,
  i.invoice_number,
  i.status AS legacy_status,
  i.delivery_status AS legacy_delivery_status,
  i.paid_at,
  i.amount_paid AS legacy_amount_paid,
  b.allocated_amount,
  b.balance_due,
  b.payment_status,
  i.migration_verification_state
FROM public.business_invoices i
JOIN public.canonical_invoice_balances b
  ON b.tenant_id = i.tenant_id AND b.invoice_id = i.id
WHERE (i.status = 'paid' AND i.paid_at IS NULL)
   OR (i.status IN ('paid','partially_paid') AND i.amount_paid <> b.allocated_amount)
   OR (i.status = 'paid' AND b.payment_status <> 'paid')
   OR i.migration_verification_state IN ('legacy_evidence','review_required')
ORDER BY i.tenant_id, i.created_at;

-- Line-item total discrepancies. This does not select an authoritative value.
SELECT
  i.tenant_id,
  i.id AS invoice_id,
  i.invoice_number,
  i.subtotal AS stored_subtotal,
  COALESCE(sum(COALESCE(li.net_amount, li.line_total, li.quantity * li.unit_price)), 0)::numeric(20,4)
    AS calculated_line_subtotal,
  i.total AS stored_total
FROM public.business_invoices i
LEFT JOIN public.invoice_line_items li
  ON li.tenant_id = i.tenant_id AND li.invoice_id = i.id
GROUP BY i.tenant_id, i.id, i.invoice_number, i.subtotal, i.total
HAVING i.subtotal IS DISTINCT FROM
  COALESCE(sum(COALESCE(li.net_amount, li.line_total, li.quantity * li.unit_price)), 0)::numeric(20,4)
ORDER BY i.tenant_id, i.created_at;
