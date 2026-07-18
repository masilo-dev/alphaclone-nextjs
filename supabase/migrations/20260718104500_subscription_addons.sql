CREATE TABLE IF NOT EXISTS public.subscription_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  addon_type TEXT NOT NULL CHECK (addon_type IN ('storage','ai_requests','video_minutes','team_members','api_calls')),
  addon_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  billing_cycle TEXT NOT NULL CHECK (billing_cycle IN ('one_time','monthly','annual')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','expired')),
  stripe_checkout_session_id TEXT,
  stripe_subscription_id TEXT,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, addon_type)
);
CREATE UNIQUE INDEX IF NOT EXISTS subscription_addons_checkout_session_key
  ON public.subscription_addons (stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL;
ALTER TABLE public.subscription_addons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subscription_addons_member_select ON public.subscription_addons;
CREATE POLICY subscription_addons_member_select ON public.subscription_addons FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.tenant_users tu WHERE tu.tenant_id = subscription_addons.tenant_id AND tu.user_id = auth.uid())
);
REVOKE INSERT, UPDATE, DELETE ON public.subscription_addons FROM authenticated, anon;
GRANT SELECT ON public.subscription_addons TO authenticated;
NOTIFY pgrst, 'reload schema';
