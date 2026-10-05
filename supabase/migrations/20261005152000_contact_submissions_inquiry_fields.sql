-- Align contact_submissions with marketing contact form payload.
-- Production previously only had: id, name, email, message, status, created_at, tenant_id
-- and status enum submission_status = ('New','Read','Replied').

ALTER TABLE public.contact_submissions
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS company text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'website',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at
  ON public.contact_submissions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_email
  ON public.contact_submissions (email);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_status
  ON public.contact_submissions (status);
