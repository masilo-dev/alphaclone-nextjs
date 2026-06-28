-- Worker Activity Tracking System
-- Tracks what workers are doing inside the "bolt apps"
-- This enables managers to see real-time worker activity

-- Main table for tracking worker sessions and activities
CREATE TABLE IF NOT EXISTS public.worker_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Session info
    session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_end TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    
    -- App/Module being used (the "bolt app")
    app_name VARCHAR(100) NOT NULL, -- 'crm', 'leads', 'finance', 'calendar', etc.
    module_name VARCHAR(100), -- 'deals', 'contacts', 'invoices', etc.
    
    -- Activity tracking
    action_type VARCHAR(50) NOT NULL, -- 'view', 'create', 'edit', 'delete', 'export', etc.
    entity_type VARCHAR(50), -- 'lead', 'deal', 'contact', 'invoice', etc.
    entity_id UUID, -- Reference to the actual record
    
    -- Context
    page_path TEXT,
    metadata JSONB DEFAULT '{}', -- Flexible additional data
    
    -- Performance/engagement
    clicks_count INTEGER DEFAULT 0,
    keystrokes_count INTEGER DEFAULT 0,
    idle_seconds INTEGER DEFAULT 0,
    
    -- Device info (for remote workers)
    device_type VARCHAR(20),
    browser VARCHAR(50),
    ip_address INET,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_worker_sessions_tenant_user ON public.worker_sessions(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_worker_sessions_app ON public.worker_sessions(tenant_id, app_name);
CREATE INDEX IF NOT EXISTS idx_worker_sessions_time ON public.worker_sessions(session_start DESC);
CREATE INDEX IF NOT EXISTS idx_worker_sessions_active ON public.worker_sessions(session_end IS NULL) WHERE session_end IS NULL;

-- Real-time activity view (active workers now)
CREATE OR REPLACE VIEW public.active_workers AS
SELECT 
    ws.tenant_id,
    ws.user_id,
    p.email as user_email,
    p.raw_user_meta_data->>'full_name' as user_name,
    ws.app_name,
    ws.module_name,
    ws.action_type,
    ws.entity_type,
    ws.session_start,
    EXTRACT(EPOCH FROM (NOW() - ws.session_start))/60 as session_minutes,
    ws.clicks_count,
    ws.metadata,
    ws.device_type,
    ws.ip_address
FROM public.worker_sessions ws
LEFT JOIN auth.users u ON ws.user_id = u.id
LEFT JOIN public.profiles p ON ws.user_id = p.id
WHERE ws.session_end IS NULL
AND ws.session_start > NOW() - INTERVAL '8 hours';

-- Daily activity summary view
CREATE OR REPLACE VIEW public.worker_daily_summary AS
SELECT 
    tenant_id,
    user_id,
    DATE(session_start) as work_date,
    app_name,
    COUNT(*) as total_activities,
    COUNT(DISTINCT entity_id) as unique_entities_touched,
    SUM(duration_seconds) as total_active_seconds,
    SUM(clicks_count) as total_clicks,
    MAX(session_start) as last_active_at
FROM public.worker_sessions
WHERE session_start > NOW() - INTERVAL '30 days'
GROUP BY tenant_id, user_id, DATE(session_start), app_name;

-- Enable RLS
ALTER TABLE public.worker_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "worker_sessions_tenant_isolation" ON public.worker_sessions;
CREATE POLICY "worker_sessions_tenant_isolation" ON public.worker_sessions
    FOR ALL USING (tenant_id = (SELECT tenant_id FROM public.get_tenant_context()));

DROP POLICY IF EXISTS "worker_sessions_admin_view_all" ON public.worker_sessions;
CREATE POLICY "worker_sessions_admin_view_all" ON public.worker_sessions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE id = auth.uid() 
            AND (role = 'admin' OR role = 'owner')
        )
    );

-- Realtime for live worker tracking
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'worker_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.worker_sessions;
  END IF;
END $$;

