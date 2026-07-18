CREATE TABLE IF NOT EXISTS public.alpha_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 3 AND 4000),
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
  logs JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(logs) = 'array'),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS alpha_missions_tenant_user_started_idx
  ON public.alpha_missions (tenant_id, user_id, started_at DESC);

ALTER TABLE public.alpha_missions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS alpha_missions_member_select ON public.alpha_missions;
CREATE POLICY alpha_missions_member_select ON public.alpha_missions FOR SELECT USING (
  user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.tenant_users tu
    WHERE tu.tenant_id = alpha_missions.tenant_id AND tu.user_id = auth.uid()
  )
);

REVOKE INSERT, UPDATE, DELETE ON public.alpha_missions FROM authenticated, anon;
GRANT SELECT ON public.alpha_missions TO authenticated;
NOTIFY pgrst, 'reload schema';
