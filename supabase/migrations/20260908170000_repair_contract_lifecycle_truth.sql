-- Repair legacy contract rows whose display status and lifecycle status disagree.
-- A signed contract must never remain in a draft lifecycle state, because that
-- makes Home, finance, contract automation, and MCP return conflicting truth.
BEGIN;

UPDATE public.contracts
SET
  lifecycle_status = CASE
    WHEN COALESCE(status, '') IN ('fully_signed', 'signed') THEN 'signed'
    WHEN COALESCE(status, '') = 'client_signed' THEN 'sent'
    WHEN COALESCE(status, '') IN ('sent', 'viewed', 'negotiating') THEN status
    ELSE lifecycle_status
  END,
  signed_at = COALESCE(signed_at, client_signed_at, admin_signed_at),
  updated_at = NOW()
WHERE COALESCE(lifecycle_status, 'draft') = 'draft'
  AND COALESCE(status, '') IN ('fully_signed', 'signed', 'client_signed', 'sent', 'viewed', 'negotiating');

-- Signed records should have a lifecycle event even if the historic signing
-- path did not write one. The event is idempotent for this repair source.
INSERT INTO public.contract_lifecycle_events (
  tenant_id,
  contract_id,
  from_status,
  to_status,
  reason,
  source,
  evidence
)
SELECT
  c.tenant_id,
  c.id,
  'draft',
  c.lifecycle_status,
  'Backfilled lifecycle to match existing contract signing state',
  'migration',
  jsonb_build_object('status', c.status, 'signed_at', c.signed_at)
FROM public.contracts c
WHERE c.lifecycle_status IN ('sent', 'signed')
  AND COALESCE(c.status, '') IN ('fully_signed', 'signed', 'client_signed', 'sent', 'viewed', 'negotiating')
  AND NOT EXISTS (
    SELECT 1
    FROM public.contract_lifecycle_events e
    WHERE e.contract_id = c.id
      AND e.source = 'migration'
      AND e.reason = 'Backfilled lifecycle to match existing contract signing state'
  );

COMMIT;