-- Function to log worker activity (called from frontend)
CREATE OR REPLACE FUNCTION public.log_worker_activity(
    p_tenant_id UUID,
    p_user_id UUID,
    p_app_name VARCHAR(100),
    p_module_name VARCHAR(100),
    p_action_type VARCHAR(50),
    p_entity_type VARCHAR(50) DEFAULT NULL,
    p_entity_id UUID DEFAULT NULL,
    p_page_path TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}',
    p_device_type VARCHAR(20) DEFAULT NULL,
    p_browser VARCHAR(50) DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session_id UUID;
    v_last_session UUID;
BEGIN
    -- Find recent active session (within 5 minutes, same app)
    SELECT id INTO v_last_session
    FROM public.worker_sessions
    WHERE tenant_id = p_tenant_id
    AND user_id = p_user_id
    AND app_name = p_app_name
    AND session_end IS NULL
    AND updated_at > NOW() - INTERVAL '5 minutes'
    ORDER BY updated_at DESC
    LIMIT 1;
    
    IF v_last_session IS NOT NULL THEN
        -- Update existing session
        UPDATE public.worker_sessions
        SET 
            action_type = p_action_type,
            entity_type = COALESCE(p_entity_type, entity_type),
            entity_id = COALESCE(p_entity_id, entity_id),
            module_name = COALESCE(p_module_name, module_name),
            page_path = COALESCE(p_page_path, page_path),
            metadata = metadata || p_metadata,
            clicks_count = clicks_count + 1,
            updated_at = NOW()
        WHERE id = v_last_session;
        
        RETURN v_last_session;
    ELSE
        -- Close old sessions
        UPDATE public.worker_sessions
        SET 
            session_end = NOW(),
            duration_seconds = EXTRACT(EPOCH FROM (NOW() - session_start))::INTEGER
        WHERE tenant_id = p_tenant_id
        AND user_id = p_user_id
        AND session_end IS NULL;
        
        -- Create new session
        INSERT INTO public.worker_sessions (
            tenant_id, user_id, app_name, module_name, action_type,
            entity_type, entity_id, page_path, metadata,
            device_type, browser
        ) VALUES (
            p_tenant_id, p_user_id, p_app_name, p_module_name, p_action_type,
            p_entity_type, p_entity_id, p_page_path, p_metadata,
            p_device_type, p_browser
        )
        RETURNING id INTO v_session_id;
        
        RETURN v_session_id;
    END IF;
END;
$$;

-- Function to end worker session (on logout/tab close)
CREATE OR REPLACE FUNCTION public.end_worker_session(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.worker_sessions
    SET 
        session_end = NOW(),
        duration_seconds = EXTRACT(EPOCH FROM (NOW() - session_start))::INTEGER,
        updated_at = NOW()
    WHERE id = p_session_id;
END;
$$;

-- Function to get worker productivity score
CREATE OR REPLACE FUNCTION public.get_worker_productivity(
    p_tenant_id UUID,
    p_user_id UUID,
    p_start_date DATE DEFAULT CURRENT_DATE - 7,
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    work_date DATE,
    total_activities BIGINT,
    unique_apps BIGINT,
    entities_touched BIGINT,
    active_hours NUMERIC,
    productivity_score INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE(ws.session_start) as work_date,
        COUNT(*) as total_activities,
        COUNT(DISTINCT ws.app_name) as unique_apps,
        COUNT(DISTINCT ws.entity_id) as entities_touched,
        ROUND(SUM(ws.duration_seconds)/3600.0, 2) as active_hours,
        -- Simple productivity score: activities per hour * diversity bonus
        LEAST(100, (
            (COUNT(*)::NUMERIC / NULLIF(SUM(ws.duration_seconds)/3600.0, 0)) * 5 +
            COUNT(DISTINCT ws.app_name) * 10
        ))::INTEGER as productivity_score
    FROM public.worker_sessions ws
    WHERE ws.tenant_id = p_tenant_id
    AND ws.user_id = p_user_id
    AND DATE(ws.session_start) BETWEEN p_start_date AND p_end_date
    GROUP BY DATE(ws.session_start)
    ORDER BY work_date DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_worker_activity TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_worker_session TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_worker_productivity TO authenticated;
GRANT SELECT ON public.active_workers TO authenticated;
GRANT SELECT ON public.worker_daily_summary TO authenticated;
