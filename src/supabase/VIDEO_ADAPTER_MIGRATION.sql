-- =====================================================
-- VIDEO ADAPTER MIGRATION
-- Purpose: Hide Daily.co backend with adapter layer
-- Features: Single-use links, 40-minute limits, AlphaClone URLs
-- =====================================================

-- Create meeting_links table for single-use token management
CREATE TABLE IF NOT EXISTS public.meeting_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    meeting_id UUID NOT NULL REFERENCES public.video_calls(id) ON DELETE CASCADE,
    link_token VARCHAR(64) UNIQUE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP,
    used_by UUID REFERENCES public.profiles(id),
    expires_at TIMESTAMP NOT NULL,
    max_uses INTEGER DEFAULT 1,
    use_count INTEGER DEFAULT 0,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Constraints
    CONSTRAINT use_count_within_max CHECK (use_count <= max_uses),
    CONSTRAINT expires_at_in_future CHECK (expires_at > created_at)
);

-- Indexes for meeting_links
CREATE INDEX IF NOT EXISTS idx_meeting_links_token ON public.meeting_links(link_token);
CREATE INDEX IF NOT EXISTS idx_meeting_links_meeting_id ON public.meeting_links(meeting_id);
CREATE INDEX IF NOT EXISTS idx_meeting_links_expires_at ON public.meeting_links(expires_at);
CREATE INDEX IF NOT EXISTS idx_meeting_links_used ON public.meeting_links(used);
CREATE INDEX IF NOT EXISTS idx_meeting_links_created_by ON public.meeting_links(created_by);

-- Add new columns to video_calls for 40-minute enforcement
ALTER TABLE public.video_calls
ADD COLUMN IF NOT EXISTS duration_limit_minutes INTEGER DEFAULT 40,
ADD COLUMN IF NOT EXISTS auto_end_scheduled_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS ended_reason VARCHAR(50);

-- Add check constraint for duration_limit_minutes (safe to run multiple times)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'duration_limit_max'
        AND conrelid = 'public.video_calls'::regclass
    ) THEN
        ALTER TABLE public.video_calls
        ADD CONSTRAINT duration_limit_max CHECK (duration_limit_minutes <= 40);
    END IF;
END $$;

-- Add comment explaining the fields
COMMENT ON COLUMN public.video_calls.duration_limit_minutes IS 'Maximum meeting duration (default and max: 40 minutes)';
COMMENT ON COLUMN public.video_calls.auto_end_scheduled_at IS 'Timestamp when meeting should auto-end (40 minutes from start)';
COMMENT ON COLUMN public.video_calls.ended_reason IS 'Reason meeting ended: manual, time_limit, all_left, cancelled';

-- =====================================================
-- RLS POLICIES FOR meeting_links
-- =====================================================

-- Enable RLS
ALTER TABLE public.meeting_links ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (safe to run multiple times)
DROP POLICY IF EXISTS "Users can view own meeting links" ON public.meeting_links;
DROP POLICY IF EXISTS "Users can create meeting links" ON public.meeting_links;
DROP POLICY IF EXISTS "Users can update own meeting links" ON public.meeting_links;
DROP POLICY IF EXISTS "Users can delete own meeting links" ON public.meeting_links;

-- Users can view meeting links they created
CREATE POLICY "Users can view own meeting links" ON public.meeting_links
    FOR SELECT USING (
        auth.uid() = created_by OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Users can create meeting links for their own meetings
CREATE POLICY "Users can create meeting links" ON public.meeting_links
    FOR INSERT WITH CHECK (
        auth.uid() = created_by AND
        EXISTS (
            SELECT 1 FROM public.video_calls
            WHERE id = meeting_links.meeting_id
            AND (host_id = auth.uid() OR EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND role = 'admin'
            ))
        )
    );

