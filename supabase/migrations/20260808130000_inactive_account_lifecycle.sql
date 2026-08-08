-- Inactive account lifecycle policy:
-- accounts inactive for 60 days are disabled, then permanently deleted 6 days later.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_status')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'account_status'
         AND e.enumlabel = 'disabled'
     ) THEN
    ALTER TYPE public.account_status ADD VALUE 'disabled';
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disabled_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_disabled_purge_due
  ON public.profiles (disabled_at)
  WHERE account_status = 'disabled'::public.account_status;
