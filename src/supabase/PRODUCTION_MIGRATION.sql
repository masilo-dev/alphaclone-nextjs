-- ============================================================================
-- ALPHACLONE SYSTEMS - COMPLETE PRODUCTION DATABASE MIGRATION
-- Version: 2.0 (2026-01-01)
-- This file contains ALL database changes needed for production deployment
-- Safe to run multiple times (idempotent)
-- ============================================================================

-- ============================================================================
-- PART 1: ENUMS AND CUSTOM TYPES
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'client');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE project_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE contract_status AS ENUM ('draft', 'sent', 'signed', 'rejected', 'expired');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- PART 2: CORE TABLES
-- ============================================================================

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role user_role DEFAULT 'client',
    avatar_url TEXT,
    auto_reply_enabled BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects table
CREATE TABLE IF NOT EXISTS public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    owner_name TEXT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    status project_status DEFAULT 'pending',
    current_stage TEXT,
    progress INTEGER DEFAULT 0,
    due_date TIMESTAMPTZ,
    team JSONB DEFAULT '[]'::jsonb,
    image TEXT,
    contract_status contract_status,
    contract_text TEXT,
    is_public BOOLEAN DEFAULT false,
    show_in_portfolio BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    text TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ DEFAULT NULL,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
    attachments JSONB DEFAULT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to existing tables
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS auto_reply_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS owner_name TEXT,
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS show_in_portfolio BOOLEAN DEFAULT false;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT NULL;

-- Add constraints if they don't exist
DO $$ BEGIN
    ALTER TABLE public.messages
    ADD CONSTRAINT messages_priority_check
    CHECK (priority IN ('normal', 'high', 'urgent'));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Contact submissions table
CREATE TABLE IF NOT EXISTS public.contact_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gallery items table
CREATE TABLE IF NOT EXISTS public.gallery_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT NOT NULL,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART 3: SECURITY & TRACKING TABLES
-- ============================================================================

-- Activity logs table
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Login sessions table
CREATE TABLE IF NOT EXISTS public.login_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    login_time TIMESTAMPTZ DEFAULT NOW(),
    logout_time TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    country TEXT,
    city TEXT,
    browser TEXT,
    device_type TEXT,
    duration_seconds INTEGER
);

-- Blocked countries table
CREATE TABLE IF NOT EXISTS public.blocked_countries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code TEXT UNIQUE NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Security alerts table
CREATE TABLE IF NOT EXISTS public.security_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Search history table
CREATE TABLE IF NOT EXISTS public.search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART 4: CALENDAR & VIDEO SYSTEM
-- ============================================================================

-- Calendar Events Table
CREATE TABLE IF NOT EXISTS public.calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    type TEXT CHECK (type IN ('meeting', 'call', 'reminder', 'deadline', 'task')),
    video_room_id TEXT,
    attendees UUID[],
    location TEXT,
    recurrence_rule TEXT,
    color TEXT DEFAULT '#3b82f6',
    is_all_day BOOLEAN DEFAULT FALSE,
    reminder_minutes INTEGER DEFAULT 15,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Video Calls Table (with Daily.co integration)
