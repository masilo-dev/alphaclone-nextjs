-- ==========================================
-- SAFE DEPLOYMENT SCRIPT (Idempotent)
-- ==========================================
-- This script safely checks if types/tables exist before creating them.
-- You can run this multiple times without errors.

-- 1. Create custom types safely
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'client', 'visitor');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE project_status AS ENUM ('Active', 'Pending', 'Completed', 'Declined');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE project_stage AS ENUM ('Discovery', 'Design', 'Development', 'Testing', 'Deployment', 'Maintenance');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE contract_status AS ENUM ('None', 'Drafted', 'Sent', 'Signed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE submission_status AS ENUM ('New', 'Read', 'Replied');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_type AS ENUM ('contact', 'project', 'message', 'system');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE media_type AS ENUM ('image', 'video');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- 2. Create Tables (IF NOT EXISTS)

-- Profiles table (extends auth.users)
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

-- Contact submissions table
CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  status submission_status NOT NULL DEFAULT 'New',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Gallery items table
CREATE TABLE IF NOT EXISTS public.gallery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type media_type NOT NULL,
  url TEXT NOT NULL,
  prompt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- 3. Create Indexes (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_status ON public.contact_submissions(status);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON public.contact_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gallery_items_user_id ON public.gallery_items(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);


-- 4. Triggers & Functions (REPLACE / DROP IF EXISTS)

-- Helper function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: profiles updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger: projects updated_at
DROP TRIGGER IF EXISTS update_projects_updated_at ON public.projects;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- 5. RLS & Policies (Enable RLS, DROP POLICY, CREATE POLICY)

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Helper macro to safely drop policies
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
    DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
    DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
    
    DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
    DROP POLICY IF EXISTS "Admins can view all projects" ON public.projects;
    DROP POLICY IF EXISTS "Admins can insert projects" ON public.projects;
    DROP POLICY IF EXISTS "Admins can update all projects" ON public.projects;
    DROP POLICY IF EXISTS "Admins can delete projects" ON public.projects;

    DROP POLICY IF EXISTS "Users can view all messages" ON public.messages;
    DROP POLICY IF EXISTS "Authenticated users can send messages" ON public.messages;
    DROP POLICY IF EXISTS "Admins can delete messages" ON public.messages;

    DROP POLICY IF EXISTS "Anyone can submit contact forms" ON public.contact_submissions;
    DROP POLICY IF EXISTS "Admins can view contact submissions" ON public.contact_submissions;
    DROP POLICY IF EXISTS "Admins can update contact submissions" ON public.contact_submissions;

    DROP POLICY IF EXISTS "Users can view their own gallery" ON public.gallery_items;
    DROP POLICY IF EXISTS "Users can insert to their own gallery" ON public.gallery_items;
    DROP POLICY IF EXISTS "Users can delete from their own gallery" ON public.gallery_items;
    DROP POLICY IF EXISTS "Admins can view all gallery items" ON public.gallery_items;

    DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Admins can create notifications" ON public.notifications;
    DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;
END $$;


-- RE-CREATE POLICIES

-- Profiles
CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (public.get_user_role(auth.uid()) = 'admin');

-- Projects
CREATE POLICY "Users can view their own projects" ON public.projects FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY "Admins can view all projects" ON public.projects FOR SELECT USING (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Admins can insert projects" ON public.projects FOR INSERT WITH CHECK (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Admins can update all projects" ON public.projects FOR UPDATE USING (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Admins can delete projects" ON public.projects FOR DELETE USING (public.get_user_role(auth.uid()) = 'admin');

-- Messages
CREATE POLICY "Users can view all messages" ON public.messages FOR SELECT USING (true);
CREATE POLICY "Authenticated users can send messages" ON public.messages FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins can delete messages" ON public.messages FOR DELETE USING (public.get_user_role(auth.uid()) = 'admin');

-- Contact Submissions
CREATE POLICY "Anyone can submit contact forms" ON public.contact_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view contact submissions" ON public.contact_submissions FOR SELECT USING (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Admins can update contact submissions" ON public.contact_submissions FOR UPDATE USING (public.get_user_role(auth.uid()) = 'admin');

-- Gallery
CREATE POLICY "Users can view their own gallery" ON public.gallery_items FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert to their own gallery" ON public.gallery_items FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete from their own gallery" ON public.gallery_items FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "Admins can view all gallery items" ON public.gallery_items FOR SELECT USING (public.get_user_role(auth.uid()) = 'admin');

-- Notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Admins can create notifications" ON public.notifications FOR INSERT WITH CHECK (public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT WITH CHECK (true);


-- 6. Storage Buckets (Safe Insert)
INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars', 'avatars', true),
  ('project-files', 'project-files', false),
  ('gallery', 'gallery', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
-- Note: 'storage.objects' policies need to be dropped carefully as they might duplicate
DO $$ BEGIN
    DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
    DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

    DROP POLICY IF EXISTS "Project files are accessible to project owner and admins" ON storage.objects;
    DROP POLICY IF EXISTS "Admins can upload project files" ON storage.objects;
    DROP POLICY IF EXISTS "Admins can update project files" ON storage.objects;
    DROP POLICY IF EXISTS "Admins can delete project files" ON storage.objects;

    DROP POLICY IF EXISTS "Users can view their own gallery files" ON storage.objects;
    DROP POLICY IF EXISTS "Users can upload to their own gallery" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete from their own gallery" ON storage.objects;
    DROP POLICY IF EXISTS "Admins can view all gallery files" ON storage.objects;
END $$;

-- Avatars
CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete their own avatar" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Project Files
CREATE POLICY "Project files are accessible to project owner and admins" ON storage.objects FOR SELECT USING (bucket_id = 'project-files' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.get_user_role(auth.uid()) = 'admin'));
CREATE POLICY "Admins can upload project files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'project-files' AND public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Admins can update project files" ON storage.objects FOR UPDATE USING (bucket_id = 'project-files' AND public.get_user_role(auth.uid()) = 'admin');
CREATE POLICY "Admins can delete project files" ON storage.objects FOR DELETE USING (bucket_id = 'project-files' AND public.get_user_role(auth.uid()) = 'admin');

-- Gallery Files
CREATE POLICY "Users can view their own gallery files" ON storage.objects FOR SELECT USING (bucket_id = 'gallery' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can upload to their own gallery" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'gallery' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete from their own gallery" ON storage.objects FOR DELETE USING (bucket_id = 'gallery' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Admins can view all gallery files" ON storage.objects FOR SELECT USING (bucket_id = 'gallery' AND public.get_user_role(auth.uid()) = 'admin');


-- 7. Phase 9 Tables (Advanced Security)

CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  country TEXT,
  city TEXT,
  device_type TEXT,
  browser TEXT,
  is_suspicious BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS login_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  login_time TIMESTAMPTZ DEFAULT NOW(),
  logout_time TIMESTAMPTZ,
  ip_address INET,
  country TEXT,
  city TEXT,
  device_info JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  session_duration INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blocked_countries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT UNIQUE NOT NULL,
  country_name TEXT NOT NULL,
  reason TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT,
  ip_address INET,
  metadata JSONB DEFAULT '{}',
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_suspicious ON activity_logs(is_suspicious) WHERE is_suspicious = TRUE;

CREATE INDEX IF NOT EXISTS idx_login_sessions_user_id ON login_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_login_sessions_active ON login_sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_login_sessions_login_time ON login_sessions(login_time DESC);

CREATE INDEX IF NOT EXISTS idx_security_alerts_user_id ON security_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_unresolved ON security_alerts(is_resolved) WHERE is_resolved = FALSE;
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity);

-- Blocked Countries Data
INSERT INTO blocked_countries (country_code, country_name, reason) VALUES
  ('NG', 'Nigeria', 'Business policy - high fraud risk'),
  ('IN', 'India', 'Business policy - spam prevention')
ON CONFLICT (country_code) DO NOTHING;


-- 8. Advanced Functions & Triggers

-- Handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, avatar)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'client'),
    NEW.raw_user_meta_data->>'avatar'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Notify admins on contact
CREATE OR REPLACE FUNCTION public.notify_admins_on_contact()
RETURNS TRIGGER AS $$
DECLARE
  admin_record RECORD;
BEGIN
  FOR admin_record IN
    SELECT id FROM public.profiles WHERE role = 'admin'
  LOOP
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
      admin_record.id,
      'contact',
      'New Contact Form Submission',
      'New message from ' || NEW.name || ' (' || NEW.email || ')'
    );
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_contact_submission ON public.contact_submissions;
CREATE TRIGGER on_contact_submission
  AFTER INSERT ON public.contact_submissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_contact();

-- Notify on new project
CREATE OR REPLACE FUNCTION public.notify_on_new_project()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message)
  VALUES (
    NEW.owner_id,
    'project',
    'New Project Created',
    'Your project "' || NEW.name || '" has been created'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_project_created ON public.projects;
CREATE TRIGGER on_project_created
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_project();

-- Notify on project update
CREATE OR REPLACE FUNCTION public.notify_on_project_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status != NEW.status OR OLD.current_stage != NEW.current_stage THEN
    INSERT INTO public.notifications (user_id, type, title, message)
    VALUES (
      NEW.owner_id,
      'project',
      'Project Update',
      'Your project "' || NEW.name || '" status changed to ' || NEW.status || ' - ' || NEW.current_stage
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_project_updated ON public.projects;
CREATE TRIGGER on_project_updated
  AFTER UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_project_update();

-- Calculate session duration
CREATE OR REPLACE FUNCTION calculate_session_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.logout_time IS NOT NULL AND OLD.logout_time IS NULL THEN
    NEW.session_duration := EXTRACT(EPOCH FROM (NEW.logout_time - NEW.login_time))::INTEGER;
    NEW.is_active := FALSE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calculate_session_duration ON login_sessions;
CREATE TRIGGER trigger_calculate_session_duration
  BEFORE UPDATE ON login_sessions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_session_duration();

-- Detect suspicious activity
CREATE OR REPLACE FUNCTION detect_suspicious_activity()
RETURNS TRIGGER AS $$
DECLARE
  recent_countries TEXT[];
  country_count INTEGER;
BEGIN
  SELECT ARRAY_AGG(DISTINCT country) INTO recent_countries
  FROM login_sessions
  WHERE user_id = NEW.user_id
    AND login_time > NOW() - INTERVAL '24 hours'
    AND country IS NOT NULL;
  
  country_count := COALESCE(array_length(recent_countries, 1), 0);
  
  IF country_count >= 3 THEN
    NEW.is_suspicious := TRUE;
    INSERT INTO security_alerts (user_id, alert_type, severity, description, ip_address, metadata)
    VALUES (
      NEW.user_id,
      'suspicious_login',
      'high',
      'Multiple countries detected in 24 hours: ' || array_to_string(recent_countries, ', '),
      NEW.ip_address,
      jsonb_build_object('countries', recent_countries, 'count', country_count)
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_detect_suspicious_activity ON activity_logs;
CREATE TRIGGER trigger_detect_suspicious_activity
  BEFORE INSERT ON activity_logs
  FOR EACH ROW
  WHEN (NEW.action = 'login')
  EXECUTE FUNCTION detect_suspicious_activity();


-- 9. Advanced Security Policies for New Tables

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    DROP POLICY IF EXISTS "Admins can view all activity logs" ON activity_logs;
    DROP POLICY IF EXISTS "Users can view their own activity logs" ON activity_logs;
    DROP POLICY IF EXISTS "System can insert activity logs" ON activity_logs;
    
    DROP POLICY IF EXISTS "Admins can view all login sessions" ON login_sessions;
    DROP POLICY IF EXISTS "Users can view their own login sessions" ON login_sessions;
    DROP POLICY IF EXISTS "System can manage login sessions" ON login_sessions;
    
    DROP POLICY IF EXISTS "Everyone can view blocked countries" ON blocked_countries;
    DROP POLICY IF EXISTS "Only admins can manage blocked countries" ON blocked_countries;
    
    DROP POLICY IF EXISTS "Admins can view all security alerts" ON security_alerts;
    DROP POLICY IF EXISTS "Users can view their own security alerts" ON security_alerts;
    DROP POLICY IF EXISTS "System can create security alerts" ON security_alerts;
    DROP POLICY IF EXISTS "Admins can resolve security alerts" ON security_alerts;
END $$;

-- Activity Logs
CREATE POLICY "Admins can view all activity logs" ON activity_logs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Users can view their own activity logs" ON activity_logs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "System can insert activity logs" ON activity_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Login Sessions
CREATE POLICY "Admins can view all login sessions" ON login_sessions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Users can view their own login sessions" ON login_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "System can manage login sessions" ON login_sessions FOR ALL TO authenticated USING (user_id = auth.uid());

-- Blocked Countries
CREATE POLICY "Everyone can view blocked countries" ON blocked_countries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Only admins can manage blocked countries" ON blocked_countries FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Security Alerts
CREATE POLICY "Admins can view all security alerts" ON security_alerts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "Users can view their own security alerts" ON security_alerts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "System can create security alerts" ON security_alerts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins can resolve security alerts" ON security_alerts FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

