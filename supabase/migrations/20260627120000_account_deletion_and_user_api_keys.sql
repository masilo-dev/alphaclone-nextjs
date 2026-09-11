-- Account deletion RPCs (legacy client fallback) + user_api_keys table

-- Ensure account_status enum includes all lifecycle values
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_status') THEN
        CREATE TYPE public.account_status AS ENUM ('active', 'suspended', 'pending_deletion', 'deleted');
    END IF;
END $$;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS account_status public.account_status DEFAULT 'active'::public.account_status,
    ADD COLUMN IF NOT EXISTS scheduled_deletion_at TIMESTAMPTZ;

-- user_api_keys — referenced by Settings MCP key UI
CREATE TABLE IF NOT EXISTS public.user_api_keys (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type        TEXT NOT NULL DEFAULT 'mcp',
    key         TEXT NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_type
    ON public.user_api_keys (user_id, type)
    WHERE is_active = true;

ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own API keys" ON public.user_api_keys;
CREATE POLICY "Users manage own API keys"
    ON public.user_api_keys
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Self-service account deletion (30-day grace)
CREATE OR REPLACE FUNCTION public.request_account_deletion()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    UPDATE public.profiles
    SET account_status = 'pending_deletion'::public.account_status,
        scheduled_deletion_at = NOW() + INTERVAL '30 days',
        updated_at = NOW()
    WHERE id = v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_account_deletion()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    UPDATE public.profiles
    SET account_status = 'active'::public.account_status,
        scheduled_deletion_at = NULL,
        updated_at = NOW()
    WHERE id = v_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_account_deletion() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_account_deletion() TO authenticated;
