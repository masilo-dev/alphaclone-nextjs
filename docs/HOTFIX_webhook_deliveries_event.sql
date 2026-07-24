-- HOTFIX: production blocker for create_tenant_idempotent / new Google signups
-- Project: ehekzoioqvtweugemktn
-- Error: column "event" of relation "webhook_deliveries" does not exist
-- Live table has event_type, but a trigger still inserts into "event".

ALTER TABLE public.webhook_deliveries
  ADD COLUMN IF NOT EXISTS event text;

-- Keep event in sync with event_type for legacy triggers
UPDATE public.webhook_deliveries
SET event = event_type
WHERE event IS NULL AND event_type IS NOT NULL;

CREATE OR REPLACE FUNCTION public.webhook_deliveries_sync_event()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.event IS NULL AND NEW.event_type IS NOT NULL THEN
    NEW.event := NEW.event_type;
  ELSIF NEW.event_type IS NULL AND NEW.event IS NOT NULL THEN
    NEW.event_type := NEW.event;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_webhook_deliveries_sync_event ON public.webhook_deliveries;
CREATE TRIGGER trg_webhook_deliveries_sync_event
  BEFORE INSERT OR UPDATE ON public.webhook_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.webhook_deliveries_sync_event();
