BEGIN;

CREATE TABLE IF NOT EXISTS public.bonnie_dream_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  reviewed_sessions JSONB NOT NULL DEFAULT '[]'::jsonb,
  patterns_extracted JSONB NOT NULL DEFAULT '[]'::jsonb,
  memory_updates JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'applied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at TIMESTAMPTZ
);

ALTER TABLE public.bonnie_dream_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can read dream sessions" ON public.bonnie_dream_sessions;
CREATE POLICY "Tenant users can read dream sessions" ON public.bonnie_dream_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu 
      WHERE tu.tenant_id = bonnie_dream_sessions.tenant_id 
        AND tu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Tenant admins can modify dream sessions" ON public.bonnie_dream_sessions;
CREATE POLICY "Tenant admins can modify dream sessions" ON public.bonnie_dream_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu 
      WHERE tu.tenant_id = bonnie_dream_sessions.tenant_id 
        AND tu.user_id = auth.uid() 
        AND tu.role IN ('tenant_admin', 'admin', 'owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tenant_users tu 
      WHERE tu.tenant_id = bonnie_dream_sessions.tenant_id 
        AND tu.user_id = auth.uid() 
        AND tu.role IN ('tenant_admin', 'admin', 'owner')
    )
  );

COMMIT;
