-- Restore intended fields on tables created by the broad compatibility migration.
-- Existing rows and tenant policies are preserved. No email is sent here.
ALTER TABLE public.profiles
 ADD COLUMN IF NOT EXISTS email_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
 ADD COLUMN IF NOT EXISTS last_digest_sent_at timestamptz,
 ADD COLUMN IF NOT EXISTS last_morning_bundle_sent_at timestamptz;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS last_contacted_at timestamptz,
 ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;
ALTER TABLE public.tenant_document_versions
 ADD COLUMN IF NOT EXISTS document_id uuid REFERENCES public.documents(id) ON DELETE CASCADE,
 ADD COLUMN IF NOT EXISTS version integer,
 ADD COLUMN IF NOT EXISTS storage_path text,
 ADD COLUMN IF NOT EXISTS checksum text,
 ADD COLUMN IF NOT EXISTS created_by uuid;
CREATE UNIQUE INDEX IF NOT EXISTS tenant_document_versions_document_version_unique
 ON public.tenant_document_versions(document_id, version);
NOTIFY pgrst, 'reload schema';
