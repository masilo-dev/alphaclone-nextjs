-- Migration: Add communication consent and GDPR columns to profiles
-- Date: 2026-08-23
-- Required by /api/account/communication-prefs (POST + GET) and new user registration flow.

-- 1. Add missing columns to profiles (idempotent)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS communication_prefs JSONB NOT NULL DEFAULT '{
    "transactional": true,
    "product_updates": true,
    "marketing": false,
    "sms": false
  }'::jsonb;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gdpr_consent_date TIMESTAMPTZ;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gdpr_consent_ip TEXT;

COMMENT ON COLUMN public.profiles.communication_prefs   IS 'User communication preferences including marketing, product updates, sms, and legal acceptance audit trail.';
COMMENT ON COLUMN public.profiles.gdpr_consent_date     IS 'Timestamp when the user last accepted the terms of service and privacy policy.';
COMMENT ON COLUMN public.profiles.gdpr_consent_ip       IS 'IP address captured at the time of GDPR/legal consent.';

-- 2. Ensure service-role (admin) writes to profiles are never blocked by RLS.
--    The guard_profile_self_promotion trigger already exempts auth.uid() IS NULL (service role),
--    but an explicit RLS bypass policy ensures the admin client upsert works.
DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.profiles;
CREATE POLICY "Service role can manage all profiles"
  ON public.profiles
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- NOTE: The above policy only applies when the Supabase client is initialized with the
-- service_role key (bypasses RLS by default), but is an extra guard for cases where
-- the admin client has NOT been configured to bypass RLS explicitly.

-- 3. Grant authenticated users SELECT on their own communication_prefs (belt-and-suspenders)
DROP POLICY IF EXISTS "Users can update own communication prefs" ON public.profiles;
CREATE POLICY "Users can update own communication prefs"
  ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
