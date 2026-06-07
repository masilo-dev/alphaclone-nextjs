-- Phase enhancements: project comments public read, invoice payment confirmations

-- Allow anon/authenticated read of comments on public projects
DROP POLICY IF EXISTS "Public can read comments on public projects" ON project_comments;
CREATE POLICY "Public can read comments on public projects"
  ON project_comments FOR SELECT TO anon, authenticated
  USING (
    project_id IN (SELECT id FROM projects WHERE is_public = true)
  );

-- Realtime for project_comments (ignore if already added)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE project_comments;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
