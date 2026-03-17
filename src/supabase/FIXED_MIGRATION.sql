-- ============================================================================
-- ALPHACLONE SYSTEMS - FIXED COMPLETE DATABASE MIGRATION
-- This version handles existing types and tables gracefully
-- Run this in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE TYPES (IF NOT EXISTS)
-- ============================================================================

-- Drop and recreate types to avoid conflicts
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'client', 'visitor');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE project_status AS ENUM ('Active', 'Pending', 'Completed', 'Declined');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE project_stage AS ENUM ('Discovery', 'Design', 'Development', 'Testing', 'Deployment', 'Maintenance');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE contract_status AS ENUM ('None', 'Drafted', 'Sent', 'Signed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE submission_status AS ENUM ('New', 'Read', 'Replied');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM ('contact', 'project', 'message', 'system');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE media_type AS ENUM ('image', 'video');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- PART 2: CREATE TABLES
-- ============================================================================

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'client',
  avatar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_name TEXT,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  status project_status NOT NULL DEFAULT 'Pending',
  current_stage project_stage NOT NULL DEFAULT 'Discovery',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  due_date DATE NOT NULL,
  team TEXT[] DEFAULT '{}',
  image TEXT,
  description TEXT,
  contract_status contract_status NOT NULL DEFAULT 'None',
  contract_text TEXT,
  external_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'model', 'system')),
  text TEXT NOT NULL,
  is_thinking BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contact submissions
CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  status submission_status NOT NULL DEFAULT 'New',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Gallery items
CREATE TABLE IF NOT EXISTS public.gallery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type media_type NOT NULL,
  url TEXT NOT NULL,
  prompt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Activity logs
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    ip_address TEXT,
    country TEXT,
    city TEXT,
    device_type TEXT,
    browser TEXT,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_suspicious BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Login sessions
CREATE TABLE IF NOT EXISTS public.login_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    ip_address TEXT,
    country TEXT,
    city TEXT,
    device_info JSONB DEFAULT '{}'::jsonb,
    login_time TIMESTAMPTZ DEFAULT NOW(),
    logout_time TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    session_duration INT DEFAULT 0
);

-- Security alerts
CREATE TABLE IF NOT EXISTS public.security_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    alert_type TEXT NOT NULL,
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT,
    is_resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blocked countries
CREATE TABLE IF NOT EXISTS public.blocked_countries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code TEXT NOT NULL UNIQUE,
    country_name TEXT NOT NULL,
    reason TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART 3: CREATE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_login_sessions_user_id ON public.login_sessions(user_id);

-- ============================================================================
-- PART 4: CREATE FUNCTIONS AND TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 5: ENABLE RLS
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_countries ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 6: CREATE RLS POLICIES (DROP IF EXISTS FIRST)
-- ============================================================================

-- Helper function
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.get_user_role(auth.uid()) = 'admin');

-- Projects policies
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
CREATE POLICY "Users can view their own projects"
  ON public.projects FOR SELECT
  USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Admins can view all projects" ON public.projects;
CREATE POLICY "Admins can view all projects"
  ON public.projects FOR SELECT
  USING (public.get_user_role(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Admins can insert projects" ON public.projects;
CREATE POLICY "Admins can insert projects"
  ON public.projects FOR INSERT
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

DROP POLICY IF EXISTS "Admins can update all projects" ON public.projects;
CREATE POLICY "Admins can update all projects"
  ON public.projects FOR UPDATE
  USING (public.get_user_role(auth.uid()) = 'admin');

-- Messages policies
DROP POLICY IF EXISTS "Users can view all messages" ON public.messages;
CREATE POLICY "Users can view all messages"
  ON public.messages FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can send messages" ON public.messages;
CREATE POLICY "Authenticated users can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Contact submissions policies
DROP POLICY IF EXISTS "Anyone can submit contact forms" ON public.contact_submissions;
CREATE POLICY "Anyone can submit contact forms"
  ON public.contact_submissions FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view contact submissions" ON public.contact_submissions;
CREATE POLICY "Admins can view contact submissions"
  ON public.contact_submissions FOR SELECT
  USING (public.get_user_role(auth.uid()) = 'admin');

-- ============================================================================
-- PART 7: STORAGE BUCKETS
-- ============================================================================

INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars', 'avatars', true),
  ('project-files', 'project-files', false),
  ('gallery', 'gallery', false)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Migration completed successfully!';
    RAISE NOTICE '📊 All tables created';
    RAISE NOTICE '🔒 RLS policies active';
    RAISE NOTICE '📁 Storage buckets configured';
END $$;
