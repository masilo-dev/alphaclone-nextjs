ALTER TABLE public.mcp_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
DROP POLICY IF EXISTS "tenant_members_manage_mcp_sessions" ON public.mcp_sessions;
  CREATE POLICY "tenant_members_manage_mcp_sessions" ON public.mcp_sessions
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM public.tenant_users
        WHERE tenant_users.tenant_id = mcp_sessions.tenant_id
          AND tenant_users.user_id = auth.uid()
      )
      AND mcp_sessions.user_id = auth.uid()
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.tenant_users
        WHERE tenant_users.tenant_id = mcp_sessions.tenant_id
          AND tenant_users.user_id = auth.uid()
      )
      AND mcp_sessions.user_id = auth.uid()
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

