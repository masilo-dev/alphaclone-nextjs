-- ==========================================
-- PRESENCE & MISSED CALLS MIGRATION
-- MS Teams-like functionality for AlphaClone
-- ==========================================

-- 1. User Presence Tracking Table
CREATE TABLE IF NOT EXISTS public.user_presence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'away', 'busy', 'offline')),
    last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    device_info JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Index for fast presence lookups
CREATE INDEX IF NOT EXISTS idx_user_presence_user_id ON public.user_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_status ON public.user_presence(status);
CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen ON public.user_presence(last_seen);

-- 2. Missed Calls Table
CREATE TABLE IF NOT EXISTS public.missed_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    callee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    call_type TEXT NOT NULL DEFAULT 'video' CHECK (call_type IN ('video', 'audio')),
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    seen_at TIMESTAMPTZ,
    call_id UUID REFERENCES public.video_calls(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for missed calls
CREATE INDEX IF NOT EXISTS idx_missed_calls_callee_id ON public.missed_calls(callee_id);
CREATE INDEX IF NOT EXISTS idx_missed_calls_caller_id ON public.missed_calls(caller_id);
CREATE INDEX IF NOT EXISTS idx_missed_calls_seen_at ON public.missed_calls(seen_at);
CREATE INDEX IF NOT EXISTS idx_missed_calls_attempted_at ON public.missed_calls(attempted_at DESC);

-- 3. Call Attempts Table (for call history)
CREATE TABLE IF NOT EXISTS public.call_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    caller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    callee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    call_type TEXT NOT NULL DEFAULT 'video' CHECK (call_type IN ('video', 'audio')),
    status TEXT NOT NULL DEFAULT 'ringing' CHECK (status IN ('ringing', 'answered', 'declined', 'missed', 'cancelled', 'failed')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    answered_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    call_id UUID REFERENCES public.video_calls(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for call attempts
CREATE INDEX IF NOT EXISTS idx_call_attempts_caller_id ON public.call_attempts(caller_id);
CREATE INDEX IF NOT EXISTS idx_call_attempts_callee_id ON public.call_attempts(callee_id);
CREATE INDEX IF NOT EXISTS idx_call_attempts_status ON public.call_attempts(status);
CREATE INDEX IF NOT EXISTS idx_call_attempts_started_at ON public.call_attempts(started_at DESC);

-- 4. Function to update presence status
CREATE OR REPLACE FUNCTION public.update_user_presence(
    p_user_id UUID,
    p_status TEXT,
    p_device_info JSONB DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.user_presence (user_id, status, last_seen, device_info, updated_at)
    VALUES (p_user_id, p_status, NOW(), COALESCE(p_device_info, '{}'::jsonb), NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
        status = EXCLUDED.status,
        last_seen = NOW(),
        device_info = COALESCE(EXCLUDED.device_info, user_presence.device_info),
        updated_at = NOW();
END;
$$;

-- 5. Function to get online users
CREATE OR REPLACE FUNCTION public.get_online_users(
    p_exclude_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    user_id UUID,
    status TEXT,
    last_seen TIMESTAMPTZ,
    name TEXT,
    email TEXT,
    avatar_url TEXT,
    role TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        up.user_id,
        up.status,
        up.last_seen,
        p.name,
        p.email,
        p.avatar_url,
        p.role
    FROM public.user_presence up
    INNER JOIN public.profiles p ON up.user_id = p.id
    WHERE
        up.status IN ('online', 'away', 'busy')
        AND (p_exclude_user_id IS NULL OR up.user_id != p_exclude_user_id)
        AND up.last_seen > NOW() - INTERVAL '5 minutes'
    ORDER BY
        CASE up.status
            WHEN 'online' THEN 1
            WHEN 'away' THEN 2
            WHEN 'busy' THEN 3
        END,
        up.last_seen DESC;
END;
$$;

-- 6. Function to create missed call
CREATE OR REPLACE FUNCTION public.create_missed_call(
    p_caller_id UUID,
    p_callee_id UUID,
    p_call_type TEXT DEFAULT 'video',
    p_call_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_missed_call_id UUID;
BEGIN
    INSERT INTO public.missed_calls (caller_id, callee_id, call_type, call_id, attempted_at)
    VALUES (p_caller_id, p_callee_id, p_call_type, p_call_id, NOW())
    RETURNING id INTO v_missed_call_id;

    RETURN v_missed_call_id;
END;
$$;

-- 7. Function to mark missed call as seen
CREATE OR REPLACE FUNCTION public.mark_missed_call_seen(
    p_missed_call_id UUID,
    p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.missed_calls
    SET seen_at = NOW()
    WHERE id = p_missed_call_id
        AND callee_id = p_user_id
        AND seen_at IS NULL;
END;
$$;

-- 8. Function to get unseen missed calls count
CREATE OR REPLACE FUNCTION public.get_unseen_missed_calls_count(
    p_user_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM public.missed_calls
    WHERE callee_id = p_user_id
        AND seen_at IS NULL;

    RETURN v_count;
END;
$$;

-- 9. Function to get missed calls for user
CREATE OR REPLACE FUNCTION public.get_missed_calls_for_user(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    caller_id UUID,
    caller_name TEXT,
    caller_avatar TEXT,
    call_type TEXT,
    attempted_at TIMESTAMPTZ,
    seen_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        mc.id,
        mc.caller_id,
        p.name as caller_name,
        p.avatar_url as caller_avatar,
        mc.call_type,
        mc.attempted_at,
        mc.seen_at
    FROM public.missed_calls mc
    INNER JOIN public.profiles p ON mc.caller_id = p.id
    WHERE mc.callee_id = p_user_id
    ORDER BY mc.attempted_at DESC
    LIMIT p_limit;
END;
$$;

-- 10. Function to auto-mark users as away/offline
CREATE OR REPLACE FUNCTION public.auto_update_presence_status()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Mark users as away if no activity for 5 minutes
    UPDATE public.user_presence
    SET status = 'away', updated_at = NOW()
    WHERE status = 'online'
        AND last_seen < NOW() - INTERVAL '5 minutes'
        AND last_seen > NOW() - INTERVAL '15 minutes';

    -- Mark users as offline if no activity for 15 minutes
    UPDATE public.user_presence
    SET status = 'offline', updated_at = NOW()
    WHERE status IN ('online', 'away')
        AND last_seen < NOW() - INTERVAL '15 minutes';
END;
$$;

-- 11. RLS Policies for user_presence
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Users can view all presence status (needed for showing online status)
CREATE POLICY "Anyone can view presence" ON public.user_presence
    FOR SELECT
    USING (true);

-- Users can only update their own presence
CREATE POLICY "Users can update own presence" ON public.user_presence
    FOR ALL
    USING (auth.uid() = user_id);

-- 12. RLS Policies for missed_calls
ALTER TABLE public.missed_calls ENABLE ROW LEVEL SECURITY;

-- Users can view their own missed calls (as callee)
CREATE POLICY "Users can view their missed calls" ON public.missed_calls
    FOR SELECT
    USING (auth.uid() = callee_id);

-- Users can view missed calls they initiated (as caller)
CREATE POLICY "Users can view calls they made" ON public.missed_calls
    FOR SELECT
    USING (auth.uid() = caller_id);

-- System can create missed calls
CREATE POLICY "Service role can create missed calls" ON public.missed_calls
    FOR INSERT
    WITH CHECK (true);

-- Users can mark their own missed calls as seen
CREATE POLICY "Users can update their missed calls" ON public.missed_calls
    FOR UPDATE
    USING (auth.uid() = callee_id);

-- 13. RLS Policies for call_attempts
ALTER TABLE public.call_attempts ENABLE ROW LEVEL SECURITY;

-- Users can view their own call attempts
CREATE POLICY "Users can view their call attempts" ON public.call_attempts
    FOR SELECT
    USING (auth.uid() = caller_id OR auth.uid() = callee_id);

-- System can create call attempts
CREATE POLICY "Service role can create call attempts" ON public.call_attempts
    FOR INSERT
    WITH CHECK (true);

-- System can update call attempts
CREATE POLICY "Service role can update call attempts" ON public.call_attempts
    FOR UPDATE
    USING (true);

-- 14. Add trigger to automatically create missed call when call attempt fails
CREATE OR REPLACE FUNCTION public.handle_missed_call()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NEW.status = 'missed' AND OLD.status != 'missed' THEN
        -- Create missed call entry
        INSERT INTO public.missed_calls (caller_id, callee_id, call_type, call_id, attempted_at)
        VALUES (NEW.caller_id, NEW.callee_id, NEW.call_type, NEW.call_id, NEW.started_at);
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_create_missed_call
    AFTER UPDATE ON public.call_attempts
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_missed_call();

-- 15. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_presence_online_users
    ON public.user_presence(status, last_seen DESC)
    WHERE status IN ('online', 'away', 'busy');

-- 16. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT ON public.user_presence TO authenticated, anon;
GRANT SELECT ON public.missed_calls TO authenticated;
GRANT SELECT ON public.call_attempts TO authenticated;

GRANT EXECUTE ON FUNCTION public.update_user_presence TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_online_users TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_missed_call TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_missed_call_seen TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_unseen_missed_calls_count TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_missed_calls_for_user TO authenticated;

-- ==========================================
-- Migration complete!
-- ==========================================

-- To run this migration:
-- 1. Run this SQL in your Supabase SQL Editor
-- 2. The system will automatically create all tables, functions, and policies
-- 3. Users will have real-time presence tracking
-- 4. Missed calls will be automatically recorded when users are offline
