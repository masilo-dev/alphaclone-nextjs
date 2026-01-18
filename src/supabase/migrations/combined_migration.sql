-- Combined migration file for easy deployment via Supabase Dashboard
-- Copy and paste this entire file into the Supabase SQL Editor and run it

-- ============================================================================
-- PART 1: INITIAL SCHEMA
-- ============================================================================

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'client', 'visitor');
CREATE TYPE project_status AS ENUM ('Active', 'Pending', 'Completed', 'Declined');
CREATE TYPE project_stage AS ENUM ('Discovery', 'Design', 'Development', 'Testing', 'Deployment', 'Maintenance');
CREATE TYPE contract_status AS ENUM ('None', 'Drafted', 'Sent', 'Signed');
CREATE TYPE submission_status AS ENUM ('New', 'Read', 'Replied');
CREATE TYPE notification_type AS ENUM ('contact', 'project', 'message', 'system');
CREATE TYPE media_type AS ENUM ('image', 'video');

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

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON public.projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_status ON public.contact_submissions(status);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON public.contact_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gallery_items_user_id ON public.gallery_items(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 2: ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gallery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Helper function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.get_user_role(auth.uid()) = 'admin');

-- Projects policies
CREATE POLICY "Users can view their own projects"
  ON public.projects FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "Admins can view all projects"
  ON public.projects FOR SELECT
  USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can insert projects"
  ON public.projects FOR INSERT
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can update all projects"
  ON public.projects FOR UPDATE
  USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can delete projects"
  ON public.projects FOR DELETE
  USING (public.get_user_role(auth.uid()) = 'admin');

-- Messages policies
CREATE POLICY "Users can view all messages"
  ON public.messages FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can send messages"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete messages"
  ON public.messages FOR DELETE
  USING (public.get_user_role(auth.uid()) = 'admin');

-- Contact submissions policies
CREATE POLICY "Anyone can submit contact forms"
  ON public.contact_submissions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view contact submissions"
  ON public.contact_submissions FOR SELECT
  USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can update contact submissions"
  ON public.contact_submissions FOR UPDATE
  USING (public.get_user_role(auth.uid()) = 'admin');

-- Gallery items policies
CREATE POLICY "Users can view their own gallery"
  ON public.gallery_items FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert to their own gallery"
  ON public.gallery_items FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete from their own gallery"
  ON public.gallery_items FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all gallery items"
  ON public.gallery_items FOR SELECT
  USING (public.get_user_role(auth.uid()) = 'admin');

-- Notifications policies
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Admins can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "System can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- ============================================================================
-- PART 3: STORAGE BUCKETS
-- ============================================================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars', 'avatars', true),
  ('project-files', 'project-files', false),
  ('gallery', 'gallery', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars bucket (public)
CREATE POLICY "Avatar images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own avatar"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for project-files bucket (private)
CREATE POLICY "Project files are accessible to project owner and admins"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'project-files' AND
    (
      auth.uid()::text = (storage.foldername(name))[1] OR
      public.get_user_role(auth.uid()) = 'admin'
    )
  );

CREATE POLICY "Admins can upload project files"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-files' AND
    public.get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can update project files"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'project-files' AND
    public.get_user_role(auth.uid()) = 'admin'
  );

CREATE POLICY "Admins can delete project files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-files' AND
    public.get_user_role(auth.uid()) = 'admin'
  );

-- Storage policies for gallery bucket (private)
CREATE POLICY "Users can view their own gallery files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'gallery' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can upload to their own gallery"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'gallery' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete from their own gallery"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'gallery' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins can view all gallery files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'gallery' AND
    public.get_user_role(auth.uid()) = 'admin'
  );

-- ============================================================================
-- PART 4: DATABASE FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to handle new user signup
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

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to create notification for contact form submission
CREATE OR REPLACE FUNCTION public.notify_admins_on_contact()
RETURNS TRIGGER AS $$
DECLARE
  admin_record RECORD;
BEGIN
  -- Create notification for all admin users
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

-- Trigger to notify admins on contact submission
DROP TRIGGER IF EXISTS on_contact_submission ON public.contact_submissions;
CREATE TRIGGER on_contact_submission
  AFTER INSERT ON public.contact_submissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_contact();

