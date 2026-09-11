-- Phase 23-47: canonical operating events, tenant notification policy, dead letters.

ALTER TABLE public.business_automation_events
  ADD COLUMN IF NOT EXISTS actor_id uuid,
  ADD COLUMN IF NOT EXISTS actor_type text,
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id text,
  ADD COLUMN IF NOT EXISTS correlation_id uuid,
  ADD COLUMN IF NOT EXISTS causation_id uuid,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS dead_letter boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS business_automation_events_idempotency_idx
  ON public.business_automation_events (tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS business_automation_events_dead_letter_idx
  ON public.business_automation_events (tenant_id, created_at DESC)
  WHERE dead_letter = true;

CREATE INDEX IF NOT EXISTS business_automation_events_correlation_idx
  ON public.business_automation_events (tenant_id, correlation_id)
  WHERE correlation_id IS NOT NULL;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS recipient_role text,
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id text,
  ADD COLUMN IF NOT EXISTS event_type text,
  ADD COLUMN IF NOT EXISTS severity text,
  ADD COLUMN IF NOT EXISTS channel text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS source_event_id text,
  ADD COLUMN IF NOT EXISTS correlation_id text;

CREATE UNIQUE INDEX IF NOT EXISTS notifications_dedupe_idx
  ON public.notifications (tenant_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS notifications_tenant_unread_idx
  ON public.notifications (tenant_id, user_id, created_at DESC)
  WHERE COALESCE(read, false) = false;

CREATE TABLE IF NOT EXISTS public.tenant_notification_policies (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  categories jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_notification_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_notification_policies_select ON public.tenant_notification_policies;
CREATE POLICY tenant_notification_policies_select
  ON public.tenant_notification_policies
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_users.tenant_id FROM public.tenant_users
      WHERE tenant_users.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS tenant_notification_policies_write ON public.tenant_notification_policies;
CREATE POLICY tenant_notification_policies_write
  ON public.tenant_notification_policies
  FOR ALL
  USING (
    tenant_id IN (
      SELECT tenant_users.tenant_id FROM public.tenant_users
      WHERE tenant_users.user_id = auth.uid()
        AND tenant_users.role IN ('owner', 'admin', 'tenant_admin', 'super_admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_users.tenant_id FROM public.tenant_users
      WHERE tenant_users.user_id = auth.uid()
        AND tenant_users.role IN ('owner', 'admin', 'tenant_admin', 'super_admin')
    )
  );

NOTIFY pgrst, 'reload schema';
