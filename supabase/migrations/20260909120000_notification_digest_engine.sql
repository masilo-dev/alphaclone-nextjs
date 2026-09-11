-- Canonical tenant-aware internal notification digest queue and delivery ledger.
BEGIN;

DO $$ BEGIN
  CREATE TYPE public.notification_digest_type AS ENUM ('morning', 'evening');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.notification_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  digest_date DATE NOT NULL,
  digest_type public.notification_digest_type NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  status TEXT NOT NULL DEFAULT 'sending'
    CHECK (status IN ('sending', 'sent', 'failed', 'skipped')),
  event_count INTEGER NOT NULL DEFAULT 0 CHECK (event_count >= 0),
  sent_at TIMESTAMPTZ,
  provider_message_id TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notification_digest_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL DEFAULT 'business',
  entity_type TEXT,
  entity_id TEXT,
  source TEXT NOT NULL DEFAULT 'system',
  source_action TEXT,
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  digest_period public.notification_digest_type,
  included_in_digest_id UUID REFERENCES public.notification_digests(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_digest_events_tenant ON public.notification_digest_events (tenant_id);
CREATE INDEX IF NOT EXISTS idx_digest_events_user ON public.notification_digest_events (user_id);
CREATE INDEX IF NOT EXISTS idx_digest_events_occurred ON public.notification_digest_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_digest_events_included ON public.notification_digest_events (included_in_digest_id);
CREATE INDEX IF NOT EXISTS idx_digest_events_category ON public.notification_digest_events (event_category);
CREATE INDEX IF NOT EXISTS idx_digest_events_pending_recipient
  ON public.notification_digest_events (tenant_id, user_id, occurred_at)
  WHERE included_in_digest_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_digests_recipient_day
  ON public.notification_digests (tenant_id, user_id, digest_date, digest_type);

ALTER TABLE public.notification_digest_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_digests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant members can read digest events" ON public.notification_digest_events;
CREATE POLICY "Tenant members can read digest events"
  ON public.notification_digest_events FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.tenant_id = notification_digest_events.tenant_id
      AND tu.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "Recipients can read notification digests" ON public.notification_digests;
CREATE POLICY "Recipients can read notification digests"
  ON public.notification_digests FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.tenant_id = notification_digests.tenant_id
      AND tu.user_id = auth.uid()
  ));

-- Database-side safety check used immediately before an internal digest send.
-- The unique key is the authoritative duplicate-send guard; this function also
-- enforces the two normal internal messages per local recipient day ceiling.
CREATE OR REPLACE FUNCTION public.check_internal_notification_budget(
  p_tenant_id UUID,
  p_user_id UUID,
  p_recipient_email TEXT,
  p_digest_date DATE
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COUNT(*) < 2
  FROM public.notification_digests d
  WHERE d.tenant_id = p_tenant_id
    AND d.user_id = p_user_id
    AND lower(d.recipient_email) = lower(trim(p_recipient_email))
    AND d.digest_date = p_digest_date
    AND d.status IN ('sending', 'sent');
$$;

REVOKE ALL ON FUNCTION public.check_internal_notification_budget(UUID, UUID, TEXT, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_internal_notification_budget(UUID, UUID, TEXT, DATE) TO service_role;

COMMENT ON TABLE public.notification_digest_events IS
  'Durable buffer for internal owner/platform notifications; never customer-facing communication.';
COMMENT ON TABLE public.notification_digests IS
  'At-most-once morning/evening internal digest delivery claims.';

COMMIT;
