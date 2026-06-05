-- Automation event bus for cron dispatcher (process-events)
CREATE TABLE IF NOT EXISTS public.business_automation_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}',
  processed   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_events_unprocessed
  ON public.business_automation_events (tenant_id, created_at ASC)
  WHERE processed = false;

ALTER TABLE public.business_automation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_manage_events" ON public.business_automation_events;
CREATE POLICY "service_role_manage_events" ON public.business_automation_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_read_events" ON public.business_automation_events;
CREATE POLICY "tenant_read_events" ON public.business_automation_events
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.business_automation_events TO service_role;
