-- Production reliability repair: use recipient rows as the durable campaign
-- truth, preserve (rather than invent) marketing consent, and make an
-- existing active social identity selectable when no default was recorded.
-- Every update is idempotent and deliberately avoids sending communication.
BEGIN;

-- Campaign counters can drift when an earlier fan-out fails before its final
-- roll-up. Recompute them from campaign_recipients, the durable delivery log.
UPDATE public.email_campaigns c
SET
  total_recipients = counts.total_recipients,
  total_sent = counts.total_sent,
  total_delivered = counts.total_delivered,
  total_opened = counts.total_opened,
  total_clicked = counts.total_clicked,
  total_bounced = counts.total_bounced,
  total_unsubscribed = counts.total_unsubscribed,
  total_failed = counts.total_failed,
  updated_at = NOW()
FROM (
  SELECT
    campaign_id,
    COUNT(*)::integer AS total_recipients,
    COUNT(*) FILTER (WHERE status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'unsubscribed'))::integer AS total_sent,
    COUNT(*) FILTER (WHERE status IN ('delivered', 'opened', 'clicked'))::integer AS total_delivered,
    COUNT(*) FILTER (WHERE status = 'opened')::integer AS total_opened,
    COUNT(*) FILTER (WHERE status = 'clicked')::integer AS total_clicked,
    COUNT(*) FILTER (WHERE status = 'bounced')::integer AS total_bounced,
    COUNT(*) FILTER (WHERE status = 'unsubscribed')::integer AS total_unsubscribed,
    COUNT(*) FILTER (WHERE status = 'failed')::integer AS total_failed
  FROM public.campaign_recipients
  GROUP BY campaign_id
) counts
WHERE c.id = counts.campaign_id
  AND (
    c.total_recipients IS DISTINCT FROM counts.total_recipients OR
    c.total_sent IS DISTINCT FROM counts.total_sent OR
    c.total_delivered IS DISTINCT FROM counts.total_delivered OR
    c.total_opened IS DISTINCT FROM counts.total_opened OR
    c.total_clicked IS DISTINCT FROM counts.total_clicked OR
    c.total_bounced IS DISTINCT FROM counts.total_bounced OR
    c.total_unsubscribed IS DISTINCT FROM counts.total_unsubscribed OR
    c.total_failed IS DISTINCT FROM counts.total_failed
  );

-- A campaign marked in-flight with no durable recipients cannot deliver.
-- Return it to draft for explicit review; never silently enqueue or send it.
UPDATE public.email_campaigns c
SET
  status = 'draft',
  completed_at = NULL,
  metadata = COALESCE(c.metadata, '{}'::jsonb) || jsonb_build_object(
    'repair_required', 'no_durable_recipients',
    'repaired_at', NOW()
  ),
  updated_at = NOW()
WHERE c.status IN ('sending', 'queued', 'processing')
  AND NOT EXISTS (
    SELECT 1 FROM public.campaign_recipients r WHERE r.campaign_id = c.id
  );

-- Preserve explicit legacy opt-ins in the auditable consent ledger. Rows with
-- no opt-in remain blocked: this migration never grants consent by guesswork.
INSERT INTO public.consent_records (
  tenant_id, contact_id, email_address, purpose, channel, status, source,
  collected_at, method, evidence
)
SELECT
  l.tenant_id,
  l.id,
  lower(trim(l.email)),
  'marketing',
  'email',
  'granted',
  'legacy_marketing_opt_in',
  NOW(),
  'legacy_import',
  jsonb_build_object('migration', '20260908173000', 'legacy_marketing_opt_in', true)
FROM public.leads l
WHERE l.email IS NOT NULL
  AND trim(l.email) <> ''
  AND (COALESCE(to_jsonb(l)->>'marketing_opt_in', 'false') = 'true'
       OR COALESCE(to_jsonb(l)->>'email_opt_in', 'false') = 'true'
       OR COALESCE(to_jsonb(l)->'metadata'->>'marketing_opt_in', 'false') = 'true'
       OR COALESCE(to_jsonb(l)->'metadata'->>'email_opt_in', 'false') = 'true'
       OR COALESCE(to_jsonb(l)->'metadata'->>'marketingConsent', 'false') = 'true')
  AND NOT EXISTS (
    SELECT 1 FROM public.consent_records cr
    WHERE cr.tenant_id = l.tenant_id
      AND lower(cr.email_address) = lower(trim(l.email))
      AND cr.purpose = 'marketing'
      AND cr.channel = 'email'
      AND cr.status = 'granted'
  );

-- Select a deterministic default only where an active, publish-capable
-- identity already exists. External billing, tokens and permissions are not
-- fabricated and must still be valid at publish time.
WITH candidates AS (
  SELECT DISTINCT ON (tenant_id, provider)
    id, tenant_id, provider
  FROM public.social_identities si
  WHERE si.is_active = true AND si.can_publish = true
    AND NOT EXISTS (
      SELECT 1 FROM public.social_identities current_default
      WHERE current_default.tenant_id = si.tenant_id
        AND current_default.provider = si.provider
        AND current_default.is_active = true
        AND current_default.is_default = true
    )
  ORDER BY tenant_id, provider, last_verified_at DESC NULLS LAST, created_at DESC
)
UPDATE public.social_identities si
SET is_default = true, updated_at = NOW()
FROM candidates c
WHERE si.id = c.id;

INSERT INTO public.tenant_social_defaults (tenant_id, provider, identity_id, updated_at)
SELECT si.tenant_id, si.provider, si.id, NOW()
FROM public.social_identities si
WHERE si.is_active = true AND si.is_default = true
ON CONFLICT (tenant_id, provider)
DO UPDATE SET identity_id = EXCLUDED.identity_id, updated_at = NOW();

COMMIT;
