-- Migration: Ensure whatsapp_integrations has all fields needed for
-- multi-tenant Meta WhatsApp Cloud API. Each tenant connects their own
-- phone number independently with full RLS data isolation.

-- Add webhook_verified column if not present (tracks Meta subscription status)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'whatsapp_integrations'
      AND column_name  = 'webhook_verified'
  ) THEN
    ALTER TABLE public.whatsapp_integrations
      ADD COLUMN webhook_verified BOOLEAN NOT NULL DEFAULT false;
  END IF;

  -- access_token stores the Meta System User or Page token for this tenant's number
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'whatsapp_integrations'
      AND column_name  = 'access_token'
  ) THEN
    ALTER TABLE public.whatsapp_integrations
      ADD COLUMN access_token TEXT;
  END IF;

  -- phone_number_id is the Meta Phone Number ID for this tenant's number
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'whatsapp_integrations'
      AND column_name  = 'phone_number_id'
  ) THEN
    ALTER TABLE public.whatsapp_integrations
      ADD COLUMN phone_number_id TEXT;
  END IF;
END $$;

-- Ensure RLS is enforced — no tenant can ever read another tenant's credentials
ALTER TABLE public.whatsapp_integrations ENABLE ROW LEVEL SECURITY;

-- Drop and recreate tenant isolation policy cleanly
DROP POLICY IF EXISTS tenant_isolation_policy ON public.whatsapp_integrations;
CREATE POLICY tenant_isolation_policy ON public.whatsapp_integrations
  FOR ALL TO public
  USING (
    is_super_admin() OR (
      tenant_id IN (
        SELECT tenant_id FROM get_user_tenant_ids()
      )
    )
  )
  WITH CHECK (
    is_super_admin() OR (
      tenant_id IN (
        SELECT tenant_id FROM get_user_tenant_ids()
      )
    )
  );

-- Service role (Vercel server-side functions) has full access for webhook ingestion
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_integrations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_integrations TO service_role;

-- Notify PostgREST to pick up schema changes immediately
NOTIFY pgrst, 'reload schema';
