CREATE OR REPLACE FUNCTION public.enqueue_business_event_webhooks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  normalized_event text := CASE NEW.event_type
    WHEN 'deal_stage_changed' THEN 'deal.stage_changed'
    WHEN 'invoice_created' THEN 'invoice.created'
    WHEN 'lead_created' THEN 'lead.created'
    WHEN 'contact_created' THEN 'contact.created'
    ELSE replace(NEW.event_type, '_', '.')
  END;
BEGIN
  INSERT INTO public.webhook_deliveries (webhook_id, event, payload, status)
  SELECT webhook.id, normalized_event, COALESCE(NEW.payload, '{}'::jsonb), 'pending'
  FROM public.webhooks AS webhook
  WHERE webhook.tenant_id = NEW.tenant_id
    AND webhook.is_active = true
    AND webhook.events @> ARRAY[normalized_event]::text[];
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enqueue_business_event_webhooks ON public.business_automation_events;
CREATE TRIGGER enqueue_business_event_webhooks
AFTER INSERT ON public.business_automation_events
FOR EACH ROW EXECUTE FUNCTION public.enqueue_business_event_webhooks();

CREATE OR REPLACE FUNCTION public.claim_webhook_deliveries(p_limit integer DEFAULT 50)
RETURNS SETOF public.webhook_deliveries
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH due AS (
    SELECT id FROM public.webhook_deliveries
    WHERE status IN ('pending', 'retrying') AND (next_retry_at IS NULL OR next_retry_at <= now())
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
  ), claimed AS (
    UPDATE public.webhook_deliveries AS delivery
    SET status = 'retrying', next_retry_at = now() + interval '5 minutes'
    FROM due WHERE delivery.id = due.id
    RETURNING delivery.*
  )
  SELECT * FROM claimed;
$$;

REVOKE ALL ON FUNCTION public.claim_webhook_deliveries(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_webhook_deliveries(integer) TO service_role;
