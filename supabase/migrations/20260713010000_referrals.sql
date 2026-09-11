-- Referral tracking base table

BEGIN;

CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code TEXT NOT NULL,
  referrer_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referrer_tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  referred_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  referred_email TEXT,
  referred_name TEXT,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'registered'
    CHECK (status IN ('registered', 'activated', 'rewarded', 'cancelled')),
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_code_user
  ON public.referrals (referral_code, referred_user_id);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_tenant
  ON public.referrals (referrer_tenant_id, created_at DESC);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_referrals" ON public.referrals;
CREATE POLICY "service_role_referrals" ON public.referrals
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_referrals" ON public.referrals;
CREATE POLICY "tenant_referrals" ON public.referrals
  FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
    OR referrer_tenant_id IN (SELECT tenant_id FROM public.tenant_users WHERE user_id = auth.uid())
  );

COMMIT;
