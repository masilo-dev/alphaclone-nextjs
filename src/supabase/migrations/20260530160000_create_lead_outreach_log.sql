CREATE TABLE IF NOT EXISTS public.lead_outreach_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  lead_name TEXT,
  lead_email TEXT,
  subject TEXT,
  body_html TEXT,
  tracking_id TEXT,
  pitch_angle TEXT,
  industry TEXT,
  score NUMERIC,
  status TEXT DEFAULT 'queued',
  provider TEXT,
  provider_message_id TEXT,
  zoho_message_id TEXT,
  provider_event_status TEXT,
  provider_last_event_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_outreach_log_tenant_created_at ON public.lead_outreach_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_outreach_log_tracking_id ON public.lead_outreach_log(tracking_id);
CREATE INDEX IF NOT EXISTS idx_lead_outreach_log_provider_message_id ON public.lead_outreach_log(provider, provider_message_id);
CREATE INDEX IF NOT EXISTS idx_lead_outreach_log_status ON public.lead_outreach_log(status);

ALTER TABLE public.lead_outreach_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'lead_outreach_log'
      AND policyname = 'tenant_lead_outreach_log_policy'
  ) THEN
    CREATE POLICY tenant_lead_outreach_log_policy ON public.lead_outreach_log
      FOR ALL
      USING (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()))
      WITH CHECK (tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()));
  END IF;
END $$;

GRANT ALL ON public.lead_outreach_log TO authenticated;
