-- Migration: Fix Google Sign-Up Default Role
-- Date: 2026-02-14
-- Description: Updates the handle_new_user trigger to assign 'client' role by default instead of 'tenant_admin' or potential nulls.

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
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    'client' -- Enforce 'client' role for new sign-ups
  );
  RETURN new;
END;
$$;
