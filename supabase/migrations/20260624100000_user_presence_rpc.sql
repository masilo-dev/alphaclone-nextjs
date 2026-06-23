BEGIN;

CREATE TABLE IF NOT EXISTS public.user_presence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'away', 'busy', 'offline')),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    device_info JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_presence_status_last_seen
    ON public.user_presence (status, last_seen DESC);

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read user presence" ON public.user_presence;
CREATE POLICY "Anyone can read user presence"
    ON public.user_presence
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users manage own presence" ON public.user_presence;
CREATE POLICY "Users manage own presence"
    ON public.user_presence
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_user_presence(
    p_user_id UUID,
    p_status TEXT,
    p_device_info JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Not authorized to update this presence record';
    END IF;

    INSERT INTO public.user_presence (user_id, status, last_seen, device_info, updated_at)
    VALUES (p_user_id, COALESCE(p_status, 'online'), NOW(), p_device_info, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
        status = EXCLUDED.status,
        last_seen = NOW(),
        device_info = COALESCE(EXCLUDED.device_info, public.user_presence.device_info),
        updated_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_online_users(p_exclude_user_id UUID DEFAULT NULL)
RETURNS TABLE (
    user_id UUID,
    status TEXT,
    last_seen TIMESTAMPTZ,
    name TEXT,
    email TEXT,
    avatar_url TEXT,
    role TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        up.user_id,
        up.status,
        up.last_seen,
        NULL::TEXT AS name,
        NULL::TEXT AS email,
        NULL::TEXT AS avatar_url,
        NULL::TEXT AS role
    FROM public.user_presence up
    WHERE up.status IN ('online', 'away', 'busy')
      AND up.last_seen >= NOW() - INTERVAL '10 minutes'
      AND (p_exclude_user_id IS NULL OR up.user_id <> p_exclude_user_id);
$$;

GRANT EXECUTE ON FUNCTION public.update_user_presence(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_online_users(UUID) TO authenticated;

COMMIT;
