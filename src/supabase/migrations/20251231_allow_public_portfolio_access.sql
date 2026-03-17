-- Allow anonymous users to view public portfolio projects
-- This enables the public portfolio page to display projects marked as public

CREATE POLICY "Anyone can view public portfolio projects"
  ON public.projects FOR SELECT
  USING (is_public = true AND show_in_portfolio = true);
