BEGIN;

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'push', 'sms', 'in_app')),
  event_type TEXT NOT NULL,
  recipient TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed', 'skipped')),
  provider_message_id TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_tenant_created
  ON public.notification_deliveries (tenant_id, created_at DESC);

ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant admins can read notification delivery status" ON public.notification_deliveries;
CREATE POLICY "Tenant admins can read notification delivery status"
  ON public.notification_deliveries FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.tenant_id = notification_deliveries.tenant_id
      AND tu.user_id = auth.uid()
      AND tu.role IN ('owner', 'admin', 'tenant_admin', 'super_admin')
  ));

COMMIT;