CREATE TABLE IF NOT EXISTS public.video_calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id TEXT UNIQUE NOT NULL,
    daily_room_url TEXT,
    daily_room_name TEXT,
    host_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    calendar_event_id UUID REFERENCES public.calendar_events(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    status TEXT CHECK (status IN ('scheduled', 'active', 'ended', 'cancelled')) DEFAULT 'scheduled',
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    participants UUID[],
    max_participants INTEGER DEFAULT 10,
    recording_enabled BOOLEAN DEFAULT FALSE,
    recording_url TEXT,
    screen_share_enabled BOOLEAN DEFAULT TRUE,
    chat_enabled BOOLEAN DEFAULT TRUE,
    cancellation_policy_hours INTEGER DEFAULT 3,
    allow_client_cancellation BOOLEAN DEFAULT TRUE,
    cancelled_by UUID REFERENCES public.profiles(id),
    cancelled_at TIMESTAMPTZ,
    cancellation_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add Daily.co columns if they don't exist
ALTER TABLE public.video_calls
ADD COLUMN IF NOT EXISTS daily_room_url TEXT,
ADD COLUMN IF NOT EXISTS daily_room_name TEXT,
ADD COLUMN IF NOT EXISTS cancellation_policy_hours INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS allow_client_cancellation BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Call Participants Table
CREATE TABLE IF NOT EXISTS public.call_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID REFERENCES public.video_calls(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    is_host BOOLEAN DEFAULT FALSE,
    camera_enabled BOOLEAN DEFAULT TRUE,
    microphone_enabled BOOLEAN DEFAULT TRUE,
    screen_sharing BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin Availability Table
CREATE TABLE IF NOT EXISTS public.admin_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(admin_id, day_of_week, start_time)
);

-- ============================================================================
-- PART 5: PAYMENT & CONTRACT SYSTEM
-- ============================================================================

-- Invoices Table
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    stripe_invoice_id TEXT,
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT CHECK (status IN ('draft', 'sent', 'paid', 'void', 'uncollectible')) DEFAULT 'draft',
    due_date TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    description TEXT,
    items JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments Table
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
    stripe_payment_intent_id TEXT,
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')) DEFAULT 'pending',
    payment_method TEXT,
    receipt_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contracts Table
CREATE TABLE IF NOT EXISTS public.contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    status contract_status DEFAULT 'draft',
    content JSONB DEFAULT '{}',
    template_type TEXT DEFAULT 'generic',
    signed_at TIMESTAMPTZ,
    signer_name TEXT,
    signer_email TEXT,
    signature_url TEXT,
    pdf_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contract Templates Table
CREATE TABLE IF NOT EXISTS public.contract_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    content JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART 6: SEO & CONTENT SYSTEM
-- ============================================================================

-- SEO Articles table
CREATE TABLE IF NOT EXISTS public.seo_articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    meta_description TEXT NOT NULL,
    meta_keywords TEXT[],
    content TEXT NOT NULL,
    author TEXT DEFAULT 'AlphaClone Systems',
    category TEXT NOT NULL,
    tags TEXT[],
    published BOOLEAN DEFAULT TRUE,
    featured_image TEXT,
    reading_time INTEGER,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART 7: INDEXES FOR PERFORMANCE
-- ============================================================================

-- Core table indexes
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_portfolio_visibility ON public.projects(is_public, show_in_portfolio, status) WHERE is_public = true AND show_in_portfolio = true;
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON public.messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_read_at ON public.messages(recipient_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);

-- Security & tracking indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_sessions_user_id ON public.login_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_user_id ON public.security_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON public.search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_created_at ON public.search_history(created_at DESC);

-- Calendar & video indexes
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON public.calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time ON public.calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON public.calendar_events(type);
CREATE INDEX IF NOT EXISTS idx_video_calls_room_id ON public.video_calls(room_id);
CREATE INDEX IF NOT EXISTS idx_video_calls_host_id ON public.video_calls(host_id);
CREATE INDEX IF NOT EXISTS idx_video_calls_status ON public.video_calls(status);
CREATE INDEX IF NOT EXISTS idx_video_calls_started_at ON public.video_calls(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_calls_daily_room_name ON public.video_calls(daily_room_name);
CREATE INDEX IF NOT EXISTS idx_video_calls_cancelled_by ON public.video_calls(cancelled_by);
CREATE INDEX IF NOT EXISTS idx_call_participants_call_id ON public.call_participants(call_id);
CREATE INDEX IF NOT EXISTS idx_call_participants_user_id ON public.call_participants(user_id);

-- Payment & contract indexes
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_project_id ON public.invoices(project_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_contracts_user_id ON public.contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_contracts_project_id ON public.contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);

-- SEO indexes
CREATE INDEX IF NOT EXISTS idx_seo_articles_slug ON public.seo_articles(slug);
CREATE INDEX IF NOT EXISTS idx_seo_articles_published ON public.seo_articles(published);
CREATE INDEX IF NOT EXISTS idx_seo_articles_category ON public.seo_articles(category);
CREATE INDEX IF NOT EXISTS idx_seo_articles_created_at ON public.seo_articles(created_at DESC);

-- ============================================================================
-- PART 8: FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate session duration
CREATE OR REPLACE FUNCTION calculate_session_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.logout_time IS NOT NULL AND NEW.login_time IS NOT NULL THEN
        NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.logout_time - NEW.login_time))::INTEGER;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to detect suspicious activity
CREATE OR REPLACE FUNCTION detect_suspicious_activity()
RETURNS TRIGGER AS $$
DECLARE
    recent_logins INTEGER;
    different_countries INTEGER;
