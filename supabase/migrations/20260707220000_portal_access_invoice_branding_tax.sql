-- Project portal password + expiry; invoice branding short name + tax country

BEGIN;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS portal_password_hash TEXT,
  ADD COLUMN IF NOT EXISTS portal_expires_at TIMESTAMPTZ;

ALTER TABLE public.business_settings
  ADD COLUMN IF NOT EXISTS trading_name TEXT,
  ADD COLUMN IF NOT EXISTS tax_country TEXT DEFAULT 'ZW';

COMMENT ON COLUMN public.projects.portal_password_hash IS 'sha256:salt:hash — optional gate for /p/{portal_token} links';
COMMENT ON COLUMN public.projects.portal_expires_at IS 'When set, portal link stops working after this timestamp';
COMMENT ON COLUMN public.business_settings.trading_name IS 'Short display name on invoice PDFs (e.g. ACS instead of full legal name)';
COMMENT ON COLUMN public.business_settings.tax_country IS 'ISO country code for default VAT/GST on new invoices';

COMMIT;
