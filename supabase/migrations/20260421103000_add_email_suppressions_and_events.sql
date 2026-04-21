-- Email suppression and provider event tracking
CREATE TABLE IF NOT EXISTS public.email_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('bounce', 'spam_report', 'unsubscribe', 'manual')),
  source_provider TEXT,
  source_event_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_email_suppressions_tenant_email
  ON public.email_suppressions (tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_email_suppressions_reason
  ON public.email_suppressions (reason);

CREATE TABLE IF NOT EXISTS public.email_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  event_type TEXT NOT NULL,
  recipient_email TEXT,
  provider_event_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_webhook_events_tenant
  ON public.email_webhook_events (tenant_id, processed_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_webhook_events_event_type
  ON public.email_webhook_events (event_type);

ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view suppressions in their tenants" ON public.email_suppressions;
CREATE POLICY "Users can view suppressions in their tenants"
  ON public.email_suppressions
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM public.tenant_users
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view email webhook events in their tenants" ON public.email_webhook_events;
CREATE POLICY "Users can view email webhook events in their tenants"
  ON public.email_webhook_events
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id
      FROM public.tenant_users
      WHERE user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS trg_email_suppressions_updated_at ON public.email_suppressions;
CREATE TRIGGER trg_email_suppressions_updated_at
  BEFORE UPDATE ON public.email_suppressions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