BEGIN
    SELECT COUNT(DISTINCT country) INTO different_countries
    FROM public.login_sessions
    WHERE user_id = NEW.user_id
    AND login_time > NOW() - INTERVAL '1 hour';

    IF different_countries > 2 THEN
        INSERT INTO public.security_alerts (user_id, alert_type, severity, description)
        VALUES (
            NEW.user_id,
            'multiple_countries',
            'high',
            'Login detected from multiple countries within 1 hour'
        );
    END IF;

    SELECT COUNT(*) INTO recent_logins
    FROM public.login_sessions
    WHERE user_id = NEW.user_id
    AND login_time > NOW() - INTERVAL '5 minutes';

    IF recent_logins > 5 THEN
        INSERT INTO public.security_alerts (user_id, alert_type, severity, description)
        VALUES (
            NEW.user_id,
            'rapid_logins',
            'medium',
            'Multiple login attempts detected within 5 minutes'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate call duration
CREATE OR REPLACE FUNCTION calculate_call_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
        NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))::INTEGER;
        NEW.status := 'ended';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate participant duration
CREATE OR REPLACE FUNCTION calculate_participant_duration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.left_at IS NOT NULL AND OLD.left_at IS NULL THEN
        NEW.duration_seconds := EXTRACT(EPOCH FROM (NEW.left_at - NEW.joined_at))::INTEGER;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to update invoice status on payment
CREATE OR REPLACE FUNCTION update_invoice_status_on_payment()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'succeeded' AND NEW.invoice_id IS NOT NULL THEN
        UPDATE public.invoices
        SET status = 'paid', paid_at = NOW()
        WHERE id = NEW.invoice_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate reading time
