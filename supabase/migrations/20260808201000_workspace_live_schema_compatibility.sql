-- Workspace live schema compatibility for operational readiness.
-- Adds a generic webhook event ledger and locks down legacy documents.

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  provider text NOT NULL,
  event_type text NOT NULL,
  status text NOT NULL DEFAULT 'received',
  external_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_tenant_created
  ON public.webhook_events (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_external
  ON public.webhook_events (provider, external_id)
  WHERE external_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_webhook_events_provider_type
  ON public.webhook_events (provider, event_type, created_at DESC);

ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS webhook_events_tenant_select ON public.webhook_events;
CREATE POLICY webhook_events_tenant_select
  ON public.webhook_events FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS webhook_events_service_role_all ON public.webhook_events;
CREATE POLICY webhook_events_service_role_all
  ON public.webhook_events FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS documents_tenant_access ON public.documents;
CREATE POLICY documents_tenant_access
  ON public.documents FOR ALL TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid()
    )
  );

DO $$
DECLARE
  tbl text;
  tables_to_add text[] := ARRAY[
    'webhook_events',
    'documents',
    'document_brand_profiles',
    'doc_os_documents',
    'doc_os_versions',
    'doc_os_events',
    'doc_os_signature_envelopes',
    'doc_os_approvals',
    'doc_os_retention_policies',
    'doc_os_notifications',
    'campaign_recipients',
    'business_receipts',
    'sales_receipts'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH tbl IN ARRAY tables_to_add LOOP
    IF to_regclass(format('public.%I', tbl)) IS NOT NULL THEN
      BEGIN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      EXCEPTION
        WHEN duplicate_object THEN NULL;
        WHEN insufficient_privilege THEN
          RAISE WARNING 'Could not add %.% to supabase_realtime due to insufficient privilege', 'public', tbl;
      END;
    END IF;
  END LOOP;
END $$;
