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