CREATE OR REPLACE FUNCTION calculate_reading_time()
RETURNS TRIGGER AS $$
BEGIN
    NEW.reading_time := CEIL(array_length(regexp_split_to_array(NEW.content, '\s+'), 1) / 200.0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to check if meeting can be cancelled
CREATE OR REPLACE FUNCTION can_cancel_meeting(
    meeting_id UUID,
    user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    meeting_record public.video_calls;
    is_admin BOOLEAN;
    hours_until_meeting INTERVAL;
BEGIN
    SELECT * INTO meeting_record
    FROM public.video_calls
    WHERE id = meeting_id;

    IF meeting_record IS NULL THEN
        RETURN FALSE;
    END IF;

    IF meeting_record.status IN ('cancelled', 'ended') THEN
        RETURN FALSE;
    END IF;

    SELECT role = 'admin' INTO is_admin
    FROM public.profiles
    WHERE id = user_id;

    IF is_admin THEN
        RETURN TRUE;
    END IF;

    IF NOT meeting_record.allow_client_cancellation THEN
        RETURN FALSE;
    END IF;

    IF meeting_record.calendar_event_id IS NOT NULL THEN
        SELECT ce.start_time - NOW() INTO hours_until_meeting
        FROM public.calendar_events ce
        WHERE ce.id = meeting_record.calendar_event_id;

        IF EXTRACT(EPOCH FROM hours_until_meeting) / 3600 < meeting_record.cancellation_policy_hours THEN
            RETURN FALSE;
        END IF;
    END IF;

    RETURN meeting_record.host_id = user_id OR user_id = ANY(meeting_record.participants);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PART 9: TRIGGERS
-- ============================================================================

-- Triggers for updated_at columns
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_calendar_event_timestamp ON public.calendar_events;
CREATE TRIGGER trigger_update_calendar_event_timestamp BEFORE UPDATE ON public.calendar_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_video_call_timestamp ON public.video_calls;
CREATE TRIGGER trigger_update_video_call_timestamp BEFORE UPDATE ON public.video_calls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_invoices_timestamp ON public.invoices;
CREATE TRIGGER trigger_update_invoices_timestamp BEFORE UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_update_contracts_timestamp ON public.contracts;
CREATE TRIGGER trigger_update_contracts_timestamp BEFORE UPDATE ON public.contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_seo_articles_updated_at ON public.seo_articles;
CREATE TRIGGER update_seo_articles_updated_at BEFORE UPDATE ON public.seo_articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Session duration trigger
DROP TRIGGER IF EXISTS calculate_login_session_duration ON public.login_sessions;
CREATE TRIGGER calculate_login_session_duration BEFORE UPDATE ON public.login_sessions
    FOR EACH ROW EXECUTE FUNCTION calculate_session_duration();

-- Suspicious activity detection trigger
DROP TRIGGER IF EXISTS detect_suspicious_login ON public.login_sessions;
CREATE TRIGGER detect_suspicious_login AFTER INSERT ON public.login_sessions
    FOR EACH ROW EXECUTE FUNCTION detect_suspicious_activity();

-- Call duration triggers
DROP TRIGGER IF EXISTS trigger_calculate_call_duration ON public.video_calls;
CREATE TRIGGER trigger_calculate_call_duration BEFORE UPDATE ON public.video_calls
    FOR EACH ROW EXECUTE FUNCTION calculate_call_duration();

DROP TRIGGER IF EXISTS trigger_calculate_participant_duration ON public.call_participants;
CREATE TRIGGER trigger_calculate_participant_duration BEFORE UPDATE ON public.call_participants
    FOR EACH ROW EXECUTE FUNCTION calculate_participant_duration();

-- Invoice status trigger
DROP TRIGGER IF EXISTS trigger_update_invoice_status ON public.payments;
CREATE TRIGGER trigger_update_invoice_status AFTER INSERT OR UPDATE ON public.payments
    FOR EACH ROW EXECUTE FUNCTION update_invoice_status_on_payment();

-- Reading time trigger
DROP TRIGGER IF EXISTS update_reading_time ON public.seo_articles;
CREATE TRIGGER update_reading_time BEFORE INSERT OR UPDATE ON public.seo_articles
    FOR EACH ROW EXECUTE FUNCTION calculate_reading_time();

-- ============================================================================
-- PART 10: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seo_articles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view all profiles" ON public.profiles
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id OR auth.uid() IS NULL);

-- Projects policies
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
CREATE POLICY "Users can view own projects" ON public.projects
    FOR SELECT USING (
        auth.uid() = owner_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "Anyone can view public portfolio projects" ON public.projects;
CREATE POLICY "Anyone can view public portfolio projects" ON public.projects
    FOR SELECT USING (is_public = true AND show_in_portfolio = true);

DROP POLICY IF EXISTS "Users can create own projects" ON public.projects;
CREATE POLICY "Users can create own projects" ON public.projects
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
CREATE POLICY "Users can update own projects" ON public.projects
    FOR UPDATE USING (
        auth.uid() = owner_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
CREATE POLICY "Users can delete own projects" ON public.projects
    FOR DELETE USING (
        auth.uid() = owner_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Messages policies
DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
CREATE POLICY "Users can view own messages" ON public.messages
    FOR SELECT USING (
        auth.uid() = sender_id OR
        auth.uid() = recipient_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users can send messages" ON public.messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
CREATE POLICY "Users can update own messages" ON public.messages
    FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

-- Contact submissions policies
DROP POLICY IF EXISTS "Anyone can submit contact form" ON public.contact_submissions;
CREATE POLICY "Anyone can submit contact form" ON public.contact_submissions
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view contact submissions" ON public.contact_submissions;
CREATE POLICY "Admins can view contact submissions" ON public.contact_submissions
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Gallery policies
DROP POLICY IF EXISTS "Anyone can view gallery" ON public.gallery_items;
CREATE POLICY "Anyone can view gallery" ON public.gallery_items
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage gallery" ON public.gallery_items;
CREATE POLICY "Admins can manage gallery" ON public.gallery_items
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Notifications policies
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
CREATE POLICY "System can create notifications" ON public.notifications
    FOR INSERT WITH CHECK (true);

-- Activity logs policies
DROP POLICY IF EXISTS "Users can view own activity logs" ON public.activity_logs;
CREATE POLICY "Users can view own activity logs" ON public.activity_logs
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "System can create activity logs" ON public.activity_logs;
CREATE POLICY "System can create activity logs" ON public.activity_logs
    FOR INSERT WITH CHECK (true);

-- Login sessions policies
DROP POLICY IF EXISTS "Users can view own login sessions" ON public.login_sessions;
CREATE POLICY "Users can view own login sessions" ON public.login_sessions
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "System can manage login sessions" ON public.login_sessions;
CREATE POLICY "System can manage login sessions" ON public.login_sessions
    FOR ALL USING (true);

-- Blocked countries policies
DROP POLICY IF EXISTS "Admins can manage blocked countries" ON public.blocked_countries;
CREATE POLICY "Admins can manage blocked countries" ON public.blocked_countries
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Security alerts policies
DROP POLICY IF EXISTS "Users can view own security alerts" ON public.security_alerts;
CREATE POLICY "Users can view own security alerts" ON public.security_alerts
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "System can create security alerts" ON public.security_alerts;
CREATE POLICY "System can create security alerts" ON public.security_alerts
    FOR INSERT WITH CHECK (true);

-- Search history policies
DROP POLICY IF EXISTS "Users can view their own search history" ON public.search_history;
CREATE POLICY "Users can view their own search history" ON public.search_history
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own search history" ON public.search_history;
CREATE POLICY "Users can insert their own search history" ON public.search_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all search history" ON public.search_history;
CREATE POLICY "Admins can view all search history" ON public.search_history
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Calendar events policies
DROP POLICY IF EXISTS "Users can view their own events" ON public.calendar_events;
CREATE POLICY "Users can view their own events" ON public.calendar_events
    FOR SELECT USING (
        auth.uid() = user_id OR
        auth.uid() = ANY(attendees) OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "Users can create their own events" ON public.calendar_events;
CREATE POLICY "Users can create their own events" ON public.calendar_events
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own events" ON public.calendar_events;
CREATE POLICY "Users can update their own events" ON public.calendar_events
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own events" ON public.calendar_events;
CREATE POLICY "Users can delete their own events" ON public.calendar_events
    FOR DELETE USING (auth.uid() = user_id);

-- Video calls policies
DROP POLICY IF EXISTS "Users can view calls they're part of" ON public.video_calls;
CREATE POLICY "Users can view calls they're part of" ON public.video_calls
    FOR SELECT USING (
        auth.uid() = host_id OR
        auth.uid() = ANY(participants) OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "Users can create calls" ON public.video_calls;
CREATE POLICY "Users can create calls" ON public.video_calls
    FOR INSERT WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Hosts can update their calls" ON public.video_calls;
CREATE POLICY "Hosts can update their calls" ON public.video_calls
    FOR UPDATE USING (
        auth.uid() = host_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "Hosts can delete their calls" ON public.video_calls;
CREATE POLICY "Hosts can delete their calls" ON public.video_calls
    FOR DELETE USING (auth.uid() = host_id);

-- Call participants policies
DROP POLICY IF EXISTS "Users can view their own participation" ON public.call_participants;
CREATE POLICY "Users can view their own participation" ON public.call_participants
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "System can manage participants" ON public.call_participants;
CREATE POLICY "System can manage participants" ON public.call_participants
    FOR ALL USING (true) WITH CHECK (true);

-- Admin availability policies
DROP POLICY IF EXISTS "Everyone can view admin availability" ON public.admin_availability;
CREATE POLICY "Everyone can view admin availability" ON public.admin_availability
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only admins can manage their availability" ON public.admin_availability;
CREATE POLICY "Only admins can manage their availability" ON public.admin_availability
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = admin_availability.admin_id
            AND profiles.role = 'admin'
            AND profiles.id = auth.uid()
        )
    );

-- Invoices policies
DROP POLICY IF EXISTS "Users can view their own invoices" ON public.invoices;
CREATE POLICY "Users can view their own invoices" ON public.invoices
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "Admins can manage invoices" ON public.invoices;
CREATE POLICY "Admins can manage invoices" ON public.invoices
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Payments policies
DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;
CREATE POLICY "Users can view their own payments" ON public.payments
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "System can manage payments" ON public.payments;
CREATE POLICY "System can manage payments" ON public.payments
    FOR ALL USING (true) WITH CHECK (true);

-- Contracts policies
DROP POLICY IF EXISTS "Users can view their own contracts" ON public.contracts;
CREATE POLICY "Users can view their own contracts" ON public.contracts
    FOR SELECT USING (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "Admins can manage contracts" ON public.contracts;
CREATE POLICY "Admins can manage contracts" ON public.contracts
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Contract templates policies
DROP POLICY IF EXISTS "Everyone can view active templates" ON public.contract_templates;
CREATE POLICY "Everyone can view active templates" ON public.contract_templates
    FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage templates" ON public.contract_templates;
CREATE POLICY "Admins can manage templates" ON public.contract_templates
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- SEO articles policies
DROP POLICY IF EXISTS "Anyone can view published articles" ON public.seo_articles;
CREATE POLICY "Anyone can view published articles" ON public.seo_articles
    FOR SELECT USING (published = true);

DROP POLICY IF EXISTS "Admins can manage articles" ON public.seo_articles;
CREATE POLICY "Admins can manage articles" ON public.seo_articles
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- ============================================================================
-- PART 11: STORAGE BUCKETS
-- ============================================================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('project-files', 'project-files', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('gallery', 'gallery', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
CREATE POLICY "Users can upload own avatar" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'avatars' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
CREATE POLICY "Users can update own avatar" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'avatars' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "Users can delete own avatar" ON storage.objects;
CREATE POLICY "Users can delete own avatar" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'avatars' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- Storage policies for project files
DROP POLICY IF EXISTS "Users can view own project files" ON storage.objects;
CREATE POLICY "Users can view own project files" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'project-files' AND (
            auth.uid()::text = (storage.foldername(name))[1] OR
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        )
    );

DROP POLICY IF EXISTS "Users can upload project files" ON storage.objects;
CREATE POLICY "Users can upload project files" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'project-files' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

DROP POLICY IF EXISTS "Users can update own project files" ON storage.objects;
CREATE POLICY "Users can update own project files" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'project-files' AND (
            auth.uid()::text = (storage.foldername(name))[1] OR
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        )
    );

DROP POLICY IF EXISTS "Users can delete own project files" ON storage.objects;
CREATE POLICY "Users can delete own project files" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'project-files' AND (
            auth.uid()::text = (storage.foldername(name))[1] OR
            EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
        )
    );

-- Storage policies for gallery
DROP POLICY IF EXISTS "Gallery images are publicly accessible" ON storage.objects;
CREATE POLICY "Gallery images are publicly accessible" ON storage.objects
    FOR SELECT USING (bucket_id = 'gallery');

DROP POLICY IF EXISTS "Admins can manage gallery images" ON storage.objects;
CREATE POLICY "Admins can manage gallery images" ON storage.objects
    FOR ALL USING (
        bucket_id = 'gallery' AND
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Storage policies for chat attachments
DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload chat attachments" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'chat-attachments' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can view chat attachments" ON storage.objects;
CREATE POLICY "Authenticated users can view chat attachments" ON storage.objects
    FOR SELECT USING (bucket_id = 'chat-attachments' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;
CREATE POLICY "Users can delete their own attachments" ON storage.objects
    FOR DELETE USING (bucket_id = 'chat-attachments' AND auth.uid() = owner);

-- ============================================================================
-- PART 12: DATA MIGRATIONS
-- ============================================================================

-- Update existing video_calls to use Daily.co naming
UPDATE public.video_calls
SET daily_room_name = room_id
WHERE daily_room_name IS NULL;

-- Update existing completed/active projects to show in portfolio
-- Works with both old (Completed/Active) and new (completed) enum values
UPDATE public.projects
SET
    is_public = true,
    show_in_portfolio = true
WHERE
    status::text IN ('completed', 'Completed', 'Active')
    AND (is_public IS NULL OR show_in_portfolio IS NULL);

-- ============================================================================
-- PART 13: VERIFICATION & SUCCESS MESSAGE
-- ============================================================================

-- Verify tables were created
SELECT
    'Table Count' as check_type,
    COUNT(*) as count
FROM pg_tables
WHERE schemaname = 'public'
UNION ALL
SELECT
    'Index Count' as check_type,
    COUNT(*) as count
FROM pg_indexes
WHERE schemaname = 'public'
UNION ALL
SELECT
    'Function Count' as check_type,
    COUNT(*) as count
FROM pg_proc
WHERE pronamespace = 'public'::regnamespace
UNION ALL
SELECT
    'Storage Bucket Count' as check_type,
    COUNT(*) as count
FROM storage.buckets;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '✅ ALL MIGRATIONS APPLIED SUCCESSFULLY!';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE '📊 Database Schema: READY FOR PRODUCTION';
    RAISE NOTICE '🔒 RLS Policies: ACTIVE ON ALL TABLES';
    RAISE NOTICE '📁 Storage Buckets: CONFIGURED';
    RAISE NOTICE '🛡️ Security Tracking: ENABLED';
    RAISE NOTICE '📅 Calendar System: DEPLOYED';
    RAISE NOTICE '📹 Video Calls (Daily.co): INTEGRATED';
    RAISE NOTICE '💳 Payment System: READY';
    RAISE NOTICE '📄 Contract System: READY';
    RAISE NOTICE '📝 SEO Articles: READY';
    RAISE NOTICE '🎨 Portfolio System: READY';
    RAISE NOTICE '💬 Messaging (Attachments & Receipts): READY';
    RAISE NOTICE '🔍 Search History: ENABLED';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Database Version: 2.0 (2026-01-01)';
    RAISE NOTICE 'Ready for: alphaclone.daily.co integration';
    RAISE NOTICE '============================================================================';
END $$;
