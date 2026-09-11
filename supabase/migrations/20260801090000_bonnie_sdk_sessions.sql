BEGIN;

CREATE TABLE IF NOT EXISTS public.bonnie_sdk_session_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  item JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bonnie_sdk_session_scope
  ON public.bonnie_sdk_session_items (tenant_id, user_id, id DESC);

ALTER TABLE public.bonnie_sdk_session_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant users can read own Bonnie SDK session" ON public.bonnie_sdk_session_items;
CREATE POLICY "Tenant users can read own Bonnie SDK session"
  ON public.bonnie_sdk_session_items FOR SELECT
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = bonnie_sdk_session_items.tenant_id
        AND tu.user_id = auth.uid()
    )
  );

COMMIT;
