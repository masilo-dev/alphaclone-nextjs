-- Repair live schema and privilege drift found in the production Supabase project.
-- The project-creation API calls apply_project_template with the service-role client.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_preferences jsonb NOT NULL
  DEFAULT '{"digest": true, "product_updates": true, "reminders": true}'::jsonb;

REVOKE ALL ON FUNCTION public.apply_project_template(uuid, uuid, uuid, date, text, uuid, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_project_template(uuid, uuid, uuid, date, text, uuid, text)
  TO service_role;
