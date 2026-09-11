-- MCP connection tokens: one per (tenant, user) so each team member connects their own Claude/Manus.
-- Shared AI usage quota (consume_tenant_ai_units) is in 20260412164029_mcp_shared_tenant_ai_units_quota.sql (applied on hosted DB via Supabase MCP).

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'mcp_api_keys'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'mcp_api_keys' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE public.mcp_api_keys
        ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    UPDATE public.mcp_api_keys k
    SET user_id = (
      SELECT tu.user_id
      FROM public.tenant_users tu
      WHERE tu.tenant_id = k.tenant_id
      ORDER BY CASE WHEN tu.role IN ('admin', 'owner') THEN 0 ELSE 1 END, tu.user_id
      LIMIT 1
    )
    WHERE k.user_id IS NULL;

    DELETE FROM public.mcp_api_keys WHERE user_id IS NULL;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'mcp_api_keys' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE public.mcp_api_keys ALTER COLUMN user_id SET NOT NULL;
    END IF;

    ALTER TABLE public.mcp_api_keys DROP CONSTRAINT IF EXISTS mcp_api_keys_tenant_id_key;

    CREATE UNIQUE INDEX IF NOT EXISTS mcp_api_keys_tenant_id_user_id_key
      ON public.mcp_api_keys (tenant_id, user_id);
  ELSE
    CREATE TABLE public.mcp_api_keys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      api_key TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMPTZ,
      UNIQUE (tenant_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_mcp_api_keys_api_key ON public.mcp_api_keys (api_key);

    ALTER TABLE public.mcp_api_keys ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
