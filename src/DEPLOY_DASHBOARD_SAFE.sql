-- Dashboard Improvements Migration (Idempotent)
-- Only creates tables/columns if they don't exist

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT,
    read BOOLEAN DEFAULT false,
    link TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notifications_user_id') THEN
        CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_notifications_read') THEN
        CREATE INDEX idx_notifications_read ON public.notifications(read);
    END IF;
END $$;

-- ============================================
-- ACTIVITY LOGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_activity_logs_user_id') THEN
        CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_activity_logs_created_at') THEN
        CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
    END IF;
END $$;

-- ============================================
-- FAVORITES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, entity_type, entity_id)
);

-- Add index if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_favorites_user_id') THEN
        CREATE INDEX idx_favorites_user_id ON public.favorites(user_id);
    END IF;
END $$;

-- ============================================
-- USER PREFERENCES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    theme TEXT DEFAULT 'dark',
    notifications_enabled BOOLEAN DEFAULT true,
    email_notifications BOOLEAN DEFAULT true,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_user_preferences_user_id') THEN
        CREATE INDEX idx_user_preferences_user_id ON public.user_preferences(user_id);
    END IF;
END $$;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DO $$
BEGIN
    -- Notifications policies
    DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
    CREATE POLICY "Users can view their own notifications"
        ON public.notifications FOR SELECT
        USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can insert their own notifications" ON public.notifications;
    CREATE POLICY "Users can insert their own notifications"
        ON public.notifications FOR INSERT
        WITH CHECK (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
    CREATE POLICY "Users can update their own notifications"
        ON public.notifications FOR UPDATE
        USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
    CREATE POLICY "Users can delete their own notifications"
        ON public.notifications FOR DELETE
        USING (auth.uid() = user_id);

    -- Activity logs policies
    DROP POLICY IF EXISTS "Users can view their own activity logs" ON public.activity_logs;
    CREATE POLICY "Users can view their own activity logs"
        ON public.activity_logs FOR SELECT
        USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can insert their own activity logs" ON public.activity_logs;
    CREATE POLICY "Users can insert their own activity logs"
        ON public.activity_logs FOR INSERT
        WITH CHECK (auth.uid() = user_id);

    -- Favorites policies
    DROP POLICY IF EXISTS "Users can view their own favorites" ON public.favorites;
    CREATE POLICY "Users can view their own favorites"
        ON public.favorites FOR SELECT
        USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can insert their own favorites" ON public.favorites;
    CREATE POLICY "Users can insert their own favorites"
        ON public.favorites FOR INSERT
        WITH CHECK (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can delete their own favorites" ON public.favorites;
    CREATE POLICY "Users can delete their own favorites"
        ON public.favorites FOR DELETE
        USING (auth.uid() = user_id);

    -- User preferences policies
    DROP POLICY IF EXISTS "Users can view their own preferences" ON public.user_preferences;
    CREATE POLICY "Users can view their own preferences"
        ON public.user_preferences FOR SELECT
        USING (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.user_preferences;
    CREATE POLICY "Users can insert their own preferences"
        ON public.user_preferences FOR INSERT
        WITH CHECK (auth.uid() = user_id);
    
    DROP POLICY IF EXISTS "Users can update their own preferences" ON public.user_preferences;
    CREATE POLICY "Users can update their own preferences"
        ON public.user_preferences FOR UPDATE
        USING (auth.uid() = user_id);
END $$;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to log activity (idempotent)
CREATE OR REPLACE FUNCTION public.log_activity(
    p_user_id UUID,
    p_action TEXT,
    p_entity_type TEXT DEFAULT NULL,
    p_entity_id TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, metadata)
    VALUES (p_user_id, p_action, p_entity_type, p_entity_id, p_metadata)
    RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- COMPLETION MESSAGE
-- ============================================
DO $$
BEGIN
    RAISE NOTICE 'Dashboard improvements migration completed successfully!';
    RAISE NOTICE 'Tables created/verified: notifications, activity_logs, favorites, user_preferences';
    RAISE NOTICE 'RLS policies applied';
    RAISE NOTICE 'Helper functions created';
END $$;
