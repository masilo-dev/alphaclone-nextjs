CREATE TABLE IF NOT EXISTS public.sms_opt_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  keyword TEXT,
  source TEXT NOT NULL DEFAULT 'sms',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, phone_number)
);

CREATE INDEX IF NOT EXISTS idx_sms_opt_outs_tenant ON public.sms_opt_outs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sms_opt_outs_phone ON public.sms_opt_outs(phone_number);

ALTER TABLE public.sms_opt_outs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "tenant_members_manage_sms_opt_outs" ON public.sms_opt_outs
    FOR ALL USING (
      tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
    )
    WITH CHECK (
      tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

