-- Production schema compatibility for registration event writes.
-- Some environments created this table before business_name was introduced.
ALTER TABLE IF EXISTS public.user_registration_events
  ADD COLUMN IF NOT EXISTS business_name TEXT;

NOTIFY pgrst, 'reload schema';