-- Function to create notification for new project
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

-- Trigger to notify user on new project
DROP TRIGGER IF EXISTS on_project_created ON public.projects;
CREATE TRIGGER on_project_created
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_project();

-- Function to create notification for project status change
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

-- Trigger to notify user on project update
     u s e r _ i d   U U I D   R E F E R E N C E S   p r o f i l e s ( i d )   O N   D E L E T E   C A S C A D E , 
 
     a c t i o n   T E X T   N O T   N U L L , 
 
     i p _ a d d r e s s   I N E T , 
 
     u s e r _ a g e n t   T E X T , 
 
     c o u n t r y   T E X T , 
 
     c i t y   T E X T , 
 
     d e v i c e _ t y p e   T E X T , 
 
     b r o w s e r   T E X T , 
 
     i s _ s u s p i c i o u s   B O O L E A N   D E F A U L T   F A L S E , 
 
     m e t a d a t a   J S O N B   D E F A U L T   ' { } ' , 
 
     c r e a t e d _ a t   T I M E S T A M P T Z   D E F A U L T   N O W ( ) 
 
 ) ; 
 
 
 
 - -   L o g i n   S e s s i o n s   T a b l e 
 
 C R E A T E   T A B L E   I F   N O T   E X I S T S   l o g i n _ s e s s i o n s   ( 
 
     i d   U U I D   P R I M A R Y   K E Y   D E F A U L T   g e n _ r a n d o m _ u u i d ( ) , 
 
     u s e r _ i d   U U I D   R E F E R E N C E S   p r o f i l e s ( i d )   O N   D E L E T E   C A S C A D E , 
 
     l o g i n _ t i m e   T I M E S T A M P T Z   D E F A U L T   N O W ( ) , 
 
     l o g o u t _ t i m e   T I M E S T A M P T Z , 
 
     i p _ a d d r e s s   I N E T , 
 
     c o u n t r y   T E X T , 
 
     c i t y   T E X T , 
 
     d e v i c e _ i n f o   J S O N B   D E F A U L T   ' { } ' , 
 
     i s _ a c t i v e   B O O L E A N   D E F A U L T   T R U E , 
 
     s e s s i o n _ d u r a t i o n   I N T E G E R ,   - -   i n   s e c o n d s 
 
     c r e a t e d _ a t   T I M E S T A M P T Z   D E F A U L T   N O W ( ) 
 
 ) ; 
 
 
 
 - -   B l o c k e d   C o u n t r i e s   T a b l e 
 
 C R E A T E   T A B L E   I F   N O T   E X I S T S   b l o c k e d _ c o u n t r i e s   ( 
 
     i d   U U I D   P R I M A R Y   K E Y   D E F A U L T   g e n _ r a n d o m _ u u i d ( ) , 
 
     c o u n t r y _ c o d e   T E X T   U N I Q U E   N O T   N U L L , 
 
     c o u n t r y _ n a m e   T E X T   N O T   N U L L , 
 
     r e a s o n   T E X T , 
 
     i s _ a c t i v e   B O O L E A N   D E F A U L T   T R U E , 
 
     c r e a t e d _ a t   T I M E S T A M P T Z   D E F A U L T   N O W ( ) 
 
 ) ; 
 
 
 
 - -   S e c u r i t y   A l e r t s   T a b l e 
 
 C R E A T E   T A B L E   I F   N O T   E X I S T S   s e c u r i t y _ a l e r t s   ( 
 
     i d   U U I D   P R I M A R Y   K E Y   D E F A U L T   g e n _ r a n d o m _ u u i d ( ) , 
 
     u s e r _ i d   U U I D   R E F E R E N C E S   p r o f i l e s ( i d )   O N   D E L E T E   C A S C A D E , 
 
     a l e r t _ t y p e   T E X T   N O T   N U L L ,   - -   ' s u s p i c i o u s _ l o g i n ' ,   ' g e o _ b l o c k _ a t t e m p t ' ,   ' m u l t i p l e _ f a i l e d _ l o g i n s ' ,   e t c . 
 
     s e v e r i t y   T E X T   C H E C K   ( s e v e r i t y   I N   ( ' l o w ' ,   ' m e d i u m ' ,   ' h i g h ' ,   ' c r i t i c a l ' ) ) , 
 
     d e s c r i p t i o n   T E X T , 
 
     i p _ a d d r e s s   I N E T , 
 
     m e t a d a t a   J S O N B   D E F A U L T   ' { } ' , 
 
     i s _ r e s o l v e d   B O O L E A N   D E F A U L T   F A L S E , 
 
     r e s o l v e d _ a t   T I M E S T A M P T Z , 
 
     c r e a t e d _ a t   T I M E S T A M P T Z   D E F A U L T   N O W ( ) 
 
 ) ; 
 
 
 
 - -   I n d e x e s   f o r   p e r f o r m a n c e 
 
 C R E A T E   I N D E X   I F   N O T   E X I S T S   i d x _ a c t i v i t y _ l o g s _ u s e r _ i d   O N   a c t i v i t y _ l o g s ( u s e r _ i d ) ; 
 
 C R E A T E   I N D E X   I F   N O T   E X I S T S   i d x _ a c t i v i t y _ l o g s _ c r e a t e d _ a t   O N   a c t i v i t y _ l o g s ( c r e a t e d _ a t   D E S C ) ; 
 
 C R E A T E   I N D E X   I F   N O T   E X I S T S   i d x _ a c t i v i t y _ l o g s _ s u s p i c i o u s   O N   a c t i v i t y _ l o g s ( i s _ s u s p i c i o u s )   W H E R E   i s _ s u s p i c i o u s   =   T R U E ; 
 
 
 
 C R E A T E   I N D E X   I F   N O T   E X I S T S   i d x _ l o g i n _ s e s s i o n s _ u s e r _ i d   O N   l o g i n _ s e s s i o n s ( u s e r _ i d ) ; 
 
 C R E A T E   I N D E X   I F   N O T   E X I S T S   i d x _ l o g i n _ s e s s i o n s _ a c t i v e   O N   l o g i n _ s e s s i o n s ( i s _ a c t i v e )   W H E R E   i s _ a c t i v e   =   T R U E ; 
 
 C R E A T E   I N D E X   I F   N O T   E X I S T S   i d x _ l o g i n _ s e s s i o n s _ l o g i n _ t i m e   O N   l o g i n _ s e s s i o n s ( l o g i n _ t i m e   D E S C ) ; 
 
 
 
 C R E A T E   I N D E X   I F   N O T   E X I S T S   i d x _ s e c u r i t y _ a l e r t s _ u s e r _ i d   O N   s e c u r i t y _ a l e r t s ( u s e r _ i d ) ; 
 
 C R E A T E   I N D E X   I F   N O T   E X I S T S   i d x _ s e c u r i t y _ a l e r t s _ u n r e s o l v e d   O N   s e c u r i t y _ a l e r t s ( i s _ r e s o l v e d )   W H E R E   i s _ r e s o l v e d   =   F A L S E ; 
 
 C R E A T E   I N D E X   I F   N O T   E X I S T S   i d x _ s e c u r i t y _ a l e r t s _ s e v e r i t y   O N   s e c u r i t y _ a l e r t s ( s e v e r i t y ) ; 
 
 
 
 - -   P r e - p o p u l a t e   b l o c k e d   c o u n t r i e s 
 
 I N S E R T   I N T O   b l o c k e d _ c o u n t r i e s   ( c o u n t r y _ c o d e ,   c o u n t r y _ n a m e ,   r e a s o n )   V A L U E S 
 
     ( ' N G ' ,   ' N i g e r i a ' ,   ' B u s i n e s s   p o l i c y   -   h i g h   f r a u d   r i s k ' ) , 
 
     ( ' I N ' ,   ' I n d i a ' ,   ' B u s i n e s s   p o l i c y   -   s p a m   p r e v e n t i o n ' ) 
 
 O N   C O N F L I C T   ( c o u n t r y _ c o d e )   D O   N O T H I N G ; 
 
 
 
 - -   F u n c t i o n   t o   a u t o m a t i c a l l y   l o g   s e s s i o n   d u r a t i o n   o n   l o g o u t 
 
 C R E A T E   O R   R E P L A C E   F U N C T I O N   c a l c u l a t e _ s e s s i o n _ d u r a t i o n ( ) 
 
 R E T U R N S   T R I G G E R   A S   $ $ 
 
 B E G I N 
 
     I F   N E W . l o g o u t _ t i m e   I S   N O T   N U L L   A N D   O L D . l o g o u t _ t i m e   I S   N U L L   T H E N 
 
         N E W . s e s s i o n _ d u r a t i o n   : =   E X T R A C T ( E P O C H   F R O M   ( N E W . l o g o u t _ t i m e   -   N E W . l o g i n _ t i m e ) ) : : I N T E G E R ; 
 
         N E W . i s _ a c t i v e   : =   F A L S E ; 
 
     E N D   I F ; 
 
     R E T U R N   N E W ; 
 
 E N D ; 
 
 $ $   L A N G U A G E   p l p g s q l ; 
 
 
 
 - -   T r i g g e r   f o r   s e s s i o n   d u r a t i o n   c a l c u l a t i o n 
 
 D R O P   T R I G G E R   I F   E X I S T S   t r i g g e r _ c a l c u l a t e _ s e s s i o n _ d u r a t i o n   O N   l o g i n _ s e s s i o n s ; 
 
 C R E A T E   T R I G G E R   t r i g g e r _ c a l c u l a t e _ s e s s i o n _ d u r a t i o n 
 
     B E F O R E   U P D A T E   O N   l o g i n _ s e s s i o n s 
 
     F O R   E A C H   R O W 
 
     E X E C U T E   F U N C T I O N   c a l c u l a t e _ s e s s i o n _ d u r a t i o n ( ) ; 
 
 
 
 - -   F u n c t i o n   t o   d e t e c t   s u s p i c i o u s   a c t i v i t y 
 
 C R E A T E   O R   R E P L A C E   F U N C T I O N   d e t e c t _ s u s p i c i o u s _ a c t i v i t y ( ) 
 
 R E T U R N S   T R I G G E R   A S   $ $ 
 
 D E C L A R E 
 
     r e c e n t _ c o u n t r i e s   T E X T [ ] ; 
 
     c o u n t r y _ c o u n t   I N T E G E R ; 
 
 B E G I N 
 
     - -   C h e c k   i f   u s e r   h a s   l o g g e d   i n   f r o m   d i f f e r e n t   c o u n t r i e s   r e c e n t l y 
 
     S E L E C T   A R R A Y _ A G G ( D I S T I N C T   c o u n t r y )   I N T O   r e c e n t _ c o u n t r i e s 
 
     F R O M   l o g i n _ s e s s i o n s 
 
     W H E R E   u s e r _ i d   =   N E W . u s e r _ i d 
 
         A N D   l o g i n _ t i m e   >   N O W ( )   -   I N T E R V A L   ' 2 4   h o u r s ' 
 
         A N D   c o u n t r y   I S   N O T   N U L L ; 
 
     
 
     c o u n t r y _ c o u n t   : =   C O A L E S C E ( a r r a y _ l e n g t h ( r e c e n t _ c o u n t r i e s ,   1 ) ,   0 ) ; 
 
     
 
     - -   I f   u s e r   l o g g e d   i n   f r o m   3 +   d i f f e r e n t   c o u n t r i e s   i n   2 4 h ,   m a r k   a s   s u s p i c i o u s 
 
     I F   c o u n t r y _ c o u n t   > =   3   T H E N 
 
         N E W . i s _ s u s p i c i o u s   : =   T R U E ; 
 
         
 
         - -   C r e a t e   s e c u r i t y   a l e r t 
 
         I N S E R T   I N T O   s e c u r i t y _ a l e r t s   ( u s e r _ i d ,   a l e r t _ t y p e ,   s e v e r i t y ,   d e s c r i p t i o n ,   i p _ a d d r e s s ,   m e t a d a t a ) 
 
         V A L U E S   ( 
 
             N E W . u s e r _ i d , 
 
             ' s u s p i c i o u s _ l o g i n ' , 
 
             ' h i g h ' , 
 
             ' M u l t i p l e   c o u n t r i e s   d e t e c t e d   i n   2 4   h o u r s :   '   | |   a r r a y _ t o _ s t r i n g ( r e c e n t _ c o u n t r i e s ,   ' ,   ' ) , 
 
             N E W . i p _ a d d r e s s , 
 
             j s o n b _ b u i l d _ o b j e c t ( ' c o u n t r i e s ' ,   r e c e n t _ c o u n t r i e s ,   ' c o u n t ' ,   c o u n t r y _ c o u n t ) 
 
         ) ; 
 
     E N D   I F ; 
 
     
 
     R E T U R N   N E W ; 
 
 E N D ; 
 
 $ $   L A N G U A G E   p l p g s q l ; 
 
 
 
 - -   T r i g g e r   f o r   s u s p i c i o u s   a c t i v i t y   d e t e c t i o n 
 
 D R O P   T R I G G E R   I F   E X I S T S   t r i g g e r _ d e t e c t _ s u s p i c i o u s _ a c t i v i t y   O N   a c t i v i t y _ l o g s ; 
 
 C R E A T E   T R I G G E R   t r i g g e r _ d e t e c t _ s u s p i c i o u s _ a c t i v i t y 
 
     B E F O R E   I N S E R T   O N   a c t i v i t y _ l o g s 
 
     F O R   E A C H   R O W 
 
     W H E N   ( N E W . a c t i o n   =   ' l o g i n ' ) 
 
     E X E C U T E   F U N C T I O N   d e t e c t _ s u s p i c i o u s _ a c t i v i t y ( ) ; 
 
 
 
 - -   E n a b l e   R L S 
 
 A L T E R   T A B L E   a c t i v i t y _ l o g s   E N A B L E   R O W   L E V E L   S E C U R I T Y ; 
 
 A L T E R   T A B L E   l o g i n _ s e s s i o n s   E N A B L E   R O W   L E V E L   S E C U R I T Y ; 
 
 A L T E R   T A B L E   b l o c k e d _ c o u n t r i e s   E N A B L E   R O W   L E V E L   S E C U R I T Y ; 
 
 A L T E R   T A B L E   s e c u r i t y _ a l e r t s   E N A B L E   R O W   L E V E L   S E C U R I T Y ; 
 
 
 
 - -   R L S   P o l i c i e s   f o r   a c t i v i t y _ l o g s 
 
 C R E A T E   P O L I C Y   " A d m i n s   c a n   v i e w   a l l   a c t i v i t y   l o g s " 
 
     O N   a c t i v i t y _ l o g s   F O R   S E L E C T 
 
     T O   a u t h e n t i c a t e d 
 
     U S I N G   ( 
 
         E X I S T S   ( 
 
             S E L E C T   1   F R O M   p r o f i l e s 
 
             W H E R E   p r o f i l e s . i d   =   a u t h . u i d ( ) 
 
             A N D   p r o f i l e s . r o l e   =   ' a d m i n ' 
 
         ) 
 
     ) ; 
 
 
 
 C R E A T E   P O L I C Y   " U s e r s   c a n   v i e w   t h e i r   o w n   a c t i v i t y   l o g s " 
 
     O N   a c t i v i t y _ l o g s   F O R   S E L E C T 
 
     T O   a u t h e n t i c a t e d 
 
     U S I N G   ( u s e r _ i d   =   a u t h . u i d ( ) ) ; 
 
 
 
 C R E A T E   P O L I C Y   " S y s t e m   c a n   i n s e r t   a c t i v i t y   l o g s " 
 
     O N   a c t i v i t y _ l o g s   F O R   I N S E R T 
 
     T O   a u t h e n t i c a t e d 
 
     W I T H   C H E C K   ( t r u e ) ; 
 
 
 
 - -   R L S   P o l i c i e s   f o r   l o g i n _ s e s s i o n s 
 
 C R E A T E   P O L I C Y   " A d m i n s   c a n   v i e w   a l l   l o g i n   s e s s i o n s " 
 
     O N   l o g i n _ s e s s i o n s   F O R   S E L E C T 
 
     T O   a u t h e n t i c a t e d 
 
     U S I N G   ( 
 
         E X I S T S   ( 
 
             S E L E C T   1   F R O M   p r o f i l e s 
 
             W H E R E   p r o f i l e s . i d   =   a u t h . u i d ( ) 
 
             A N D   p r o f i l e s . r o l e   =   ' a d m i n ' 
 
         ) 
 
     ) ; 
 
 
 
 C R E A T E   P O L I C Y   " U s e r s   c a n   v i e w   t h e i r   o w n   l o g i n   s e s s i o n s " 
 
     O N   l o g i n _ s e s s i o n s   F O R   S E L E C T 
 
     T O   a u t h e n t i c a t e d 
 
     U S I N G   ( u s e r _ i d   =   a u t h . u i d ( ) ) ; 
 
 
 
 C R E A T E   P O L I C Y   " S y s t e m   c a n   m a n a g e   l o g i n   s e s s i o n s " 
 
     O N   l o g i n _ s e s s i o n s   F O R   A L L 
 
     T O   a u t h e n t i c a t e d 
 
     U S I N G   ( u s e r _ i d   =   a u t h . u i d ( ) ) ; 
 
 
 
 - -   R L S   P o l i c i e s   f o r   b l o c k e d _ c o u n t r i e s 
 
 C R E A T E   P O L I C Y   " E v e r y o n e   c a n   v i e w   b l o c k e d   c o u n t r i e s " 
 
     O N   b l o c k e d _ c o u n t r i e s   F O R   S E L E C T 
 
     T O   a u t h e n t i c a t e d 
 
     U S I N G   ( t r u e ) ; 
 
 
 
 C R E A T E   P O L I C Y   " O n l y   a d m i n s   c a n   m a n a g e   b l o c k e d   c o u n t r i e s " 
 
     O N   b l o c k e d _ c o u n t r i e s   F O R   A L L 
 
     T O   a u t h e n t i c a t e d 
 
     U S I N G   ( 
 
         E X I S T S   ( 
 
             S E L E C T   1   F R O M   p r o f i l e s 
 
             W H E R E   p r o f i l e s . i d   =   a u t h . u i d ( ) 
 
             A N D   p r o f i l e s . r o l e   =   ' a d m i n ' 
 
         ) 
 
     ) ; 
 
 
 
 - -   R L S   P o l i c i e s   f o r   s e c u r i t y _ a l e r t s 
 
 C R E A T E   P O L I C Y   " A d m i n s   c a n   v i e w   a l l   s e c u r i t y   a l e r t s " 
 
     O N   s e c u r i t y _ a l e r t s   F O R   S E L E C T 
 
     T O   a u t h e n t i c a t e d 
 
     U S I N G   ( 
 
         E X I S T S   ( 
 
             S E L E C T   1   F R O M   p r o f i l e s 
 
             W H E R E   p r o f i l e s . i d   =   a u t h . u i d ( ) 
 
             A N D   p r o f i l e s . r o l e   =   ' a d m i n ' 
 
         ) 
 
     ) ; 
 
 
 
 C R E A T E   P O L I C Y   " U s e r s   c a n   v i e w   t h e i r   o w n   s e c u r i t y   a l e r t s " 
 
     O N   s e c u r i t y _ a l e r t s   F O R   S E L E C T 
 
     T O   a u t h e n t i c a t e d 
 
     U S I N G   ( u s e r _ i d   =   a u t h . u i d ( ) ) ; 
 
 
 
 C R E A T E   P O L I C Y   " S y s t e m   c a n   c r e a t e   s e c u r i t y   a l e r t s " 
 
     O N   s e c u r i t y _ a l e r t s   F O R   I N S E R T 
 
     T O   a u t h e n t i c a t e d 
 
     W I T H   C H E C K   ( t r u e ) ; 
 
 
 
 C R E A T E   P O L I C Y   " A d m i n s   c a n   r e s o l v e   s e c u r i t y   a l e r t s " 
 
     O N   s e c u r i t y _ a l e r t s   F O R   U P D A T E 
 
     T O   a u t h e n t i c a t e d 
 
     U S I N G   ( 
 
         E X I S T S   ( 
 
             S E L E C T   1   F R O M   p r o f i l e s 
 
             W H E R E   p r o f i l e s . i d   =   a u t h . u i d ( ) 
 
             A N D   p r o f i l e s . r o l e   =   ' a d m i n ' 
 
         ) 
 
     ) ; 
 
 