-- Fix: Consolidated self-healing migration for WhatsApp integration schema.
-- This script ensures that `public.whatsapp_integrations` exists, has all
-- required columns, proper indices, RLS policies, permissions, and flushes
-- the PostgREST cache so the API functions flawlessly.

-- 1. Create base table if not exists
CREATE TABLE IF NOT EXISTS public.whatsapp_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id),
  waba_id TEXT NOT NULL,
  phone_number_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, waba_id)
);

-- 2. Add columns safely if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'whatsapp_integrations'
      AND column_name  = 'access_token'
  ) THEN
    ALTER TABLE public.whatsapp_integrations
      ADD COLUMN access_token TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'whatsapp_integrations'
      AND column_name  = 'webhook_verified'
  ) THEN
    ALTER TABLE public.whatsapp_integrations
      ADD COLUMN webhook_verified BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- 3. Create indices safely
CREATE INDEX IF NOT EXISTS idx_whatsapp_integrations_tenant_active on public.whatsapp_integrations(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_whatsapp_integrations_waba on public.whatsapp_integrations(waba_id);

-- 4. Enable Row Level Security safely
ALTER TABLE public.whatsapp_integrations ENABLE ROW LEVEL SECURITY;

-- 5. Safe Policy Creation (drop and recreate to ensure correctness)
DROP POLICY IF EXISTS tenant_isolation_policy ON public.whatsapp_integrations;
CREATE POLICY tenant_isolation_policy ON public.whatsapp_integrations
  FOR ALL TO public
  USING (
    is_super_admin() or (tenant_id in (select get_user_tenant_ids.tenant_id from get_user_tenant_ids() get_user_tenant_ids(tenant_id)))
  )
  WITH CHECK (
    is_super_admin() or (tenant_id in (select get_user_tenant_ids.tenant_id from get_user_tenant_ids() get_user_tenant_ids(tenant_id)))
  );

-- 6. Grant usage to public and auth roles for PostgREST
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_integrations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_integrations TO service_role;

-- 7. Notify PostgREST to reload its schema cache immediately
NOTIFY pgrst, 'reload schema';
