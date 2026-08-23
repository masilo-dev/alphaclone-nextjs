-- Migration: Super Admin Hardening & RLS Guard Against Self-Promotion
-- Date: 2026-08-23

-- 1. Ensure password_change_required column exists on profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS password_change_required BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Update is_super_admin helper function
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
      AND (account_status IS NULL OR account_status = 'active')
      AND lower(COALESCE(role::text, '')) IN ('super_admin', 'admin', 'platform_admin', 'platform_owner')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 3. Guard against self-promotion or direct role manipulation via REST client
CREATE OR REPLACE FUNCTION public.guard_profile_self_promotion()
RETURNS TRIGGER AS $$
BEGIN
  -- If executed by service role (auth.uid() IS NULL) or super_admin, permit update
  IF auth.uid() IS NULL OR public.is_super_admin() THEN
    RETURN NEW;
  END IF;

  -- For regular users modifying their own profile:
  IF OLD.id = auth.uid() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Self-promotion or role modification is denied. Contact a platform Super Admin.';
    END IF;
    IF NEW.account_status IS DISTINCT FROM OLD.account_status THEN
      RAISE EXCEPTION 'Modifying account status directly is denied.';
    END IF;
  END IF;

  -- Non-super-admins cannot update other profiles
  IF OLD.id <> auth.uid() THEN
    RAISE EXCEPTION 'Permission denied to update other user profiles.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_guard_profile_self_promotion ON public.profiles;
CREATE TRIGGER trg_guard_profile_self_promotion
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profile_self_promotion();

-- 4. Ensure primary Bonnie account is super_admin
UPDATE public.profiles
SET role = 'super_admin', updated_at = NOW()
WHERE lower(email) = 'bonnie@alphaclonesystems.com' AND COALESCE(role, '') <> 'super_admin';