-- Users can update meeting links they created (for marking as used)
CREATE POLICY "Users can update own meeting links" ON public.meeting_links
    FOR UPDATE USING (
        auth.uid() = created_by OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Users can delete meeting links they created
CREATE POLICY "Users can delete own meeting links" ON public.meeting_links
    FOR DELETE USING (
        auth.uid() = created_by OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to check if a meeting link is valid
CREATE OR REPLACE FUNCTION public.is_meeting_link_valid(
    p_token VARCHAR(64)
)
RETURNS TABLE (
    valid BOOLEAN,
    reason TEXT,
    meeting_id UUID,
    meeting_title TEXT,
    host_name TEXT,
    expires_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        CASE
            WHEN ml.id IS NULL THEN FALSE
            WHEN ml.expires_at < NOW() THEN FALSE
            WHEN ml.use_count >= ml.max_uses THEN FALSE
            ELSE TRUE
        END AS valid,
        CASE
            WHEN ml.id IS NULL THEN 'Link not found'
            WHEN ml.expires_at < NOW() THEN 'Link expired'
            WHEN ml.use_count >= ml.max_uses THEN 'Link already used'
            ELSE 'Valid'
        END AS reason,
        ml.meeting_id,
        vc.title AS meeting_title,
        p.name AS host_name,
        ml.expires_at
    FROM public.meeting_links ml
    LEFT JOIN public.video_calls vc ON ml.meeting_id = vc.id
    LEFT JOIN public.profiles p ON vc.host_id = p.id
    WHERE ml.link_token = p_token
    LIMIT 1;

    -- If no rows, return invalid with not found reason
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT FALSE, 'Link not found'::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMP;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark meeting link as used
CREATE OR REPLACE FUNCTION public.mark_meeting_link_used(
    p_token VARCHAR(64),
    p_user_id UUID
)
RETURNS TABLE (
    success BOOLEAN,
    error_message TEXT,
    meeting_id UUID,
    daily_room_url TEXT
) AS $$
DECLARE
    v_meeting_link_id UUID;
    v_meeting_id UUID;
    v_use_count INTEGER;
    v_max_uses INTEGER;
    v_daily_url TEXT;
BEGIN
    -- Get meeting link details
    SELECT ml.id, ml.meeting_id, ml.use_count, ml.max_uses
    INTO v_meeting_link_id, v_meeting_id, v_use_count, v_max_uses
    FROM public.meeting_links ml
    WHERE ml.link_token = p_token
    AND ml.expires_at > NOW()
    FOR UPDATE; -- Lock the row

    -- Check if link exists
    IF v_meeting_link_id IS NULL THEN
        RETURN QUERY SELECT FALSE, 'Meeting link not found or expired'::TEXT, NULL::UUID, NULL::TEXT;
        RETURN;
    END IF;

    -- Check if already used up
    IF v_use_count >= v_max_uses THEN
        RETURN QUERY SELECT FALSE, 'Meeting link already used'::TEXT, NULL::UUID, NULL::TEXT;
        RETURN;
    END IF;

    -- Get Daily.co room URL
    SELECT daily_room_url INTO v_daily_url
    FROM public.video_calls
    WHERE id = v_meeting_id;

    -- Mark as used
    UPDATE public.meeting_links
    SET
        use_count = use_count + 1,
        used = (use_count + 1 >= max_uses),
        used_at = CASE WHEN use_count = 0 THEN NOW() ELSE used_at END,
        used_by = CASE WHEN use_count = 0 THEN p_user_id ELSE used_by END
    WHERE id = v_meeting_link_id;

    -- Return success with meeting details
    RETURN QUERY SELECT TRUE, NULL::TEXT, v_meeting_id, v_daily_url;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if meeting time limit exceeded
CREATE OR REPLACE FUNCTION public.check_meeting_time_limit(
    p_meeting_id UUID
)
RETURNS TABLE (
    exceeded BOOLEAN,
    time_remaining_seconds INTEGER,
    auto_end_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        CASE
            WHEN vc.auto_end_scheduled_at IS NULL THEN FALSE
            WHEN vc.auto_end_scheduled_at < NOW() THEN TRUE
            ELSE FALSE
        END AS exceeded,
        CASE
            WHEN vc.auto_end_scheduled_at IS NULL THEN NULL
            WHEN vc.auto_end_scheduled_at < NOW() THEN 0
            ELSE EXTRACT(EPOCH FROM (vc.auto_end_scheduled_at - NOW()))::INTEGER
        END AS time_remaining_seconds,
        vc.auto_end_scheduled_at AS auto_end_at
    FROM public.video_calls vc
    WHERE vc.id = p_meeting_id
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-expire old meeting links (cleanup job)
CREATE OR REPLACE FUNCTION public.cleanup_expired_meeting_links()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Delete meeting links that expired more than 7 days ago
    DELETE FROM public.meeting_links
    WHERE expires_at < NOW() - INTERVAL '7 days';

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger to automatically set auto_end_scheduled_at when meeting starts
CREATE OR REPLACE FUNCTION public.set_meeting_auto_end()
RETURNS TRIGGER AS $$
BEGIN
    -- When status changes to 'active' and started_at is set
    IF NEW.status = 'active' AND NEW.started_at IS NOT NULL AND OLD.started_at IS NULL THEN
        NEW.auto_end_scheduled_at := NEW.started_at + (COALESCE(NEW.duration_limit_minutes, 40) || ' minutes')::INTERVAL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_meeting_auto_end ON public.video_calls;
CREATE TRIGGER trigger_set_meeting_auto_end
    BEFORE UPDATE ON public.video_calls
    FOR EACH ROW
    EXECUTE FUNCTION public.set_meeting_auto_end();

-- =====================================================
-- GUEST PARTICIPANTS TABLE
-- Tracks external guests joining via permanent room links
-- =====================================================

CREATE TABLE IF NOT EXISTS public.guest_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    room_id TEXT NOT NULL,
    room_url TEXT,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    left_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for guest_participants
CREATE INDEX IF NOT EXISTS idx_guest_participants_room_id ON public.guest_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_guest_participants_joined_at ON public.guest_participants(joined_at DESC);

-- Enable RLS but allow open access (business-friendly for guest tracking)
ALTER TABLE public.guest_participants ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (safe to run multiple times)
DROP POLICY IF EXISTS "Anyone can register as guest" ON public.guest_participants;
DROP POLICY IF EXISTS "Anyone can view guests" ON public.guest_participants;

-- Allow anyone to insert (guests joining)
CREATE POLICY "Anyone can register as guest"
    ON public.guest_participants FOR INSERT
    WITH CHECK (true);

-- Allow anyone to read (see who's in meeting)
CREATE POLICY "Anyone can view guests"
    ON public.guest_participants FOR SELECT
    USING (true);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_guest_participants_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_guest_participants_updated_at ON public.guest_participants;
CREATE TRIGGER trigger_update_guest_participants_updated_at
    BEFORE UPDATE ON public.guest_participants
    FOR EACH ROW
    EXECUTE FUNCTION update_guest_participants_updated_at();

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant execute permissions on functions to authenticated users
GRANT EXECUTE ON FUNCTION public.is_meeting_link_valid(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_meeting_link_used(VARCHAR, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_meeting_time_limit(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_meeting_links() TO authenticated;

-- Grant permissions on guest_participants table (allow anonymous access for public meetings)
GRANT ALL ON public.guest_participants TO anon;
GRANT ALL ON public.guest_participants TO authenticated;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Run these queries to verify the migration worked:

-- 1. Check if meeting_links table exists
-- SELECT EXISTS (
--     SELECT FROM information_schema.tables
--     WHERE table_schema = 'public'
--     AND table_name = 'meeting_links'
-- );

-- 2. Check if new columns added to video_calls
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
-- AND table_name = 'video_calls'
-- AND column_name IN ('duration_limit_minutes', 'auto_end_scheduled_at', 'ended_reason');

-- 3. Test is_meeting_link_valid function
-- SELECT * FROM public.is_meeting_link_valid('test-token-123');

-- 4. Check RLS policies
-- SELECT * FROM pg_policies WHERE schemaname = 'public' AND tablename = 'meeting_links';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
