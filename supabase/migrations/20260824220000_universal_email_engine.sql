-- Universal email engine: communications outbox, unsubscribe audit, public recipient preferences

CREATE TABLE IF NOT EXISTS public.email_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL,
  category TEXT NOT NULL,
  communication_class TEXT NOT NULL CHECK (
    communication_class IN ('transactional', 'business_notification', 'digest', 'outreach_marketing')
  ),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  recipient_id TEXT,
  recipient_type TEXT,
  recipient_email TEXT NOT NULL,
  event_type TEXT,
  entity_type TEXT,
  entity_id TEXT,
  sender_identity TEXT,
  subject TEXT NOT NULL,
  preheader TEXT,
  personalisation JSONB NOT NULL DEFAULT '{}'::jsonb,
  cta_url TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  unsubscribe_policy TEXT NOT NULL DEFAULT 'category',
  delivery_status TEXT NOT NULL DEFAULT 'queued'
    CHECK (delivery_status IN ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'unsubscribed', 'failed', 'skipped')),
  provider TEXT,
  provider_message_id TEXT,
  idempotency_key TEXT UNIQUE,
  error TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_communications_tenant_created
  ON public.email_communications (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_communications_template
  ON public.email_communications (template_key, delivery_status);
CREATE INDEX IF NOT EXISTS idx_email_communications_recipient
  ON public.email_communications (tenant_id, recipient_email);

CREATE TABLE IF NOT EXISTS public.email_unsubscribe_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  category TEXT,
  source TEXT NOT NULL DEFAULT 'unsubscribe_link',
  source_campaign_id TEXT,
  token_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT NOT NULL DEFAULT 'unsubscribed'
    CHECK (status IN ('unsubscribed', 'resubscribed', 'preferences_updated')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_unsubscribe_audit_tenant_email
  ON public.email_unsubscribe_audit (tenant_id, email, created_at DESC);

CREATE TABLE IF NOT EXISTS public.recipient_email_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  marketing BOOLEAN NOT NULL DEFAULT true,
  outreach BOOLEAN NOT NULL DEFAULT true,
  newsletter BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_recipient_email_prefs_tenant
  ON public.recipient_email_preferences (tenant_id, email);

ALTER TABLE public.email_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_unsubscribe_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipient_email_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members view email communications" ON public.email_communications;
CREATE POLICY "Tenant members view email communications"
  ON public.email_communications FOR SELECT
  USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Tenant members view unsubscribe audit" ON public.email_unsubscribe_audit;
CREATE POLICY "Tenant members view unsubscribe audit"
  ON public.email_unsubscribe_audit FOR SELECT
  USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

DROP TRIGGER IF EXISTS trg_email_communications_updated_at ON public.email_communications;
CREATE TRIGGER trg_email_communications_updated_at
  BEFORE UPDATE ON public.email_communications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_recipient_email_prefs_updated_at ON public.recipient_email_preferences;
CREATE TRIGGER trg_recipient_email_prefs_updated_at
  BEFORE UPDATE ON public.recipient_email_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
