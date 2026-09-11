-- Allow client-facing project share links (/p/[id]) to load for logged-out clients.
-- Existing public policy required show_in_portfolio = true (marketing portfolio only);
-- a shared client link sets is_public = true WITHOUT exposing the project in the portfolio.
-- This policy grants read access to a project strictly when it has been explicitly made public.

drop policy if exists "Public projects are viewable by link" on public.projects;
DROP POLICY IF EXISTS "Public projects are viewable by link" ON public.projects;
create policy "Public projects are viewable by link"
  on public.projects
  for select
  to anon, authenticated
  using (is_public = true);
