-- Migration: Force Tenant Admin Role for Google Sign-Ups
-- Date: 2026-02-14
-- Description: Overrides previous 'client' default. Forces 'tenant_admin' role for ALL new sign-ups via handle_new_user trigger.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'avatar_url', ''),
    'tenant_admin' -- Force 'tenant_admin' role for ALL new sign-ups (including Google)
  );
  RETURN new;
END;
$$;
