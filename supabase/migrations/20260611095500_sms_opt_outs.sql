CREATE TABLE IF NOT EXISTS public.sms_opt_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  keyword TEXT,
  source TEXT NOT NULL DEFAULT 'sms',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, phone_number)
);

ALTER TABLE public.sms_opt_outs
  ADD COLUMN IF NOT EXISTS phone_number TEXT,
  ADD COLUMN IF NOT EXISTS keyword TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'sms';

UPDATE public.sms_opt_outs
SET phone_number = COALESCE(phone_number, phone)
WHERE phone_number IS NULL AND phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sms_opt_outs_tenant ON public.sms_opt_outs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sms_opt_outs_phone ON public.sms_opt_outs(COALESCE(phone_number, phone));

ALTER TABLE public.sms_opt_outs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
DROP POLICY IF EXISTS "tenant_members_manage_sms_opt_outs" ON public.sms_opt_outs;
  CREATE POLICY "tenant_members_manage_sms_opt_outs" ON public.sms_opt_outs
    FOR ALL USING (
      tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
    )
    WITH CHECK (
      tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

